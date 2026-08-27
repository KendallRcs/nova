export interface SessionSecretGenerator {
  generate(): string;
}

export interface SessionCredentialProtector {
  protect(secret: string): string;
}
