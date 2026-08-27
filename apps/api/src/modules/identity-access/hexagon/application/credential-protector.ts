export interface CredentialProtector {
  protect(plainCredential: string): Promise<string>;
  matches(plainCredential: string, protectedCredential: string | null): Promise<boolean>;
  needsRefresh(protectedCredential: string): boolean;
}
