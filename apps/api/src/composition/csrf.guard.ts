import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { sessionCookieName } from '../modules/identity-access/adapters/driving/http/session-cookie';
import { readSessionSecret } from '../modules/identity-access/adapters/driving/http/session-request';
import type { Environment } from './environment';
import { CsrfTokens } from './csrf-tokens';

const CSRF_EXEMPT_METADATA = 'nova.csrf-token-exempt';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const CsrfTokenExempt = (): MethodDecorator => SetMetadata(CSRF_EXEMPT_METADATA, true);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Environment, true>,
    private readonly tokens: CsrfTokens,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const origin = this.config.getOrThrow<string>('FRONTEND_ORIGIN');
    if (request.get('origin') !== origin || request.get('sec-fetch-site') === 'cross-site') {
      throw csrfForbidden();
    }
    if (
      this.reflector.getAllAndOverride<boolean>(CSRF_EXEMPT_METADATA, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;

    const environment = this.config.getOrThrow<Environment['NODE_ENV']>('NODE_ENV');
    const secret = readSessionSecret(request, sessionCookieName(environment));
    const cookieToken = readCookie(request.headers.cookie, csrfCookieName(environment));
    const headerToken = request.get('x-csrf-token');
    if (
      secret === null ||
      cookieToken === null ||
      headerToken === undefined ||
      cookieToken !== headerToken ||
      !this.tokens.verifies(secret, headerToken)
    ) {
      throw csrfForbidden();
    }
    return true;
  }
}

export function csrfCookieName(environment: Environment['NODE_ENV']): string {
  return environment === 'production' ? '__Host-nova-csrf' : 'nova-csrf';
}

function readCookie(header: string | undefined, name: string): string | null {
  if (header === undefined) return null;
  const part = header
    .split(';')
    .find((value) => value.slice(0, value.indexOf('=')).trim() === name);
  return part === undefined ? null : part.slice(part.indexOf('=') + 1);
}

function csrfForbidden(): ForbiddenException {
  return new ForbiddenException({
    type: 'https://nova.example/problems/csrf-rejected',
    title: 'Solicitud rechazada por seguridad',
    status: 403,
    detail: 'El origen o token CSRF no es válido.',
    code: 'CSRF_REJECTED',
  });
}
