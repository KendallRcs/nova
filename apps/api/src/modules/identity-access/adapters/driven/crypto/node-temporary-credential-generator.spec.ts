import { describe, expect, it } from 'vitest';

import { NodeTemporaryCredentialGenerator } from './node-temporary-credential-generator';

describe('NodeTemporaryCredentialGenerator', () => {
  it('generates distinct URL-safe credentials with 144 bits of entropy', () => {
    const generator = new NodeTemporaryCredentialGenerator();
    const first = generator.generate();
    const second = generator.generate();

    expect(first).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(second).not.toBe(first);
  });
});
