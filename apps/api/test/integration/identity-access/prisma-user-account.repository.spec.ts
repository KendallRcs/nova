import { execFileSync } from 'node:child_process';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../src/composition/prisma.service';
import { AccountStatus, SessionStatus } from '../../../src/generated/prisma/client';
import { PrismaUserAccountRepository } from '../../../src/modules/identity-access/adapters/driven/prisma/prisma-user-account.repository';
import { PrismaRevocableSessions } from '../../../src/modules/identity-access/adapters/driven/prisma/prisma-revocable-sessions';
import { EMPLOYEE_PROFILE_ID } from '../../../src/modules/identity-access/hexagon/domain/access-policy';
import { UserAccount } from '../../../src/modules/identity-access/hexagon/domain/user-account';
import { UsernameAlreadyExistsError } from '../../../src/modules/identity-access/hexagon/application/user-account-administration';

const USER_ID = '0198f9c2-7e00-7000-8000-000000000031';
const SESSION_ID = '0198f9c2-7e00-7000-8000-000000000032';
const MANAGED_USER_ID = '0198f9c2-7e00-7000-8000-000000000041';

describe('PrismaUserAccountRepository', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let prisma: PrismaService | undefined;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18.6').start();
    const databaseUrl = container.getConnectionUri();
    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });
    prisma = new PrismaService(databaseUrl);

    await prisma.accessProfile.create({
      data: {
        id: EMPLOYEE_PROFILE_ID,
        name: 'Empleado',
        nameNormalized: 'empleado',
      },
    });
    await prisma.userAccount.create({
      data: {
        id: USER_ID,
        profileId: EMPLOYEE_PROFILE_ID,
        usernameNormalized: 'empleado1',
        credentialHash: 'old-hash',
        status: AccountStatus.ACTIVE,
        securityVersion: 3,
        createdAt: new Date('2026-09-01T10:00:00.000Z'),
        updatedAt: new Date('2026-09-01T10:00:00.000Z'),
      },
    });
    await prisma.session.create({
      data: {
        id: SESSION_ID,
        userId: USER_ID,
        protectedCredential: 'protected-session',
        issuedSecurityVersion: 3,
        status: SessionStatus.ACTIVE,
        issuedAt: new Date('2026-09-07T10:00:00.000Z'),
        renewedAt: new Date('2026-09-07T10:00:00.000Z'),
        credentialExpiresAt: new Date('2027-09-07T10:00:00.000Z'),
      },
    });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('persists the temporary credential and revokes active sessions atomically', async () => {
    if (prisma === undefined) throw new Error('Prisma no fue inicializado por la prueba.');
    const repository = new PrismaUserAccountRepository(prisma);
    const account = await repository.findById(USER_ID);
    if (account === null) throw new Error('La cuenta preparada no existe.');
    const changedAt = new Date('2026-09-07T12:00:00.000Z');
    account.resetTemporaryCredential('new-hash', changedAt);

    await expect(
      repository.saveTemporaryCredentialAndRevokeSessions(account, changedAt),
    ).resolves.toBe(true);
    await expect(
      repository.saveTemporaryCredentialAndRevokeSessions(account, changedAt),
    ).resolves.toBe(false);

    await expect(prisma.userAccount.findUnique({ where: { id: USER_ID } })).resolves.toMatchObject({
      credentialHash: 'new-hash',
      status: AccountStatus.PASSWORD_CHANGE_REQUIRED,
      securityVersion: 4,
    });
    await expect(prisma.session.findUnique({ where: { id: SESSION_ID } })).resolves.toMatchObject({
      status: SessionStatus.REVOKED,
      endedAt: changedAt,
      endReason: 'password-reset',
    });
  });

  it('creates, lists, deactivates and reactivates a collaborator without restoring sessions', async () => {
    if (prisma === undefined) throw new Error('Prisma no fue inicializado por la prueba.');
    const repository = new PrismaUserAccountRepository(prisma);
    const createdAt = new Date('2026-09-10T12:00:00.000Z');
    const account = UserAccount.createWithTemporaryCredential({
      id: MANAGED_USER_ID,
      profileId: EMPLOYEE_PROFILE_ID,
      usernameNormalized: 'empleado2',
      credentialHash: 'initial-hash',
      now: createdAt,
    });
    await repository.create(account);

    await expect(repository.list()).resolves.toContainEqual({
      id: MANAGED_USER_ID,
      username: 'empleado2',
      profile: 'employee',
      status: 'password-change-required',
      createdAt,
      updatedAt: createdAt,
    });
    await expect(
      repository.create(
        UserAccount.createWithTemporaryCredential({
          id: '0198f9c2-7e00-7000-8000-000000000042',
          profileId: EMPLOYEE_PROFILE_ID,
          usernameNormalized: 'empleado2',
          credentialHash: 'other-hash',
          now: createdAt,
        }),
      ),
    ).rejects.toBeInstanceOf(UsernameAlreadyExistsError);

    await prisma.session.create({
      data: {
        id: '0198f9c2-7e00-7000-8000-000000000043',
        userId: MANAGED_USER_ID,
        protectedCredential: 'managed-user-session',
        issuedSecurityVersion: 1,
        status: SessionStatus.ACTIVE,
        issuedAt: createdAt,
        renewedAt: createdAt,
        credentialExpiresAt: new Date('2027-09-10T12:00:00.000Z'),
      },
    });
    const deactivatedAt = new Date('2026-09-11T12:00:00.000Z');
    account.deactivate(deactivatedAt);
    await expect(
      repository.saveDeactivationAndRevokeSessions(account, deactivatedAt),
    ).resolves.toBe(true);

    const reactivatedAt = new Date('2026-09-12T12:00:00.000Z');
    account.reactivateWithTemporaryCredential('reactivated-hash', reactivatedAt);
    await expect(
      repository.saveReactivationAndRevokeSessions(account, reactivatedAt),
    ).resolves.toBe(true);
    await expect(
      prisma.userAccount.findUnique({ where: { id: MANAGED_USER_ID } }),
    ).resolves.toMatchObject({
      status: AccountStatus.PASSWORD_CHANGE_REQUIRED,
      credentialHash: 'reactivated-hash',
      securityVersion: 3,
    });
    await expect(
      prisma.session.findUnique({
        where: { id: '0198f9c2-7e00-7000-8000-000000000043' },
      }),
    ).resolves.toMatchObject({
      status: SessionStatus.REVOKED,
      endReason: 'account-deactivated',
    });
  });

  it('revokes sessions administratively while keeping the account enabled', async () => {
    if (prisma === undefined) throw new Error('Prisma no fue inicializado por la prueba.');
    const sessionId = '0198f9c2-7e00-7000-8000-000000000051';
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: USER_ID,
        protectedCredential: 'administratively-revoked-session',
        issuedSecurityVersion: 4,
        status: SessionStatus.ACTIVE,
        issuedAt: new Date('2026-09-13T10:00:00.000Z'),
        renewedAt: new Date('2026-09-13T10:00:00.000Z'),
        credentialExpiresAt: new Date('2027-09-13T10:00:00.000Z'),
      },
    });
    const revokedAt = new Date('2026-09-15T14:00:00.000Z');
    const sessions = new PrismaRevocableSessions(prisma);

    await expect(sessions.revokeAllForUser(USER_ID, revokedAt)).resolves.toBe('revoked');
    await expect(
      sessions.revokeAllForUser('0198f9c2-7e00-7000-8000-000000000099', revokedAt),
    ).resolves.toBe('user-not-found');
    await expect(prisma.session.findUnique({ where: { id: sessionId } })).resolves.toMatchObject({
      status: SessionStatus.REVOKED,
      endedAt: revokedAt,
      endReason: 'administrative-revocation',
    });
    await expect(prisma.userAccount.findUnique({ where: { id: USER_ID } })).resolves.toMatchObject({
      status: AccountStatus.PASSWORD_CHANGE_REQUIRED,
    });
  });
});
