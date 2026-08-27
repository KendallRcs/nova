export type UserAccountStatus = 'active' | 'inactive' | 'password-change-required';

export interface UserAccountProperties {
  id: string;
  profileId: string;
  usernameNormalized: string;
  credentialHash: string;
  status: UserAccountStatus;
  securityVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export class UserAccount {
  private constructor(private properties: UserAccountProperties) {}

  static createWithTemporaryCredential(input: {
    id: string;
    profileId: string;
    usernameNormalized: string;
    credentialHash: string;
    now: Date;
  }): UserAccount {
    return new UserAccount({
      ...input,
      status: 'password-change-required',
      securityVersion: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(properties: UserAccountProperties): UserAccount {
    return new UserAccount({ ...properties });
  }

  canAuthenticate(): boolean {
    return this.properties.status !== 'inactive';
  }

  requiresPasswordChange(): boolean {
    return this.properties.status === 'password-change-required';
  }

  establishPersonalCredential(credentialHash: string, now: Date): void {
    this.properties = {
      ...this.properties,
      credentialHash,
      status: 'active',
      securityVersion: this.properties.securityVersion + 1,
      updatedAt: now,
    };
  }

  deactivate(now: Date): void {
    if (this.properties.status === 'inactive') {
      return;
    }

    this.properties = {
      ...this.properties,
      status: 'inactive',
      securityVersion: this.properties.securityVersion + 1,
      updatedAt: now,
    };
  }

  toPrimitives(): UserAccountProperties {
    return { ...this.properties };
  }
}
