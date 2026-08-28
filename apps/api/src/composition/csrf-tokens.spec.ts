import { describe, expect, it } from 'vitest';

import { CsrfTokens } from './csrf-tokens';

describe('CsrfTokens', () => {
  const tokens = new CsrfTokens({
    getOrThrow: () => '12345678901234567890123456789012',
  } as never);

  it('issues deterministic tokens tied to one session', () => {
    expect(tokens.issue('session-a')).toBe(tokens.issue('session-a'));
    expect(tokens.issue('session-a')).not.toBe(tokens.issue('session-b'));
  });

  it('verifies without accepting modified tokens', () => {
    const token = tokens.issue('session-a');
    expect(tokens.verifies('session-a', token)).toBe(true);
    expect(tokens.verifies('session-a', `${token}x`)).toBe(false);
  });
});
