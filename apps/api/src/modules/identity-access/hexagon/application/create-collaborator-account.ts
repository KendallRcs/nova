import { ADMINISTRATOR_PROFILE_ID, EMPLOYEE_PROFILE_ID } from '../domain/access-policy';
import { UserAccount } from '../domain/user-account';
import { normalizeUsername } from '../domain/username';
import type { AuthenticationClock, AuthenticationIdGenerator } from './authentication-dependencies';
import type { CredentialProtector } from './credential-protector';
import type { TemporaryCredentialGenerator } from './temporary-credential-generator';
import type { UserAccountAdministration } from './user-account-administration';

export type InitialProfile = 'administrator' | 'employee';
export type CreateCollaboratorAccountResult =
  | { readonly ok: true; readonly account: UserAccount; readonly temporaryPassword: string }
  | { readonly ok: false; readonly reason: 'invalid-username' };

export class CreateCollaboratorAccount {
  constructor(
    private readonly accounts: UserAccountAdministration,
    private readonly credentials: CredentialProtector,
    private readonly temporaryCredentials: TemporaryCredentialGenerator,
    private readonly idGenerator: AuthenticationIdGenerator,
    private readonly clock: AuthenticationClock,
  ) {}

  async execute(input: {
    username: string;
    profile: InitialProfile;
  }): Promise<CreateCollaboratorAccountResult> {
    const username = normalizeUsername(input.username);
    if (!username.ok) return { ok: false, reason: 'invalid-username' };

    const temporaryPassword = this.temporaryCredentials.generate();
    const now = this.clock.now();
    const account = UserAccount.createWithTemporaryCredential({
      id: this.idGenerator.generate(),
      profileId: input.profile === 'administrator' ? ADMINISTRATOR_PROFILE_ID : EMPLOYEE_PROFILE_ID,
      usernameNormalized: username.value,
      credentialHash: await this.credentials.protect(temporaryPassword),
      now,
    });
    await this.accounts.create(account);

    return { ok: true, account, temporaryPassword };
  }
}
