import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import type { Environment } from '../../../../../composition/environment';
import { csrfCookieName } from '../../../../../composition/csrf.guard';
import { CsrfTokens } from '../../../../../composition/csrf-tokens';
import {
  AuthenticateSession,
  type AuthenticatedActor,
} from '../../../hexagon/application/authenticate-session';
import { hasPermission } from '../../../hexagon/domain/authorization';
import { sessionCookieDefinition, sessionCookieName } from './session-cookie';
import { readSessionSecret } from './session-request';
import { REQUIRED_PERMISSION_METADATA } from './require-permission';

export interface AuthenticatedRequest extends Request {
  novaActor?: AuthenticatedActor;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authenticateSession: AuthenticateSession,
    private readonly config: ConfigService<Environment, true>,
    private readonly csrfTokens: CsrfTokens,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRED_PERMISSION_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (permission === undefined) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const environment = this.config.getOrThrow<Environment['NODE_ENV']>('NODE_ENV');
    const secret = readSessionSecret(request, sessionCookieName(environment));
    const authenticated = await this.authenticateSession.execute(secret);
    if (!authenticated.ok) {
      throw new UnauthorizedException({
        type: 'https://nova.example/problems/invalid-session',
        title: 'Se requiere una sesión válida',
        status: 401,
        detail: 'Inicia sesión para continuar.',
        code: 'INVALID_SESSION',
      });
    }
    if (!hasPermission(authenticated.actor, permission)) {
      throw new ForbiddenException({
        type: 'https://nova.example/problems/permission-denied',
        title: 'No tienes permiso para esta operación',
        status: 403,
        detail: 'Tu perfil no posee la capacidad requerida.',
        code: 'PERMISSION_DENIED',
      });
    }

    request.novaActor = authenticated.actor;
    if (authenticated.renewedUntil !== null && secret !== null) {
      const cookie = sessionCookieDefinition(environment, authenticated.renewedUntil);
      response.cookie(cookie.name, secret, cookie.options);
      response.cookie(csrfCookieName(environment), this.csrfTokens.issue(secret), {
        expires: authenticated.renewedUntil,
        httpOnly: false,
        path: '/',
        sameSite: 'strict',
        secure: environment === 'production',
      });
    }
    return true;
  }
}
