import type { UserAccount } from '../domain/user-account';
import type { AuthenticationClock } from './authentication-dependencies';
import type { CredentialProtector } from './credential-protector';
import type { TemporaryCredentialGenerator } from './temporary-credential-generator';
import type { UserAccountAdministration } from './user-account-administration';

export type ChangeAccountStatusResult =
  | { readonly ok: true; readonly account: UserAccount; readonly temporaryPassword?: string }
  | {
      readonly ok: false;
      readonly reason: 'account-not-found' | 'account-already-active' | 'conflict';
    };

export class DeactivateCollaboratorAccount {
  constructor(
    private readonly accounts: UserAccountAdministration,
    private readonly clock: AuthenticationClock,
  ) {}

  async execute(userId: string): Promise<ChangeAccountStatusResult> {
    const account = await this.accounts.findById(userId);
    if (account === null) return { ok: false, reason: 'account-not-found' };
    if (account.isInactive()) return { ok: true, account };

    const now = this.clock.now();
    account.deactivate(now);
    const saved = await this.accounts.saveDeactivationAndRevokeSessions(account, now);
    return saved ? { ok: true, account } : { ok: false, reason: 'conflict' };
  }
}

export class ReactivateCollaboratorAccount {
  constructor(
    private readonly accounts: UserAccountAdministration,
    private readonly credentials: CredentialProtector,
    private readonly temporaryCredentials: TemporaryCredentialGenerator,
    private readonly clock: AuthenticationClock,
  ) {}

  async execute(userId: string): Promise<ChangeAccountStatusResult> {
    const account = await this.accounts.findById(userId);
    if (account === null) return { ok: false, reason: 'account-not-found' };
    if (!account.isInactive()) return { ok: false, reason: 'account-already-active' };

    const temporaryPassword = this.temporaryCredentials.generate();
    const now = this.clock.now();
    account.reactivateWithTemporaryCredential(
      await this.credentials.protect(temporaryPassword),
      now,
    );
    const saved = await this.accounts.saveReactivationAndRevokeSessions(account, now);
    return saved ? { ok: true, account, temporaryPassword } : { ok: false, reason: 'conflict' };
  }
}
