import { describe, expect, it } from 'vitest';

import { UserAccount } from './user-account';

describe('UserAccount', () => {
  it('requires changing a temporary credential before business access', () => {
    const account = createAccount();

    expect(account.canAuthenticate()).toBe(true);
    expect(account.requiresPasswordChange()).toBe(true);
  });

  it('increments its security version when establishing a personal credential', () => {
    const account = createAccount();
    const changedAt = new Date('2026-08-27T04:00:00.000Z');

    account.establishPersonalCredential('new-protected-credential', changedAt);

    expect(account.toPrimitives()).toMatchObject({
      credentialHash: 'new-protected-credential',
      status: 'active',
      securityVersion: 2,
      updatedAt: changedAt,
    });
  });

  it('revokes prior security versions when deactivated', () => {
    const account = createAccount();

    account.deactivate(new Date('2026-08-27T04:00:00.000Z'));

    expect(account.canAuthenticate()).toBe(false);
    expect(account.toPrimitives().securityVersion).toBe(2);
  });
});

function createAccount(): UserAccount {
  return UserAccount.createWithTemporaryCredential({
    id: '0198f9c2-7e00-7000-8000-000000000001',
    profileId: '0198f9c2-7e00-7000-8000-000000000002',
    usernameNormalized: 'kendall',
    credentialHash: 'protected-credential',
    now: new Date('2026-08-27T03:00:00.000Z'),
  });
}
