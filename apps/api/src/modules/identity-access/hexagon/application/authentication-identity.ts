export interface AuthenticationIdentity {
  userId: string;
  usernameNormalized: string;
  credentialHash: string;
  accountStatus: 'active' | 'inactive' | 'password-change-required';
  securityVersion: number;
  profileIsActive: boolean;
  permissionCodes: string[];
}

export interface AuthenticationIdentities {
  findByUsername(usernameNormalized: string): Promise<AuthenticationIdentity | null>;
}
