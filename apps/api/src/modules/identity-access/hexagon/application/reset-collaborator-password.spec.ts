import { describe, expect, it } from 'vitest';

import { UserAccount } from '../domain/user-account';
import type { CredentialProtector } from './credential-protector';
import { ResetCollaboratorPassword } from './reset-collaborator-password';
import type { UserAccountRepository } from './user-account.repository';

class FakeAccounts implements UserAccountRepository {
  saved = false;

  constructor(private readonly account: UserAccount | null) {}

  findById(): Promise<UserAccount | null> {
    return Promise.resolve(this.account);
  }

  savePersonalCredentialAndRevokeSessions(): Promise<boolean> {
    return Promise.resolve(false);
  }

  saveTemporaryCredentialAndRevokeSessions(): Promise<boolean> {
    this.saved = true;
    return Promise.resolve(true);
  }
}

describe('ResetCollaboratorPassword', () => {
  it('replaces the credential, requires a personal password and revokes previous access', async () => {
    const accounts = new FakeAccounts(activeAccount());

    await expect(createInteractor(accounts).execute('user-1')).resolves.toEqual({
      ok: true,
      temporaryPassword: 'temporal-segura-123',
    });
    expect(accounts.saved).toBe(true);
    expect((await accounts.findById())?.toPrimitives()).toMatchObject({
      credentialHash: 'protected:temporal-segura-123',
      status: 'password-change-required',
      securityVersion: 4,
      updatedAt: new Date('2026-09-07T12:00:00.000Z'),
    });
  });

  it('does not reset an inactive account', async () => {
    const account = UserAccount.restore({
      ...activeAccount().toPrimitives(),
      status: 'inactive',
    });
    const accounts = new FakeAccounts(account);

    await expect(createInteractor(accounts).execute('user-1')).resolves.toEqual({
      ok: false,
      reason: 'account-inactive',
    });
    expect(accounts.saved).toBe(false);
  });

  it('reports an unknown account without generating persisted state', async () => {
    await expect(createInteractor(new FakeAccounts(null)).execute('missing')).resolves.toEqual({
      ok: false,
      reason: 'account-not-found',
    });
  });
});

function createInteractor(accounts: UserAccountRepository): ResetCollaboratorPassword {
  const credentials: CredentialProtector = {
    protect: (value) => Promise.resolve(`protected:${value}`),
    matches: () => Promise.resolve(false),
    needsRefresh: () => false,
  };
  return new ResetCollaboratorPassword(
    accounts,
    credentials,
    { generate: () => 'temporal-segura-123' },
    { now: () => new Date('2026-09-07T12:00:00.000Z') },
  );
}

function activeAccount(): UserAccount {
  return UserAccount.restore({
    id: 'user-1',
    profileId: 'profile-1',
    usernameNormalized: 'empleado1',
    credentialHash: 'old-hash',
    status: 'active',
    securityVersion: 3,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}
