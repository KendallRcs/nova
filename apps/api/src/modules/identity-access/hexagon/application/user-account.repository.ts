import type { UserAccount } from '../domain/user-account';

export interface UserAccountRepository {
  findById(id: string): Promise<UserAccount | null>;
  savePersonalCredentialAndRevokeSessions(account: UserAccount, changedAt: Date): Promise<boolean>;
}
