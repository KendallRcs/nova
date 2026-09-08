import { describe, expect, it } from 'vitest';

import { LoginRateLimiter } from './login-rate-limiter';

describe('LoginRateLimiter', () => {
  it('temporarily limits an IP and normalized username pair', () => {
    const limiter = createLimiter({ pairMaxAttempts: 2 });

    expect(limiter.consume('127.0.0.1', ' Empleado1 ')).toEqual({ allowed: true });
    expect(limiter.consume('127.0.0.1', 'empleado1')).toEqual({ allowed: true });
    expect(limiter.consume('127.0.0.1', 'EMPLEADO1')).toEqual({
      allowed: false,
      retryAfterSeconds: 300,
    });
  });

  it('removes the pair penalty after a successful login without resetting IP protection', () => {
    const limiter = createLimiter({ pairMaxAttempts: 1, ipMaxAttempts: 2 });

    expect(limiter.consume('127.0.0.1', 'empleado1')).toEqual({ allowed: true });
    limiter.recordSuccess('127.0.0.1', 'EMPLEADO1');
    expect(limiter.consume('127.0.0.1', 'empleado1')).toEqual({ allowed: true });
    limiter.recordSuccess('127.0.0.1', 'empleado1');
    expect(limiter.consume('127.0.0.1', 'empleado1')).toMatchObject({ allowed: false });
  });

  it('limits attempts distributed across usernames by IP', () => {
    const limiter = createLimiter({ ipMaxAttempts: 2 });

    expect(limiter.consume('127.0.0.1', 'uno')).toEqual({ allowed: true });
    expect(limiter.consume('127.0.0.1', 'dos')).toEqual({ allowed: true });
    expect(limiter.consume('127.0.0.1', 'tres')).toMatchObject({ allowed: false });
  });

  it('limits attempts distributed across IPs with the global quota', () => {
    const limiter = createLimiter({ globalMaxAttempts: 2 });

    expect(limiter.consume('10.0.0.1', 'uno')).toEqual({ allowed: true });
    expect(limiter.consume('10.0.0.2', 'dos')).toEqual({ allowed: true });
    expect(limiter.consume('10.0.0.3', 'tres')).toMatchObject({ allowed: false });
  });

  it('allows attempts again after the window expires without persistent account state', () => {
    let now = 1_000;
    const limiter = createLimiter({ pairMaxAttempts: 1 }, () => now);

    expect(limiter.consume('127.0.0.1', 'empleado1')).toEqual({ allowed: true });
    expect(limiter.consume('127.0.0.1', 'empleado1')).toMatchObject({ allowed: false });
    now += 300_000;
    expect(limiter.consume('127.0.0.1', 'empleado1')).toEqual({ allowed: true });
  });
});

function createLimiter(
  overrides: Partial<ConstructorParameters<typeof LoginRateLimiter>[0]> = {},
  now?: () => number,
): LoginRateLimiter {
  return new LoginRateLimiter(
    {
      windowSeconds: 300,
      pairMaxAttempts: 5,
      ipMaxAttempts: 30,
      globalMaxAttempts: 300,
      ...overrides,
    },
    now,
  );
}
