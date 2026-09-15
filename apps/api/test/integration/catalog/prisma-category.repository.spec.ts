import { execFileSync } from 'node:child_process';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../src/composition/prisma.service';
import { PrismaCategoryRepository } from '../../../src/modules/catalog/adapters/driven/prisma/prisma-category.repository';
import { PrismaTagRepository } from '../../../src/modules/catalog/adapters/driven/prisma/prisma-tag.repository';
import { UuidV7IdGenerator } from '../../../src/modules/catalog/adapters/driven/system/uuid-v7-id-generator';
import { CategoryNameAlreadyExistsError } from '../../../src/modules/catalog/hexagon/application/category.repository';
import { Category } from '../../../src/modules/catalog/hexagon/domain/category';
import { TagNameAlreadyExistsError } from '../../../src/modules/catalog/hexagon/application/tag.repository';
import { Tag } from '../../../src/modules/catalog/hexagon/domain/tag';

describe('PrismaCategoryRepository', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let prisma: PrismaService | undefined;
  let repository: PrismaCategoryRepository;
  let tags: PrismaTagRepository;

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
    tags = new PrismaTagRepository(prisma);
  }, 120_000);

  beforeEach(async () => {
    await prisma?.category.deleteMany();
    await prisma?.tag.deleteMany();
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

  it('updates and deactivates a category without deleting it', async () => {
    const category = createCategory('Accesorios');
    await repository.save(category);
    category.rename({
      name: 'Complementos',
      description: 'Descripción actualizada',
      now: new Date('2026-08-27T20:00:00.000Z'),
    });
    await expect(repository.update(category)).resolves.toBe(true);
    category.deactivate(new Date('2026-08-28T20:00:00.000Z'));
    await expect(repository.update(category)).resolves.toBe(true);
    await expect(repository.listActive()).resolves.toEqual([]);
    await expect(repository.findById(category.toPrimitives().id)).resolves.not.toBeNull();
  });

  it('persists tag lifecycle and translates equivalent-name conflicts', async () => {
    const now = new Date('2026-09-15T15:00:00.000Z');
    const tag = Tag.create({ id: new UuidV7IdGenerator().generate(), name: 'Peluche', now });
    await tags.save(tag);
    await expect(
      tags.save(Tag.create({ id: new UuidV7IdGenerator().generate(), name: 'PELUCHE', now })),
    ).rejects.toBeInstanceOf(TagNameAlreadyExistsError);
    tag.rename('Suave', new Date('2026-09-16T15:00:00.000Z'));
    await expect(tags.update(tag)).resolves.toBe(true);
    tag.deactivate(new Date('2026-09-17T15:00:00.000Z'));
    await expect(tags.update(tag)).resolves.toBe(true);
    await expect(tags.listActive()).resolves.toEqual([]);
    await expect(tags.findById(tag.toPrimitives().id)).resolves.not.toBeNull();
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
