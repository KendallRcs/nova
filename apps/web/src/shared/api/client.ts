import createClient, { type Middleware } from 'openapi-fetch';

import type { paths } from './schema';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const csrfMiddleware: Middleware = {
  onRequest({ request }) {
    if (typeof document === 'undefined' || !unsafeMethods.has(request.method.toUpperCase())) {
      return request;
    }

    const csrfToken = readCookie('__Host-nova-csrf') ?? readCookie('nova-csrf');
    if (csrfToken !== null) request.headers.set('x-csrf-token', csrfToken);
    return request;
  },
};

export const apiClient = createClient<paths>({
  baseUrl: apiBaseUrl(),
  credentials: 'include',
  headers: { Accept: 'application/json' },
});

apiClient.use(csrfMiddleware);

function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_NOVA_API_URL?.trim() ?? 'http://localhost:3001';
  const baseUrl = configured.length > 0 ? configured : 'http://localhost:3001';
  return baseUrl.replace(/\/$/, '');
}

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie === undefined ? null : decodeURIComponent(cookie.slice(prefix.length));
}
