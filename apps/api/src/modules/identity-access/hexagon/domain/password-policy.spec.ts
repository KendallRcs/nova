import { describe, expect, it } from 'vitest';

import { validatePersonalPassword } from './password-policy';

describe('validatePersonalPassword', () => {
  it('accepts a personal passphrase with ten or more characters', () => {
    expect(validatePersonalPassword('mis juguetes favoritos', 'kendall')).toEqual({ ok: true });
  });

  it('reports every violated rule without exposing the password', () => {
    expect(validatePersonalPassword('KENDALL', 'kendall')).toEqual({
      ok: false,
      violations: ['password-too-short', 'password-matches-username'],
    });
  });
});
