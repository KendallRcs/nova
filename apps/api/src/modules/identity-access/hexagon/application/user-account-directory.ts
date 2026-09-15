import type { UserAccountStatus } from '../domain/user-account';

export interface UserAccountSummary {
  readonly id: string;
  readonly username: string;
  readonly profile: 'administrator' | 'employee';
  readonly status: UserAccountStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UserAccountDirectory {
  list(): Promise<readonly UserAccountSummary[]>;
}

export class ListCollaboratorAccounts {
  constructor(private readonly directory: UserAccountDirectory) {}

  execute(): Promise<readonly UserAccountSummary[]> {
    return this.directory.list();
  }
}
