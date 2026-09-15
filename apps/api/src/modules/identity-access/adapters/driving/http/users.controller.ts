import {
  ConflictException,
  Controller,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ResetCollaboratorPassword } from '../../../hexagon/application/reset-collaborator-password';
import { RequirePermission } from './require-permission';
import { TemporaryCredentialResponse } from './user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly resetCollaboratorPassword: ResetCollaboratorPassword) {}

  @Post(':userId/password-reset')
  @RequirePermission('users:manage')
  @ApiOperation({ operationId: 'resetCollaboratorPassword' })
  @ApiCreatedResponse({ type: TemporaryCredentialResponse })
  @ApiNotFoundResponse({ description: 'La cuenta no existe.' })
  @ApiConflictResponse({ description: 'La cuenta está inactiva o cambió simultáneamente.' })
  async resetPassword(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
  ): Promise<TemporaryCredentialResponse> {
    const result = await this.resetCollaboratorPassword.execute(userId);
    if (result.ok) return { temporaryPassword: result.temporaryPassword };

    if (result.reason === 'account-not-found') {
      throw new NotFoundException({
        type: 'https://nova.example/problems/user-not-found',
        title: 'La cuenta no existe',
        status: 404,
        detail: 'No se encontró la cuenta indicada.',
        code: 'USER_NOT_FOUND',
      });
    }

    throw new ConflictException({
      type: 'https://nova.example/problems/user-password-reset-conflict',
      title: 'No se pudo restablecer la contraseña',
      status: 409,
      detail:
        result.reason === 'account-inactive'
          ? 'La cuenta está inactiva.'
          : 'La cuenta cambió mientras se procesaba la solicitud.',
      code: result.reason === 'account-inactive' ? 'USER_INACTIVE' : 'USER_UPDATE_CONFLICT',
    });
  }
}
