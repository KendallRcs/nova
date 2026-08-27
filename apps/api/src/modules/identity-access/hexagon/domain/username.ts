export type UsernameResult =
  { ok: true; value: string } | { ok: false; reason: 'username-required' };

export function normalizeUsername(value: string): UsernameResult {
  const normalized = value.trim().replace(/\s+/g, ' ').normalize('NFKC').toLocaleLowerCase('es-PE');

  return normalized.length === 0
    ? { ok: false, reason: 'username-required' }
    : { ok: true, value: normalized };
}
