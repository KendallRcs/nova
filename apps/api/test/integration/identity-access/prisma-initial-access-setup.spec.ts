import { execFileSync } from 'node:child_process';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../src/composition/prisma.service';
import { PrismaInitialAccessSetup } from '../../../src/modules/identity-access/adapters/driven/prisma/prisma-initial-access-setup';
import { ADMINISTRATOR_PROFILE_ID } from '../../../src/modules/identity-access/hexagon/application/initialize-first-administrator';
import { UserAccount } from '../../../src/modules/identity-access/hexagon/domain/user-account';

describe('PrismaInitialAccessSetup', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let prisma: PrismaService | undefined;
  let setup: PrismaInitialAccessSetup;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18.6').start();
    const databaseUrl = container.getConnectionUri();

    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    prisma = new PrismaService(databaseUrl);
    setup = new PrismaInitialAccessSetup(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('creates exactly one administrator when initialization runs concurrently', async () => {
    const outcomes = await Promise.all([
      setup.initializeAdministrator(createAccount('0198f9c2-7e00-7000-8000-000000000011')),
      setup.initializeAdministrator(createAccount('0198f9c2-7e00-7000-8000-000000000012')),
    ]);

    expect(outcomes.sort()).toEqual(['already-initialized', 'created']);
    expect(await prisma?.userAccount.count()).toBe(1);
    expect(
      await prisma?.accessProfile.findUnique({ where: { id: ADMINISTRATOR_PROFILE_ID } }),
    ).toMatchObject({
      name: 'Administrador',
      nameNormalized: 'administrador',
    });
  });
});

function createAccount(id: string): UserAccount {
  return UserAccount.createWithTemporaryCredential({
    id,
    profileId: ADMINISTRATOR_PROFILE_ID,
    usernameNormalized: 'admin',
    credentialHash: 'protected-temporary-credential',
    now: new Date('2026-08-27T05:00:00.000Z'),
  });
}
