import { describe, expect, it } from 'vitest';

import { UserAccount } from '../domain/user-account';
import type { CredentialProtector } from './credential-protector';
import { EstablishPersonalPassword } from './establish-personal-password';
import type { UserAccountRepository } from './user-account.repository';

class FakeAccounts implements UserAccountRepository {
  account: UserAccount | null = createTemporaryAccount();
  saved: UserAccount | null = null;

  findById(): Promise<UserAccount | null> {
    return Promise.resolve(this.account);
  }

  savePersonalCredentialAndRevokeSessions(account: UserAccount): Promise<boolean> {
    this.saved = account;
    return Promise.resolve(true);
  }
}

describe('EstablishPersonalPassword', () => {
  it('replaces a temporary credential and increments the security version', async () => {
    const accounts = new FakeAccounts();
    const result = await createInteractor(accounts).execute({
      userId: 'user-id',
      newPassword: 'una frase personal segura',
    });

    expect(result).toEqual({ ok: true });
    expect(accounts.saved?.toPrimitives()).toMatchObject({
      credentialHash: 'protected:una frase personal segura',
      status: 'active',
      securityVersion: 2,
    });
  });

  it('rejects a weak password without changing the account', async () => {
    const accounts = new FakeAccounts();
    const result = await createInteractor(accounts).execute({
      userId: 'user-id',
      newPassword: 'corta',
    });

    expect(result).toMatchObject({ ok: false, reason: 'invalid-password' });
    expect(accounts.saved).toBeNull();
  });

  it('does not establish another password when the credential is already personal', async () => {
    const accounts = new FakeAccounts();
    accounts.account?.establishPersonalCredential('personal', new Date('2026-08-27T06:00:00Z'));

    expect(
      await createInteractor(accounts).execute({
        userId: 'user-id',
        newPassword: 'otra frase segura',
      }),
    ).toEqual({ ok: false, reason: 'not-temporary' });
  });
});

function createInteractor(accounts: UserAccountRepository): EstablishPersonalPassword {
  const credentials: CredentialProtector = {
    protect: (value) => Promise.resolve(`protected:${value}`),
    matches: () => Promise.resolve(false),
    needsRefresh: () => false,
  };
  return new EstablishPersonalPassword(accounts, credentials, {
    now: () => new Date('2026-08-27T06:00:00Z'),
  });
}

function createTemporaryAccount(): UserAccount {
  return UserAccount.createWithTemporaryCredential({
    id: 'user-id',
    profileId: 'profile-id',
    usernameNormalized: 'admin',
    credentialHash: 'temporary',
    now: new Date('2026-08-27T05:00:00Z'),
  });
}
