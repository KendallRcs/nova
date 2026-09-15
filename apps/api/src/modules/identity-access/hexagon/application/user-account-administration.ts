import type { UserAccount } from '../domain/user-account';

export class UsernameAlreadyExistsError extends Error {
  constructor() {
    super('Ya existe una cuenta con un nombre de usuario equivalente.');
    this.name = 'UsernameAlreadyExistsError';
  }
}

export interface UserAccountAdministration {
  findById(id: string): Promise<UserAccount | null>;
  create(account: UserAccount): Promise<void>;
  saveDeactivationAndRevokeSessions(account: UserAccount, changedAt: Date): Promise<boolean>;
  saveReactivationAndRevokeSessions(account: UserAccount, changedAt: Date): Promise<boolean>;
}
