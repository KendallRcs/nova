import { describe, expect, it } from 'vitest';

import { sessionCookieDefinition } from './session-cookie';

describe('sessionCookieDefinition', () => {
  const expiresAt = new Date('2027-08-27T00:00:00.000Z');

  it('uses a host-bound secure cookie in production', () => {
    expect(sessionCookieDefinition('production', expiresAt)).toEqual({
      name: '__Host-nova-session',
      options: {
        expires: expiresAt,
        httpOnly: true,
        path: '/',
        sameSite: 'strict',
        secure: true,
      },
    });
  });

  it('allows the local HTTP development server', () => {
    expect(sessionCookieDefinition('development', expiresAt)).toMatchObject({
      name: 'nova-session',
      options: { secure: false },
    });
  });
});
