import type { AuthenticationClock } from './authentication-dependencies';
import type { CredentialProtector } from './credential-protector';
import type { TemporaryCredentialGenerator } from './temporary-credential-generator';
import type { UserAccountRepository } from './user-account.repository';

export type ResetCollaboratorPasswordResult =
  | { readonly ok: true; readonly temporaryPassword: string }
  | { readonly ok: false; readonly reason: 'account-not-found' | 'account-inactive' | 'conflict' };

export class ResetCollaboratorPassword {
  constructor(
    private readonly accounts: UserAccountRepository,
    private readonly credentials: CredentialProtector,
    private readonly temporaryCredentials: TemporaryCredentialGenerator,
    private readonly clock: AuthenticationClock,
  ) {}

  async execute(userId: string): Promise<ResetCollaboratorPasswordResult> {
    const account = await this.accounts.findById(userId);
    if (account === null) return { ok: false, reason: 'account-not-found' };
    if (!account.canAuthenticate()) return { ok: false, reason: 'account-inactive' };

    const temporaryPassword = this.temporaryCredentials.generate();
    const now = this.clock.now();
    const changed = account.resetTemporaryCredential(
      await this.credentials.protect(temporaryPassword),
      now,
    );
    if (!changed) return { ok: false, reason: 'account-inactive' };

    const saved = await this.accounts.saveTemporaryCredentialAndRevokeSessions(account, now);
    return saved ? { ok: true, temporaryPassword } : { ok: false, reason: 'conflict' };
  }
}
