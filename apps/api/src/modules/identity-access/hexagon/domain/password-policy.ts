import { normalizeUsername } from './username';

const graphemeSegmenter = new Intl.Segmenter('es', { granularity: 'grapheme' });

export type PasswordPolicyViolation = 'password-too-short' | 'password-matches-username';

export type PasswordPolicyResult =
  { ok: true } | { ok: false; violations: PasswordPolicyViolation[] };

export function validatePersonalPassword(
  password: string,
  usernameNormalized: string,
): PasswordPolicyResult {
  const violations: PasswordPolicyViolation[] = [];

  if (Array.from(graphemeSegmenter.segment(password)).length < 10) {
    violations.push('password-too-short');
  }

  const passwordAsUsername = normalizeUsername(password);
  if (passwordAsUsername.ok && passwordAsUsername.value === usernameNormalized) {
    violations.push('password-matches-username');
  }

  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}
