import { Session } from '../domain/session';
import { normalizeUsername } from '../domain/username';
import type { AuthenticationClock, AuthenticationIdGenerator } from './authentication-dependencies';
import type { AuthenticationIdentities, AuthenticationIdentity } from './authentication-identity';
import type { CredentialProtector } from './credential-protector';
import type { SessionCredentialProtector, SessionSecretGenerator } from './session-credentials';
import type { SessionRepository } from './session.repository';

export interface StartSessionCommand {
  username: string;
  password: string;
  metadata: Record<string, string> | null;
}

export type StartSessionResult =
  | { ok: false; reason: 'invalid-credentials' }
  | {
      ok: true;
      sessionSecret: string;
      credentialExpiresAt: Date;
      actor: {
        userId: string;
        username: string;
        permissionCodes: string[];
        requiresPasswordChange: boolean;
      };
    };

export class StartSession {
  constructor(
    private readonly identities: AuthenticationIdentities,
    private readonly credentials: CredentialProtector,
    private readonly sessions: SessionRepository,
    private readonly secretGenerator: SessionSecretGenerator,
    private readonly sessionCredentialProtector: SessionCredentialProtector,
    private readonly idGenerator: AuthenticationIdGenerator,
    private readonly clock: AuthenticationClock,
  ) {}

  async execute(command: StartSessionCommand): Promise<StartSessionResult> {
    const username = normalizeUsername(command.username);
    const identity = username.ok ? await this.identities.findByUsername(username.value) : null;
    const credentialMatches = await this.credentials.matches(
      command.password,
      identity?.credentialHash ?? null,
    );

    if (!credentialMatches || !isAllowedToStartSession(identity)) {
      return { ok: false, reason: 'invalid-credentials' };
    }

    const now = this.clock.now();
    const sessionSecret = this.secretGenerator.generate();
    const session = Session.start({
      id: this.idGenerator.generate(),
      userId: identity.userId,
      protectedCredential: this.sessionCredentialProtector.protect(sessionSecret),
      issuedSecurityVersion: identity.securityVersion,
      metadata: command.metadata,
      now,
    });
    await this.sessions.save(session);

    return {
      ok: true,
      sessionSecret,
      credentialExpiresAt: session.toPrimitives().credentialExpiresAt,
      actor: {
        userId: identity.userId,
        username: identity.usernameNormalized,
        permissionCodes: identity.accountStatus === 'active' ? [...identity.permissionCodes] : [],
        requiresPasswordChange: identity.accountStatus === 'password-change-required',
      },
    };
  }
}

function isAllowedToStartSession(
  identity: AuthenticationIdentity | null,
): identity is AuthenticationIdentity {
  return identity !== null && identity.accountStatus !== 'inactive' && identity.profileIsActive;
}
