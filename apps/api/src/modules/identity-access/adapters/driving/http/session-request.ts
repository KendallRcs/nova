import type { Request } from 'express';

export function readSessionSecret(request: Request, cookieName: string): string | null {
  const header = request.headers.cookie;
  if (header === undefined) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== cookieName) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1));
    } catch {
      return null;
    }
  }
  return null;
}
