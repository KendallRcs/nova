import argon2 from 'argon2';

import type { CredentialProtector } from '../../../hexagon/application/credential-protector';

const ARGON2ID_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const DUMMY_CREDENTIAL_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$j+h5YAbGvIS34v7aGfgKyg$EUeh/JGF+KaT5jiZvVdcISjGJOdMPtqYpLTYdRq339o';

export class Argon2idCredentialProtector implements CredentialProtector {
  protect(plainCredential: string): Promise<string> {
    return argon2.hash(plainCredential, ARGON2ID_OPTIONS);
  }

  matches(plainCredential: string, protectedCredential: string | null): Promise<boolean> {
    return argon2.verify(protectedCredential ?? DUMMY_CREDENTIAL_HASH, plainCredential);
  }

  needsRefresh(protectedCredential: string): boolean {
    return argon2.needsRehash(protectedCredential, ARGON2ID_OPTIONS);
  }
}
