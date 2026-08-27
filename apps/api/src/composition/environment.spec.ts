import { describe, expect, it } from 'vitest';

import { InvalidEnvironmentError, validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('applies safe local defaults to optional technical values', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'postgresql://nova:secret@localhost:5432/nova',
      }),
    ).toEqual({
      DATABASE_URL: 'postgresql://nova:secret@localhost:5432/nova',
      NODE_ENV: 'development',
      PORT: 3001,
    });
  });

  it.each([
    [{}, 'DATABASE_URL es obligatoria.'],
    [{ DATABASE_URL: 'mysql://localhost/nova' }, 'DATABASE_URL debe utilizar PostgreSQL.'],
    [
      { DATABASE_URL: 'postgresql://localhost/nova', PORT: 'invalid' },
      'PORT debe ser un entero entre 1 y 65535.',
    ],
  ])('rejects an invalid environment', (values, message) => {
    expect(() => validateEnvironment(values)).toThrow(new InvalidEnvironmentError(message));
  });
});
