import { describe, expect, it } from 'vitest';

import { NodeSessionCredentials } from './node-session-credentials';

describe('NodeSessionCredentials', () => {
  const credentials = new NodeSessionCredentials();

  it('generates at least 256 bits of unpredictable material and stores only a digest', () => {
    const firstSecret = credentials.generate();
    const secondSecret = credentials.generate();
    const protectedCredential = credentials.protect(firstSecret);

    expect(Buffer.from(firstSecret, 'base64url')).toHaveLength(32);
    expect(secondSecret).not.toBe(firstSecret);
    expect(protectedCredential).toMatch(/^[a-f0-9]{64}$/);
    expect(protectedCredential).not.toContain(firstSecret);
    expect(credentials.protect(firstSecret)).toBe(protectedCredential);
  });
});
