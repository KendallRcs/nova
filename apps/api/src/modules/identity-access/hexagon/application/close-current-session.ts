import type { AuthenticationClock } from './authentication-dependencies';
import type { ClosableSessions } from './closable-sessions';

export class CloseCurrentSession {
  constructor(
    private readonly sessions: ClosableSessions,
    private readonly clock: AuthenticationClock,
  ) {}

  async execute(sessionId: string): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    if (session === null) return;

    session.close(this.clock.now());
    await this.sessions.saveClosed(session);
  }
}
