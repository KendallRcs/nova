import { describe, expect, it } from 'vitest';

import { InvalidEnvironmentError, validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('applies safe local defaults to optional technical values', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'postgresql://nova:secret@localhost:5432/nova',
        FRONTEND_ORIGIN: 'http://localhost:3000',
        CSRF_SECRET: '12345678901234567890123456789012',
      }),
    ).toEqual({
      DATABASE_URL: 'postgresql://nova:secret@localhost:5432/nova',
      NODE_ENV: 'development',
      PORT: 3001,
      FRONTEND_ORIGIN: 'http://localhost:3000',
      CSRF_SECRET: '12345678901234567890123456789012',
      LOGIN_RATE_LIMIT_WINDOW_SECONDS: 300,
      LOGIN_RATE_LIMIT_PAIR_MAX: 5,
      LOGIN_RATE_LIMIT_IP_MAX: 30,
      LOGIN_RATE_LIMIT_GLOBAL_MAX: 300,
    });
  });

  it.each([
    [{}, 'DATABASE_URL es obligatoria.'],
    [{ DATABASE_URL: 'mysql://localhost/nova' }, 'DATABASE_URL debe utilizar PostgreSQL.'],
    [
      { DATABASE_URL: 'postgresql://localhost/nova', PORT: 'invalid' },
      'PORT debe ser un entero entre 1 y 65535.',
    ],
    [
      {
        DATABASE_URL: 'postgresql://localhost/nova',
        FRONTEND_ORIGIN: 'http://localhost:3000',
        CSRF_SECRET: '12345678901234567890123456789012',
        LOGIN_RATE_LIMIT_PAIR_MAX: 0,
      },
      'LOGIN_RATE_LIMIT_PAIR_MAX debe ser un entero positivo.',
    ],
  ])('rejects an invalid environment', (values, message) => {
    expect(() => validateEnvironment(values)).toThrow(new InvalidEnvironmentError(message));
  });
});
