import { Body, Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import type { Environment } from '../../../../../composition/environment';
import { CsrfTokenExempt } from '../../../../../composition/csrf.guard';
import { CsrfTokens } from '../../../../../composition/csrf-tokens';
import { csrfCookieName } from '../../../../../composition/csrf.guard';
import { StartSession } from '../../../hexagon/application/start-session';
import { StartSessionRequest, StartSessionResponse } from './session.dto';
import { sessionCookieDefinition } from './session-cookie';

@ApiTags('authentication')
@Controller('auth/sessions')
export class SessionsController {
  constructor(
    private readonly startSession: StartSession,
    private readonly config: ConfigService<Environment, true>,
    private readonly csrfTokens: CsrfTokens,
  ) {}

  @Post()
  @CsrfTokenExempt()
  @ApiOperation({ operationId: 'startSession' })
  @ApiCreatedResponse({ type: StartSessionResponse })
  @ApiUnauthorizedResponse({ description: 'Usuario o contraseña incorrectos.' })
  async create(
    @Body() request: StartSessionRequest,
    @Req() httpRequest: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StartSessionResponse> {
    const result = await this.startSession.execute({
      username: request.username,
      password: request.password,
      metadata: sessionMetadata(httpRequest),
    });

    if (!result.ok) {
      throw new UnauthorizedException({
        type: 'https://nova.example/problems/invalid-credentials',
        title: 'No se pudo iniciar sesión',
        status: 401,
        detail: 'El usuario o la contraseña son incorrectos.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const cookie = sessionCookieDefinition(
      this.config.getOrThrow('NODE_ENV'),
      result.credentialExpiresAt,
    );
    response.cookie(cookie.name, result.sessionSecret, cookie.options);
    response.cookie(
      csrfCookieName(this.config.getOrThrow<Environment['NODE_ENV']>('NODE_ENV')),
      this.csrfTokens.issue(result.sessionSecret),
      {
        httpOnly: false,
        path: '/',
        sameSite: 'strict',
        secure: this.config.getOrThrow<Environment['NODE_ENV']>('NODE_ENV') === 'production',
        expires: result.credentialExpiresAt,
      },
    );

    return { actor: result.actor };
  }
}

function sessionMetadata(request: Request): Record<string, string> | null {
  const metadata: Record<string, string> = {};
  const userAgent = request.get('user-agent');

  if (request.ip !== undefined) {
    metadata.ip = request.ip;
  }

  if (userAgent !== undefined) {
    metadata.userAgent = userAgent;
  }

  return Object.keys(metadata).length === 0 ? null : metadata;
}
