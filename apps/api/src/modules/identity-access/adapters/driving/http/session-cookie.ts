import type { CookieOptions } from 'express';

export const SESSION_COOKIE_LIFETIME_MILLISECONDS = 365 * 24 * 60 * 60 * 1_000;

export interface SessionCookieDefinition {
  name: string;
  options: CookieOptions;
}

export function sessionCookieDefinition(
  environment: 'development' | 'test' | 'production',
  expiresAt: Date,
): SessionCookieDefinition {
  const isProduction = environment === 'production';

  return {
    name: isProduction ? '__Host-nova-session' : 'nova-session',
    options: {
      expires: expiresAt,
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
      secure: isProduction,
    },
  };
}
