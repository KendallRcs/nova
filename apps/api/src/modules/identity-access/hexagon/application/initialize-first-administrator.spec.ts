import { describe, expect, it } from 'vitest';

import type { UserAccount } from '../domain/user-account';
import { ADMINISTRATOR_PROFILE_ID } from '../domain/access-policy';
import type { CredentialProtector } from './credential-protector';
import type { InitialAccessSetup, InitialAccessSetupResult } from './initial-access-setup';
import { InitializeFirstAdministrator } from './initialize-first-administrator';

class FakeInitialAccessSetup implements InitialAccessSetup {
  account: UserAccount | null = null;
  outcome: InitialAccessSetupResult = 'created';

  initializeAdministrator(account: UserAccount): Promise<InitialAccessSetupResult> {
    this.account = account;
    return Promise.resolve(this.outcome);
  }
}

describe('InitializeFirstAdministrator', () => {
  it('creates the first administrator with a protected temporary credential', async () => {
    const setup = new FakeInitialAccessSetup();
    const initialize = createInteractor(setup);

    const result = await initialize.execute({
      username: ' Admin Principal ',
      temporaryPassword: 'frase temporal segura',
    });

    expect(result).toEqual({
      ok: true,
      outcome: 'created',
      usernameNormalized: 'admin principal',
    });
    expect(setup.account?.toPrimitives()).toMatchObject({
      profileId: ADMINISTRATOR_PROFILE_ID,
      usernameNormalized: 'admin principal',
      credentialHash: 'protected:frase temporal segura',
      status: 'password-change-required',
    });
  });

  it('rejects an invalid temporary password before writing anything', async () => {
    const setup = new FakeInitialAccessSetup();
    const initialize = createInteractor(setup);

    const result = await initialize.execute({ username: 'admin', temporaryPassword: 'corta' });

    expect(result).toEqual({
      ok: false,
      reason: 'invalid-temporary-password',
      violations: ['password-too-short'],
    });
    expect(setup.account).toBeNull();
  });

  it('reports an already initialized installation without creating another account', async () => {
    const setup = new FakeInitialAccessSetup();
    setup.outcome = 'already-initialized';

    const result = await createInteractor(setup).execute({
      username: 'admin',
      temporaryPassword: 'frase temporal segura',
    });

    expect(result).toMatchObject({ ok: true, outcome: 'already-initialized' });
  });
});

function createInteractor(setup: InitialAccessSetup): InitializeFirstAdministrator {
  const credentials: CredentialProtector = {
    protect: (plainCredential) => Promise.resolve(`protected:${plainCredential}`),
    matches: () => Promise.resolve(false),
    needsRefresh: () => false,
  };

  return new InitializeFirstAdministrator(
    setup,
    credentials,
    { generate: () => '0198f9c2-7e00-7000-8000-000000000011' },
    { now: () => new Date('2026-08-27T05:00:00.000Z') },
  );
}
