import { describe, expect, it } from 'vitest';

import type { Session } from '../domain/session';
import type { AuthenticationClock, AuthenticationIdGenerator } from './authentication-dependencies';
import type { AuthenticationIdentities, AuthenticationIdentity } from './authentication-identity';
import type { CredentialProtector } from './credential-protector';
import type { SessionCredentialProtector, SessionSecretGenerator } from './session-credentials';
import type { SessionRepository } from './session.repository';
import { StartSession } from './start-session';

class FakeIdentities implements AuthenticationIdentities {
  constructor(private readonly identity: AuthenticationIdentity | null) {}

  findByUsername(): Promise<AuthenticationIdentity | null> {
    return Promise.resolve(this.identity);
  }
}

class FakeSessions implements SessionRepository {
  readonly saved: Session[] = [];

  save(session: Session): Promise<void> {
    this.saved.push(session);
    return Promise.resolve();
  }
}

const credentials: CredentialProtector = {
  protect: () => Promise.resolve('protected-password'),
  matches: (plain, protectedCredential) =>
    Promise.resolve(plain === 'correct-password' && protectedCredential === 'stored-hash'),
  needsRefresh: () => false,
};
const secretGenerator: SessionSecretGenerator = { generate: () => 'raw-session-secret' };
const sessionCredentialProtector: SessionCredentialProtector = {
  protect: () => 'protected-session-secret',
};
const idGenerator: AuthenticationIdGenerator = {
  generate: () => '0198f9c2-7e00-7000-8000-000000000010',
};
const clock: AuthenticationClock = {
  now: () => new Date('2026-08-27T04:00:00.000Z'),
};

describe('StartSession', () => {
  it('starts a session for an active account without exposing its credential hash', async () => {
    const sessions = new FakeSessions();
    const startSession = createStartSession(activeIdentity(), sessions);

    const result = await startSession.execute({
      username: ' KENDALL ',
      password: 'correct-password',
      metadata: { userAgent: 'test' },
    });

    expect(result).toMatchObject({
      ok: true,
      sessionSecret: 'raw-session-secret',
      actor: {
        userId: '0198f9c2-7e00-7000-8000-000000000001',
        username: 'kendall',
        permissionCodes: ['catalog.categories.manage'],
        requiresPasswordChange: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('stored-hash');
    expect(sessions.saved).toHaveLength(1);
    expect(sessions.saved[0]?.toPrimitives()).toMatchObject({
      protectedCredential: 'protected-session-secret',
      issuedSecurityVersion: 3,
    });
  });

  it.each([
    ['a missing account', null, 'correct-password'],
    ['an incorrect password', activeIdentity(), 'incorrect-password'],
    [
      'an inactive account',
      { ...activeIdentity(), accountStatus: 'inactive' as const },
      'correct-password',
    ],
    ['an inactive profile', { ...activeIdentity(), profileIsActive: false }, 'correct-password'],
  ])('returns the same rejection for %s', async (_scenario, identity, password) => {
    const sessions = new FakeSessions();
    const startSession = createStartSession(identity, sessions);

    await expect(
      startSession.execute({ username: 'kendall', password, metadata: null }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-credentials' });
    expect(sessions.saved).toHaveLength(0);
  });

  it('allows a temporary credential but withholds business permissions', async () => {
    const temporaryIdentity: AuthenticationIdentity = {
      ...activeIdentity(),
      accountStatus: 'password-change-required',
    };
    const startSession = createStartSession(temporaryIdentity, new FakeSessions());

    const result = await startSession.execute({
      username: 'kendall',
      password: 'correct-password',
      metadata: null,
    });

    expect(result).toMatchObject({
      ok: true,
      actor: { permissionCodes: [], requiresPasswordChange: true },
    });
  });
});

function activeIdentity(): AuthenticationIdentity {
  return {
    userId: '0198f9c2-7e00-7000-8000-000000000001',
    usernameNormalized: 'kendall',
    credentialHash: 'stored-hash',
    accountStatus: 'active',
    securityVersion: 3,
    profileIsActive: true,
    permissionCodes: ['catalog.categories.manage'],
  };
}

function createStartSession(
  identity: AuthenticationIdentity | null,
  sessions: SessionRepository,
): StartSession {
  return new StartSession(
    new FakeIdentities(identity),
    credentials,
    sessions,
    secretGenerator,
    sessionCredentialProtector,
    idGenerator,
    clock,
  );
}
