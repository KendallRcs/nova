export interface Environment {
  DATABASE_URL: string;
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  FRONTEND_ORIGIN: string;
  CSRF_SECRET: string;
}

export class InvalidEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEnvironmentError';
  }
}

export function validateEnvironment(values: Record<string, unknown>): Environment {
  const databaseUrl = requirePostgresUrl(values.DATABASE_URL);
  const port = parsePort(values.PORT);
  const nodeEnvironment = parseNodeEnvironment(values.NODE_ENV);
  const frontendOrigin = requireOrigin(values.FRONTEND_ORIGIN);
  const csrfSecret = requireSecret(values.CSRF_SECRET);

  return {
    DATABASE_URL: databaseUrl,
    NODE_ENV: nodeEnvironment,
    PORT: port,
    FRONTEND_ORIGIN: frontendOrigin,
    CSRF_SECRET: csrfSecret,
  };
}

function requireOrigin(value: unknown): string {
  if (typeof value !== 'string')
    throw new InvalidEnvironmentError('FRONTEND_ORIGIN es obligatoria.');
  try {
    const url = new URL(value);
    if (url.origin !== value || !['http:', 'https:'].includes(url.protocol)) throw new Error();
    return value;
  } catch {
    throw new InvalidEnvironmentError('FRONTEND_ORIGIN debe ser un origen HTTP(S) exacto.');
  }
}

function requireSecret(value: unknown): string {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') < 32) {
    throw new InvalidEnvironmentError('CSRF_SECRET debe contener al menos 32 bytes.');
  }
  return value;
}

function requirePostgresUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidEnvironmentError('DATABASE_URL es obligatoria.');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidEnvironmentError('DATABASE_URL debe ser una URL válida.');
  }

  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new InvalidEnvironmentError('DATABASE_URL debe utilizar PostgreSQL.');
  }

  return value;
}

function parsePort(value: unknown): number {
  const port = value === undefined ? 3001 : Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new InvalidEnvironmentError('PORT debe ser un entero entre 1 y 65535.');
  }

  return port;
}

function parseNodeEnvironment(value: unknown): Environment['NODE_ENV'] {
  if (value === undefined) {
    return 'development';
  }

  if (value === 'development' || value === 'test' || value === 'production') {
    return value;
  }

  throw new InvalidEnvironmentError('NODE_ENV debe ser development, test o production.');
}
