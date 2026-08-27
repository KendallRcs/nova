import { describe, expect, it } from 'vitest';

import type { Category } from '../domain/category';
import type { Clock, IdGenerator } from './category.dependencies';
import { CategoryNameAlreadyExistsError, type CategoryRepository } from './category.repository';
import { CreateCategory } from './create-category';

class InMemoryCategoryRepository implements CategoryRepository {
  readonly categories: Category[] = [];

  findByNormalizedName(nameNormalized: string): Promise<Category | null> {
    return Promise.resolve(
      this.categories.find(
        (category) => category.toPrimitives().nameNormalized === nameNormalized,
      ) ?? null,
    );
  }

  listActive(): Promise<Category[]> {
    return Promise.resolve(
      this.categories.filter((category) => category.toPrimitives().status === 'active'),
    );
  }

  save(category: Category): Promise<void> {
    this.categories.push(category);
    return Promise.resolve();
  }
}

const fixedClock: Clock = {
  now: () => new Date('2026-08-26T20:00:00.000Z'),
};

const fixedIdGenerator: IdGenerator = {
  generate: () => '0198f9c2-7e00-7000-8000-000000000001',
};

describe('CreateCategory', () => {
  it('creates an active category using domain values', async () => {
    const repository = new InMemoryCategoryRepository();
    const useCase = new CreateCategory(repository, fixedIdGenerator, fixedClock);

    const result = await useCase.execute({ name: ' Accesorios ' });

    expect(result).toEqual({
      id: '0198f9c2-7e00-7000-8000-000000000001',
      name: 'Accesorios',
      description: null,
      isActive: true,
      createdAt: new Date('2026-08-26T20:00:00.000Z'),
      updatedAt: new Date('2026-08-26T20:00:00.000Z'),
    });
    expect(repository.categories).toHaveLength(1);
  });

  it('rejects an equivalent normalized name', async () => {
    const repository = new InMemoryCategoryRepository();
    const useCase = new CreateCategory(repository, fixedIdGenerator, fixedClock);
    await useCase.execute({ name: 'Muñecas y accesorios' });

    await expect(useCase.execute({ name: '  MUÑECAS   Y ACCESORIOS ' })).rejects.toBeInstanceOf(
      CategoryNameAlreadyExistsError,
    );
  });
});
