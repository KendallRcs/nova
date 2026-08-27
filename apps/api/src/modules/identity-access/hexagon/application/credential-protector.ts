export interface CredentialProtector {
  protect(plainCredential: string): Promise<string>;
  matches(plainCredential: string, protectedCredential: string): Promise<boolean>;
  needsRefresh(protectedCredential: string): boolean;
}
