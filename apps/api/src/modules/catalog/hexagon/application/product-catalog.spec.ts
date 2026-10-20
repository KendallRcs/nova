import { describe, expect, it } from 'vitest';

import { GetProduct, SearchProducts, type ProductCatalog } from './product-catalog';
import type { ProductImageStorage } from './product-images';

describe('SearchProducts', () => {
  it('turns opaque image references into delivery URLs without exposing storage keys', async () => {
    const catalog: ProductCatalog = {
      findById: () => Promise.resolve(null),
      search: () =>
        Promise.resolve({
          items: [
            {
              id: '0199ef04-1b00-7000-8000-000000000001',
              code: 'IMG-001',
              name: 'Producto con imagen',
              description: null,
              category: { id: '0199ef04-1b00-7000-8000-000000000002', name: 'Categoría' },
              tags: [],
              images: [
                {
                  id: '0199ef04-1b00-7000-8000-000000000003',
                  storageKey: 'opaque-key',
                  position: 1,
                  width: 800,
                  height: 600,
                  bytes: 12_000,
                  format: 'webp',
                },
              ],
              minimumPriceCents: 1_000,
              suggestedPriceCents: null,
              maximumPriceCents: null,
              stock: [],
              isActive: true,
              createdAt: new Date('2026-10-19T16:00:00.000Z'),
              updatedAt: new Date('2026-10-19T16:00:00.000Z'),
            },
          ],
          nextProductId: null,
        }),
    };
    const storage: ProductImageStorage = {
      store: () => Promise.reject(new Error('not used')),
      remove: () => Promise.resolve(true),
      deliveryUrl: (storageKey) => `https://images.example/${storageKey}`,
    };

    const page = await new SearchProducts(catalog, storage).execute({ limit: 50 });

    expect(page.items[0]?.images).toEqual([
      {
        id: '0199ef04-1b00-7000-8000-000000000003',
        position: 1,
        width: 800,
        height: 600,
        bytes: 12_000,
        format: 'webp',
        url: 'https://images.example/opaque-key',
      },
    ]);
    expect(page.items[0]?.images[0]).not.toHaveProperty('storageKey');
  });

  it('gets one product and hides its opaque image reference', async () => {
    const record = {
      id: '0199ef04-1b00-7000-8000-000000000001',
      code: 'IMG-001',
      name: 'Producto con imagen',
      description: null,
      category: { id: '0199ef04-1b00-7000-8000-000000000002', name: 'Categoría' },
      tags: [],
      images: [
        {
          id: '0199ef04-1b00-7000-8000-000000000003',
          storageKey: 'opaque-key',
          position: 1 as const,
          width: 800,
          height: 600,
          bytes: 12_000,
          format: 'webp',
        },
      ],
      minimumPriceCents: 1_000,
      suggestedPriceCents: null,
      maximumPriceCents: null,
      stock: [],
      isActive: true,
      createdAt: new Date('2026-10-19T16:00:00.000Z'),
      updatedAt: new Date('2026-10-19T16:00:00.000Z'),
    };
    const catalog: ProductCatalog = {
      findById: () => Promise.resolve(record),
      search: () => Promise.resolve({ items: [], nextProductId: null }),
    };
    const storage: ProductImageStorage = {
      store: () => Promise.reject(new Error('not used')),
      remove: () => Promise.resolve(true),
      deliveryUrl: (storageKey) => `https://images.example/${storageKey}`,
    };

    const result = await new GetProduct(catalog, storage).execute(record.id);

    expect(result).toMatchObject({
      ok: true,
      product: { id: record.id, images: [{ url: 'https://images.example/opaque-key' }] },
    });
    if (result.ok) expect(result.product.images[0]).not.toHaveProperty('storageKey');
  });

  it('reports when an active product does not exist', async () => {
    const catalog: ProductCatalog = {
      findById: () => Promise.resolve(null),
      search: () => Promise.resolve({ items: [], nextProductId: null }),
    };
    const storage: ProductImageStorage = {
      store: () => Promise.reject(new Error('not used')),
      remove: () => Promise.resolve(true),
      deliveryUrl: (storageKey) => storageKey,
    };

    await expect(new GetProduct(catalog, storage).execute('missing')).resolves.toEqual({
      ok: false,
      reason: 'product-not-found',
    });
  });
});
