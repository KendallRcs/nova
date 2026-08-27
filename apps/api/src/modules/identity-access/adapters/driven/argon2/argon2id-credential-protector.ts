import argon2 from 'argon2';

import type { CredentialProtector } from '../../../hexagon/application/credential-protector';

const ARGON2ID_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export class Argon2idCredentialProtector implements CredentialProtector {
  protect(plainCredential: string): Promise<string> {
    return argon2.hash(plainCredential, ARGON2ID_OPTIONS);
  }

  matches(plainCredential: string, protectedCredential: string): Promise<boolean> {
    return argon2.verify(protectedCredential, plainCredential);
  }

  needsRefresh(protectedCredential: string): boolean {
    return argon2.needsRehash(protectedCredential, ARGON2ID_OPTIONS);
  }
}
