import { Controller, Delete, Get, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import type { Environment } from '../../../../../composition/environment';
import { AuthenticateSession } from '../../../hexagon/application/authenticate-session';
import { CloseCurrentSession } from '../../../hexagon/application/close-current-session';
import { CurrentActorResponse } from './current-session.dto';
import { sessionCookieDefinition, sessionCookieName } from './session-cookie';
import { readSessionSecret } from './session-request';

@ApiTags('authentication')
@Controller('auth')
export class CurrentSessionController {
  constructor(
    private readonly authenticateSession: AuthenticateSession,
    private readonly closeCurrentSession: CloseCurrentSession,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Get('me')
  @ApiOperation({ operationId: 'getCurrentActor' })
  @ApiOkResponse({ type: CurrentActorResponse })
  async me(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentActorResponse> {
    const environment = this.config.getOrThrow<Environment['NODE_ENV']>('NODE_ENV');
    const secret = readSessionSecret(request, sessionCookieName(environment));
    const result = await this.authenticateSession.execute(secret);
    if (!result.ok) throw new UnauthorizedException('La sesión no es válida.');

    if (result.renewedUntil !== null && secret !== null) {
      const cookie = sessionCookieDefinition(environment, result.renewedUntil);
      response.cookie(cookie.name, secret, cookie.options);
    }
    return {
      userId: result.actor.userId,
      username: result.actor.username,
      permissionCodes: result.actor.permissionCodes,
      requiresPasswordChange: result.actor.requiresPasswordChange,
    };
  }

  @Delete('sessions/current')
  @ApiOperation({ operationId: 'closeCurrentSession' })
  @ApiNoContentResponse()
  async close(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const environment = this.config.getOrThrow<Environment['NODE_ENV']>('NODE_ENV');
    const result = await this.authenticateSession.execute(
      readSessionSecret(request, sessionCookieName(environment)),
    );
    if (result.ok) await this.closeCurrentSession.execute(result.actor.sessionId);

    response.clearCookie(sessionCookieName(environment), {
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
      secure: environment === 'production',
    });
    response.status(204);
  }
}
