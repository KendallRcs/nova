import {
  ConflictException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ResetCollaboratorPassword } from '../../../hexagon/application/reset-collaborator-password';
import { RevokeCollaboratorSessions } from '../../../hexagon/application/revocable-sessions';
import { CreateCollaboratorAccount } from '../../../hexagon/application/create-collaborator-account';
import {
  DeactivateCollaboratorAccount,
  ReactivateCollaboratorAccount,
} from '../../../hexagon/application/change-collaborator-account-status';
import { ListCollaboratorAccounts } from '../../../hexagon/application/user-account-directory';
import { UsernameAlreadyExistsError } from '../../../hexagon/application/user-account-administration';
import type { UserAccountSummary } from '../../../hexagon/application/user-account-directory';
import {
  ADMINISTRATOR_PROFILE_ID,
  EMPLOYEE_PROFILE_ID,
} from '../../../hexagon/domain/access-policy';
import type { UserAccount } from '../../../hexagon/domain/user-account';
import { RequirePermission } from './require-permission';
import {
  CreateUserAccountRequest,
  presentUserAccount,
  TemporaryCredentialResponse,
  UserAccountListResponse,
  UserAccountResponse,
  UserAccountWithTemporaryCredentialResponse,
} from './user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly createCollaboratorAccount: CreateCollaboratorAccount,
    private readonly listCollaboratorAccounts: ListCollaboratorAccounts,
    private readonly deactivateCollaboratorAccount: DeactivateCollaboratorAccount,
    private readonly reactivateCollaboratorAccount: ReactivateCollaboratorAccount,
    private readonly resetCollaboratorPassword: ResetCollaboratorPassword,
    private readonly revokeCollaboratorSessions: RevokeCollaboratorSessions,
  ) {}

  @Post()
  @RequirePermission('users:manage')
  @ApiOperation({ operationId: 'createCollaboratorAccount' })
  @ApiCreatedResponse({ type: UserAccountWithTemporaryCredentialResponse })
  @ApiConflictResponse({ description: 'El nombre de usuario ya existe.' })
  async create(
    @Body() request: CreateUserAccountRequest,
  ): Promise<UserAccountWithTemporaryCredentialResponse> {
    try {
      const result = await this.createCollaboratorAccount.execute(request);
      if (!result.ok) {
        throw new UnprocessableEntityException({
          type: 'https://nova.example/problems/invalid-username',
          title: 'El nombre de usuario no es válido',
          status: 422,
          detail: 'Proporciona un nombre de usuario no vacío.',
          code: 'INVALID_USERNAME',
        });
      }
      return {
        account: presentUserAccount(toSummary(result.account)),
        temporaryPassword: result.temporaryPassword,
      };
    } catch (error) {
      if (error instanceof UsernameAlreadyExistsError) {
        throw new ConflictException({
          type: 'https://nova.example/problems/username-conflict',
          title: 'El nombre de usuario ya existe',
          status: 409,
          detail: error.message,
          code: 'USERNAME_CONFLICT',
        });
      }
      throw error;
    }
  }

  @Get()
  @RequirePermission('users:manage')
  @ApiOperation({ operationId: 'listCollaboratorAccounts' })
  @ApiOkResponse({ type: UserAccountListResponse })
  async list(): Promise<UserAccountListResponse> {
    return { items: (await this.listCollaboratorAccounts.execute()).map(presentUserAccount) };
  }

  @Post(':userId/deactivation')
  @RequirePermission('users:manage')
  @ApiOperation({ operationId: 'deactivateCollaboratorAccount' })
  @ApiCreatedResponse({ type: UserAccountResponse })
  async deactivate(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
  ): Promise<UserAccountResponse> {
    const result = await this.deactivateCollaboratorAccount.execute(userId);
    if (!result.ok) throwAccountChangeError(result.reason);
    return presentUserAccount(toSummary(result.account));
  }

  @Post(':userId/reactivation')
  @RequirePermission('users:manage')
  @ApiOperation({ operationId: 'reactivateCollaboratorAccount' })
  @ApiCreatedResponse({ type: UserAccountWithTemporaryCredentialResponse })
  async reactivate(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
  ): Promise<UserAccountWithTemporaryCredentialResponse> {
    const result = await this.reactivateCollaboratorAccount.execute(userId);
    if (!result.ok) throwAccountChangeError(result.reason);
    if (result.temporaryPassword === undefined) throw new Error('Missing temporary credential.');
    return {
      account: presentUserAccount(toSummary(result.account)),
      temporaryPassword: result.temporaryPassword,
    };
  }

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

  @Post(':userId/session-revocations')
  @RequirePermission('users:manage')
  @ApiOperation({ operationId: 'revokeCollaboratorSessions' })
  @ApiCreatedResponse({ description: 'Las sesiones activas quedaron revocadas.' })
  @ApiNotFoundResponse({ description: 'La cuenta no existe.' })
  async revokeSessions(
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
  ): Promise<void> {
    const result = await this.revokeCollaboratorSessions.execute(userId);
    if (result === 'user-not-found') throwAccountChangeError('account-not-found');
  }
}

function toSummary(account: UserAccount): UserAccountSummary {
  const values = account.toPrimitives();
  if (values.profileId !== ADMINISTRATOR_PROFILE_ID && values.profileId !== EMPLOYEE_PROFILE_ID) {
    throw new Error('Unsupported access profile.');
  }
  return {
    id: values.id,
    username: values.usernameNormalized,
    profile: values.profileId === ADMINISTRATOR_PROFILE_ID ? 'administrator' : 'employee',
    status: values.status,
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  };
}

function throwAccountChangeError(
  reason: 'account-not-found' | 'account-already-active' | 'conflict',
): never {
  if (reason === 'account-not-found') {
    throw new NotFoundException({
      type: 'https://nova.example/problems/user-not-found',
      title: 'La cuenta no existe',
      status: 404,
      detail: 'No se encontró la cuenta indicada.',
      code: 'USER_NOT_FOUND',
    });
  }
  throw new ConflictException({
    type: 'https://nova.example/problems/user-status-conflict',
    title: 'No se pudo cambiar el estado de la cuenta',
    status: 409,
    detail:
      reason === 'account-already-active'
        ? 'La cuenta ya está activa.'
        : 'La cuenta cambió mientras se procesaba la solicitud.',
    code: reason === 'account-already-active' ? 'USER_ALREADY_ACTIVE' : 'USER_UPDATE_CONFLICT',
  });
}
