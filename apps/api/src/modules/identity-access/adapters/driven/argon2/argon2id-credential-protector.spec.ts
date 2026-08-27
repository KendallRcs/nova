import { describe, expect, it } from 'vitest';

import { Argon2idCredentialProtector } from './argon2id-credential-protector';

describe('Argon2idCredentialProtector', () => {
  const protector = new Argon2idCredentialProtector();

  it('protects a credential with Argon2id and verifies only the original value', async () => {
    const protectedCredential = await protector.protect('una frase secreta');

    expect(protectedCredential).toMatch(/^\$argon2id\$/);
    expect(protectedCredential).not.toContain('una frase secreta');
    await expect(protector.matches('una frase secreta', protectedCredential)).resolves.toBe(true);
    await expect(protector.matches('otra frase secreta', protectedCredential)).resolves.toBe(false);
    expect(protector.needsRefresh(protectedCredential)).toBe(false);
  });
});
