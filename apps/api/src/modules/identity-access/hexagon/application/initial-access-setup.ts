import type { UserAccount } from '../domain/user-account';

export type InitialAccessSetupResult = 'created' | 'already-initialized';

export interface InitialAccessSetup {
  initializeAdministrator(account: UserAccount): Promise<InitialAccessSetupResult>;
}
