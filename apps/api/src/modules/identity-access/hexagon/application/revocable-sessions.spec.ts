import { describe, expect, it } from 'vitest';

import { RevokeCollaboratorSessions, type RevocableSessions } from './revocable-sessions';

describe('RevokeCollaboratorSessions', () => {
  it('revokes all sessions at the application clock instant', async () => {
    const calls: { userId: string; revokedAt: Date }[] = [];
    const sessions: RevocableSessions = {
      revokeAllForUser: (userId, revokedAt) => {
        calls.push({ userId, revokedAt });
        return Promise.resolve('revoked');
      },
    };
    const revoke = new RevokeCollaboratorSessions(sessions, {
      now: () => new Date('2026-09-15T14:00:00.000Z'),
    });

    await expect(revoke.execute('user-1')).resolves.toBe('revoked');
    expect(calls).toEqual([{ userId: 'user-1', revokedAt: new Date('2026-09-15T14:00:00.000Z') }]);
  });
});
