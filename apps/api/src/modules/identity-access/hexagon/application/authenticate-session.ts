import type { AuthenticationClock } from './authentication-dependencies';
import type { AuthenticatedSessions } from './authenticated-sessions';
import type { SessionCredentialProtector } from './session-credentials';

export interface AuthenticatedActor {
  sessionId: string;
  userId: string;
  username: string;
  securityVersion: number;
  permissionCodes: string[];
  requiresPasswordChange: boolean;
}

export type AuthenticateSessionResult =
  { ok: false } | { ok: true; actor: AuthenticatedActor; renewedUntil: Date | null };

export class AuthenticateSession {
  constructor(
    private readonly sessions: AuthenticatedSessions,
    private readonly credentials: SessionCredentialProtector,
    private readonly clock: AuthenticationClock,
  ) {}

  async execute(secret: string | null): Promise<AuthenticateSessionResult> {
    if (secret === null || secret.length === 0) return { ok: false };

    const record = await this.sessions.findByProtectedCredential(this.credentials.protect(secret));
    if (record === null) return { ok: false };

    const now = this.clock.now();
    const session = record.session.toPrimitives();
    const identity = record.identity;
    if (
      !record.session.acceptsCredentialAt(now) ||
      identity.accountStatus === 'inactive' ||
      !identity.profileIsActive ||
      session.issuedSecurityVersion !== identity.securityVersion
    ) {
      return { ok: false };
    }

    const renewed = record.session.renewCredential(now);
    if (renewed) await this.sessions.renew(record.session);

    return {
      ok: true,
      actor: {
        sessionId: session.id,
        userId: identity.userId,
        username: identity.usernameNormalized,
        securityVersion: identity.securityVersion,
        permissionCodes: identity.accountStatus === 'active' ? [...identity.permissionCodes] : [],
        requiresPasswordChange: identity.accountStatus === 'password-change-required',
      },
      renewedUntil: renewed ? record.session.toPrimitives().credentialExpiresAt : null,
    };
  }
}
