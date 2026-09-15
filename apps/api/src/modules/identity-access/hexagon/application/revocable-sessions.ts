import type { AuthenticationClock } from './authentication-dependencies';

export interface RevocableSessions {
  revokeAllForUser(userId: string, revokedAt: Date): Promise<'revoked' | 'user-not-found'>;
}

export class RevokeCollaboratorSessions {
  constructor(
    private readonly sessions: RevocableSessions,
    private readonly clock: AuthenticationClock,
  ) {}

  execute(userId: string): Promise<'revoked' | 'user-not-found'> {
    return this.sessions.revokeAllForUser(userId, this.clock.now());
  }
}
