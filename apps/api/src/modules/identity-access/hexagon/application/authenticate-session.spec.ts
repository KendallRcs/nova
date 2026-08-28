import { describe, expect, it } from 'vitest';

import { Session } from '../domain/session';
import { AuthenticateSession } from './authenticate-session';
import type { AuthenticatedSessions } from './authenticated-sessions';

describe('AuthenticateSession', () => {
  it('authenticates a valid session and preserves business permissions', async () => {
    const sessions = fakeSessions(1);
    const result = await new AuthenticateSession(
      sessions,
      { protect: (secret) => `protected:${secret}` },
      { now: () => new Date('2026-08-27T06:00:00Z') },
    ).execute('opaque');

    expect(result).toMatchObject({
      ok: true,
      actor: { userId: 'user-id', permissionCodes: ['users:manage'] },
    });
  });

  it('rejects a session issued with an obsolete security version', async () => {
    const result = await new AuthenticateSession(
      fakeSessions(2),
      { protect: (secret) => `protected:${secret}` },
      { now: () => new Date('2026-08-27T06:00:00Z') },
    ).execute('opaque');

    expect(result).toEqual({ ok: false });
  });
});

function fakeSessions(identitySecurityVersion: number): AuthenticatedSessions {
  const session = Session.start({
    id: 'session-id',
    userId: 'user-id',
    protectedCredential: 'protected:opaque',
    issuedSecurityVersion: 1,
    metadata: null,
    now: new Date('2026-08-27T05:00:00Z'),
  });
  return {
    findByProtectedCredential: (credential) =>
      Promise.resolve(
        credential === 'protected:opaque'
          ? {
              session,
              identity: {
                userId: 'user-id',
                usernameNormalized: 'admin',
                credentialHash: 'hash',
                accountStatus: 'active',
                securityVersion: identitySecurityVersion,
                profileIsActive: true,
                permissionCodes: ['users:manage'],
              },
            }
          : null,
      ),
    renew: () => Promise.resolve(),
  };
}
