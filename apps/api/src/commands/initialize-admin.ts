import { resolve } from 'node:path';

import { config } from 'dotenv';

import { PrismaService } from '../composition/prisma.service';
import { Argon2idCredentialProtector } from '../modules/identity-access/adapters/driven/argon2/argon2id-credential-protector';
import { PrismaInitialAccessSetup } from '../modules/identity-access/adapters/driven/prisma/prisma-initial-access-setup';
import { PrismaAccessPolicyCatalog } from '../modules/identity-access/adapters/driven/prisma/prisma-access-policy-catalog';
import {
  SystemAuthenticationClock,
  UuidV7AuthenticationIdGenerator,
} from '../modules/identity-access/adapters/driven/system/system-authentication-dependencies';
import { InitializeFirstAdministrator } from '../modules/identity-access/hexagon/application/initialize-first-administrator';
import { SynchronizeAccessPolicy } from '../modules/identity-access/hexagon/application/synchronize-access-policy';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

async function main(): Promise<void> {
  const databaseUrl = requiredEnvironmentValue('DATABASE_URL');
  const username = requiredEnvironmentValue('NOVA_INITIAL_ADMIN_USERNAME');
  const temporaryPassword = requiredEnvironmentValue('NOVA_INITIAL_ADMIN_PASSWORD');
  const prisma = new PrismaService(databaseUrl);

  try {
    await new SynchronizeAccessPolicy(new PrismaAccessPolicyCatalog(prisma)).execute();
    const initialize = new InitializeFirstAdministrator(
      new PrismaInitialAccessSetup(prisma),
      new Argon2idCredentialProtector(),
      new UuidV7AuthenticationIdGenerator(),
      new SystemAuthenticationClock(),
    );
    const result = await initialize.execute({ username, temporaryPassword });

    if (!result.ok) {
      throw new InitialAdministratorInputError(result.reason, result.violations);
    }

    if (result.outcome === 'already-initialized') {
      process.stdout.write('Nova ya posee una cuenta; no se realizó ningún cambio.\n');
      return;
    }

    process.stdout.write(
      `Administrador inicial "${result.usernameNormalized}" creado con contraseña temporal.\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} es obligatoria para ejecutar este comando.`);
  }

  return value;
}

class InitialAdministratorInputError extends Error {
  constructor(reason: string, violations: string[] | undefined) {
    const details = violations === undefined ? reason : `${reason}: ${violations.join(', ')}`;
    super(`No se pudo crear el administrador inicial (${details}).`);
    this.name = 'InitialAdministratorInputError';
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Error desconocido.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
