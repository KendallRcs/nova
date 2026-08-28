import { describe, expect, it } from 'vitest';

import { Session } from '../domain/session';
import { CloseCurrentSession } from './close-current-session';
import type { ClosableSessions } from './closable-sessions';

describe('CloseCurrentSession', () => {
  it('closes only the selected session', async () => {
    const sessions = new FakeClosableSessions();
    await new CloseCurrentSession(sessions, {
      now: () => new Date('2026-08-27T08:00:00Z'),
    }).execute('session-id');

    expect(sessions.saved?.toPrimitives()).toMatchObject({
      id: 'session-id',
      status: 'closed',
      endedAt: new Date('2026-08-27T08:00:00Z'),
      endReason: 'user-logout',
    });
  });
});

class FakeClosableSessions implements ClosableSessions {
  saved: Session | null = null;

  findById(id: string): Promise<Session | null> {
    return Promise.resolve(
      Session.start({
        id,
        userId: 'user-id',
        protectedCredential: 'protected',
        issuedSecurityVersion: 1,
        metadata: null,
        now: new Date('2026-08-27T07:00:00Z'),
      }),
    );
  }

  saveClosed(session: Session): Promise<boolean> {
    this.saved = session;
    return Promise.resolve(true);
  }
}
