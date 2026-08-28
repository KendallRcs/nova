import {
  Body,
  ConflictException,
  Controller,
  Put,
  Req,
  Res,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import type { Environment } from '../../../../../composition/environment';
import { AuthenticateSession } from '../../../hexagon/application/authenticate-session';
import { EstablishPersonalPassword } from '../../../hexagon/application/establish-personal-password';
import { EstablishPersonalPasswordRequest } from './password.dto';
import { sessionCookieName } from './session-cookie';
import { readSessionSecret } from './session-request';
import { csrfCookieName } from '../../../../../composition/csrf.guard';

@ApiTags('authentication')
@Controller('auth/password')
export class PasswordController {
  constructor(
    private readonly authenticateSession: AuthenticateSession,
    private readonly establishPassword: EstablishPersonalPassword,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Put()
  @ApiOperation({ operationId: 'establishPersonalPassword' })
  @ApiNoContentResponse({ description: 'Contraseña establecida; las sesiones fueron revocadas.' })
  async establish(
    @Body() request: EstablishPersonalPasswordRequest,
    @Req() httpRequest: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const environment = this.config.getOrThrow<Environment['NODE_ENV']>('NODE_ENV');
    const authenticated = await this.authenticateSession.execute(
      readSessionSecret(httpRequest, sessionCookieName(environment)),
    );
    if (!authenticated.ok) throw new UnauthorizedException('La sesión no es válida.');

    const result = await this.establishPassword.execute({
      userId: authenticated.actor.userId,
      newPassword: request.newPassword,
    });
    if (!result.ok) {
      if (result.reason === 'invalid-password') {
        throw new UnprocessableEntityException({
          type: 'https://nova.example/problems/invalid-password',
          title: 'La contraseña no cumple la política',
          status: 422,
          detail: 'Usa al menos diez caracteres y no repitas tu nombre de usuario.',
          code: 'INVALID_PASSWORD',
          violations: result.violations,
        });
      }
      if (result.reason === 'not-temporary') {
        throw new ConflictException('La cuenta ya posee una contraseña personal.');
      }
      throw new UnauthorizedException('La cuenta ya no está disponible.');
    }

    response.clearCookie(sessionCookieName(environment), {
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
      secure: environment === 'production',
    });
    response.clearCookie(csrfCookieName(environment), {
      httpOnly: false,
      path: '/',
      sameSite: 'strict',
      secure: environment === 'production',
    });
    response.status(204);
  }
}
