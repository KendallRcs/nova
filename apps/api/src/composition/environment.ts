export interface Environment {
  DATABASE_URL: string;
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
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

  return {
    DATABASE_URL: databaseUrl,
    NODE_ENV: nodeEnvironment,
    PORT: port,
  };
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
