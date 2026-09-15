import { describe, expect, it } from 'vitest';

import type { Product } from '../domain/product';
import type { Clock, IdGenerator } from './category.dependencies';
import { CreateProduct, DeactivateProduct, UpdateProduct } from './manage-products';
import type { ProductClassifications, ProductRepository } from './product.repository';

class InMemoryProducts implements ProductRepository, ProductClassifications {
  readonly records = new Map<string, Product>();
  classificationsActive = true;

  findById(id: string): Promise<Product | null> {
    return Promise.resolve(this.records.get(id) ?? null);
  }

  findByNormalizedCode(codeNormalized: string): Promise<Product | null> {
    return Promise.resolve(
      [...this.records.values()].find(
        (product) => product.toPrimitives().codeNormalized === codeNormalized,
      ) ?? null,
    );
  }

  save(product: Product): Promise<void> {
    this.records.set(product.toPrimitives().id, product);
    return Promise.resolve();
  }

  update(product: Product): Promise<boolean> {
    this.records.set(product.toPrimitives().id, product);
    return Promise.resolve(true);
  }

  areActive(): Promise<boolean> {
    return Promise.resolve(this.classificationsActive);
  }
}

const idGenerator: IdGenerator = { generate: () => 'product-1' };
const clock: Clock = { now: () => new Date('2026-09-15T16:00:00.000Z') };
const input = {
  categoryId: 'category-1',
  tagIds: ['tag-1'],
  code: 'MUN-001',
  name: 'Muñeca',
  minimumPriceCents: 2_000,
  suggestedPriceCents: 2_500,
  maximumPriceCents: 3_000,
};

describe('product management', () => {
  it('creates and updates a product when its classifications are active', async () => {
    const repository = new InMemoryProducts();
    const create = new CreateProduct(repository, repository, idGenerator, clock);
    const created = await create.execute(input);
    expect(created).toMatchObject({ ok: true });

    const update = new UpdateProduct(repository, repository, clock);
    const updated = await update.execute({ ...input, id: 'product-1', name: 'Muñeca clásica' });
    expect(updated.ok && updated.product.toPrimitives().name).toBe('Muñeca clásica');
  });

  it('rejects inactive classifications before persisting', async () => {
    const repository = new InMemoryProducts();
    repository.classificationsActive = false;
    const result = await new CreateProduct(repository, repository, idGenerator, clock).execute(
      input,
    );
    expect(result).toEqual({ ok: false, reason: 'classification-unavailable' });
    expect(repository.records.size).toBe(0);
  });

  it('deactivates without deleting the product and remains idempotent', async () => {
    const repository = new InMemoryProducts();
    await new CreateProduct(repository, repository, idGenerator, clock).execute(input);
    const deactivate = new DeactivateProduct(repository, clock);
    await expect(deactivate.execute('product-1')).resolves.toMatchObject({ ok: true });
    await expect(deactivate.execute('product-1')).resolves.toMatchObject({ ok: true });
    expect(repository.records.get('product-1')?.toPrimitives().status).toBe('inactive');
  });
});
