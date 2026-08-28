import { validatePersonalPassword } from '../domain/password-policy';
import type { AuthenticationClock } from './authentication-dependencies';
import type { CredentialProtector } from './credential-protector';
import type { UserAccountRepository } from './user-account.repository';

export type EstablishPersonalPasswordResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'account-unavailable' | 'not-temporary' | 'invalid-password' | 'conflict';
      violations?: string[];
    };

export class EstablishPersonalPassword {
  constructor(
    private readonly accounts: UserAccountRepository,
    private readonly credentials: CredentialProtector,
    private readonly clock: AuthenticationClock,
  ) {}

  async execute(input: {
    userId: string;
    newPassword: string;
  }): Promise<EstablishPersonalPasswordResult> {
    const account = await this.accounts.findById(input.userId);
    if (!account?.canAuthenticate()) return { ok: false, reason: 'account-unavailable' };
    if (!account.requiresPasswordChange()) return { ok: false, reason: 'not-temporary' };

    const values = account.toPrimitives();
    const policy = validatePersonalPassword(input.newPassword, values.usernameNormalized);
    if (!policy.ok) return { ok: false, reason: 'invalid-password', violations: policy.violations };

    const now = this.clock.now();
    account.establishPersonalCredential(await this.credentials.protect(input.newPassword), now);
    return (await this.accounts.savePersonalCredentialAndRevokeSessions(account, now))
      ? { ok: true }
      : { ok: false, reason: 'conflict' };
  }
}
