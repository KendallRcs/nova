import { execFileSync } from 'node:child_process';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../src/composition/prisma.service';
import { PrismaCategoryRepository } from '../../../src/modules/catalog/adapters/driven/prisma/prisma-category.repository';
import { UuidV7IdGenerator } from '../../../src/modules/catalog/adapters/driven/system/uuid-v7-id-generator';
import { CategoryNameAlreadyExistsError } from '../../../src/modules/catalog/hexagon/application/category.repository';
import { Category } from '../../../src/modules/catalog/hexagon/domain/category';

describe('PrismaCategoryRepository', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let prisma: PrismaService | undefined;
  let repository: PrismaCategoryRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18.6').start();
    const databaseUrl = container.getConnectionUri();

    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    prisma = new PrismaService(databaseUrl);
    repository = new PrismaCategoryRepository(prisma);
  }, 120_000);

  beforeEach(async () => {
    await prisma?.category.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('persists and restores a category with PostgreSQL types', async () => {
    const category = createCategory('Accesorios');

    await repository.save(category);

    const restored = await repository.findByNormalizedName('accesorios');
    expect(restored?.toPrimitives()).toEqual(category.toPrimitives());
  });

  it('translates the unique database constraint into an application conflict', async () => {
    await repository.save(createCategory('Accesorios'));

    await expect(repository.save(createCategory('ACCESORIOS'))).rejects.toBeInstanceOf(
      CategoryNameAlreadyExistsError,
    );
  });
});

function createCategory(name: string): Category {
  return Category.create({
    id: new UuidV7IdGenerator().generate(),
    name,
    description: null,
    now: new Date('2026-08-26T20:00:00.000Z'),
  });
}
