import { validatePersonalPassword } from '../domain/password-policy';
import { UserAccount } from '../domain/user-account';
import { normalizeUsername } from '../domain/username';
import { ADMINISTRATOR_PROFILE_ID } from '../domain/access-policy';
import type { AuthenticationClock, AuthenticationIdGenerator } from './authentication-dependencies';
import type { CredentialProtector } from './credential-protector';
import type { InitialAccessSetup, InitialAccessSetupResult } from './initial-access-setup';

export type InitializeFirstAdministratorResult =
  | { ok: true; outcome: InitialAccessSetupResult; usernameNormalized: string }
  | {
      ok: false;
      reason: 'invalid-username' | 'invalid-temporary-password';
      violations?: string[];
    };

export class InitializeFirstAdministrator {
  constructor(
    private readonly setup: InitialAccessSetup,
    private readonly credentials: CredentialProtector,
    private readonly idGenerator: AuthenticationIdGenerator,
    private readonly clock: AuthenticationClock,
  ) {}

  async execute(input: {
    username: string;
    temporaryPassword: string;
  }): Promise<InitializeFirstAdministratorResult> {
    const username = normalizeUsername(input.username);
    if (!username.ok) {
      return { ok: false, reason: 'invalid-username' };
    }

    const passwordPolicy = validatePersonalPassword(input.temporaryPassword, username.value);
    if (!passwordPolicy.ok) {
      return {
        ok: false,
        reason: 'invalid-temporary-password',
        violations: passwordPolicy.violations,
      };
    }

    const account = UserAccount.createWithTemporaryCredential({
      id: this.idGenerator.generate(),
      profileId: ADMINISTRATOR_PROFILE_ID,
      usernameNormalized: username.value,
      credentialHash: await this.credentials.protect(input.temporaryPassword),
      now: this.clock.now(),
    });
    const outcome = await this.setup.initializeAdministrator(account);

    return { ok: true, outcome, usernameNormalized: username.value };
  }
}
