import { describe, expect, it } from 'vitest';

import { EMPLOYEE_PROFILE_ID } from '../domain/access-policy';
import { UserAccount } from '../domain/user-account';
import {
  DeactivateCollaboratorAccount,
  ReactivateCollaboratorAccount,
} from './change-collaborator-account-status';
import { CreateCollaboratorAccount } from './create-collaborator-account';
import type { CredentialProtector } from './credential-protector';
import type { UserAccountAdministration } from './user-account-administration';

class FakeAdministration implements UserAccountAdministration {
  account: UserAccount | null = null;
  revokedFor: 'deactivation' | 'reactivation' | null = null;

  findById(): Promise<UserAccount | null> {
    return Promise.resolve(this.account);
  }

  create(account: UserAccount): Promise<void> {
    this.account = account;
    return Promise.resolve();
  }

  saveDeactivationAndRevokeSessions(): Promise<boolean> {
    this.revokedFor = 'deactivation';
    return Promise.resolve(true);
  }

  saveReactivationAndRevokeSessions(): Promise<boolean> {
    this.revokedFor = 'reactivation';
    return Promise.resolve(true);
  }
}

const clock = { now: () => new Date('2026-09-15T12:00:00.000Z') };
const credentials: CredentialProtector = {
  protect: (value) => Promise.resolve(`protected:${value}`),
  matches: () => Promise.resolve(false),
  needsRefresh: () => false,
};
const temporaryCredentials = { generate: () => 'temporary-safe-123' };

describe('collaborator account administration', () => {
  it('creates an employee with a temporary credential', async () => {
    const accounts = new FakeAdministration();
    const create = new CreateCollaboratorAccount(
      accounts,
      credentials,
      temporaryCredentials,
      { generate: () => 'user-1' },
      clock,
    );

    const result = await create.execute({ username: ' Empleado 1 ', profile: 'employee' });

    expect(result.ok && result.temporaryPassword).toBe('temporary-safe-123');
    expect(accounts.account?.toPrimitives()).toMatchObject({
      id: 'user-1',
      profileId: EMPLOYEE_PROFILE_ID,
      usernameNormalized: 'empleado 1',
      credentialHash: 'protected:temporary-safe-123',
      status: 'password-change-required',
    });
  });

  it('deactivates idempotently and revokes sessions only on the transition', async () => {
    const accounts = new FakeAdministration();
    accounts.account = activeAccount();
    const deactivate = new DeactivateCollaboratorAccount(accounts, clock);

    await expect(deactivate.execute('user-1')).resolves.toMatchObject({ ok: true });
    expect(accounts.revokedFor).toBe('deactivation');
    accounts.revokedFor = null;
    await expect(deactivate.execute('user-1')).resolves.toMatchObject({ ok: true });
    expect(accounts.revokedFor).toBeNull();
  });

  it('reactivates with a new temporary credential without restoring old sessions', async () => {
    const accounts = new FakeAdministration();
    accounts.account = activeAccount();
    accounts.account.deactivate(new Date('2026-09-14T12:00:00.000Z'));
    const reactivate = new ReactivateCollaboratorAccount(
      accounts,
      credentials,
      temporaryCredentials,
      clock,
    );

    const result = await reactivate.execute('user-1');

    expect(result).toMatchObject({ ok: true, temporaryPassword: 'temporary-safe-123' });
    expect(accounts.revokedFor).toBe('reactivation');
    expect(accounts.account.toPrimitives()).toMatchObject({
      status: 'password-change-required',
      securityVersion: 5,
      credentialHash: 'protected:temporary-safe-123',
    });
  });
});

function activeAccount(): UserAccount {
  return UserAccount.restore({
    id: 'user-1',
    profileId: EMPLOYEE_PROFILE_ID,
    usernameNormalized: 'empleado1',
    credentialHash: 'hash',
    status: 'active',
    securityVersion: 3,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}
