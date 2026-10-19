import { describe, expect, it } from 'vitest';

import type { Clock, IdGenerator } from './category.dependencies';
import {
  RemoveProductImage,
  ReplaceProductImage,
  type ProductImageBook,
  type ProductImageStorage,
  type StoredProductImage,
} from './product-images';

const now = new Date('2026-10-19T16:00:00.000Z');
const productId = '0199ef04-1b00-7000-8000-000000000001';
const imageId = '0199ef04-1b00-7000-8000-000000000002';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);

class FakeImageStorage implements ProductImageStorage {
  readonly stored: string[] = [];
  readonly removed: string[] = [];
  failStore = false;

  store(): Promise<StoredProductImage> {
    if (this.failStore) return Promise.reject(new Error('storage unavailable'));
    this.stored.push('nova/products/new');
    return Promise.resolve({
      storageKey: 'nova/products/new',
      width: 800,
      height: 600,
      bytes: 24_000,
      format: 'webp',
    });
  }

  remove(storageKey: string): Promise<boolean> {
    this.removed.push(storageKey);
    return Promise.resolve(true);
  }

  deliveryUrl(storageKey: string): string {
    return `https://images.example/${storageKey}`;
  }
}

class FakeImageBook implements ProductImageBook {
  exists = true;
  previousStorageKey: string | null = null;
  failReplace = false;
  imageExists = true;

  productExists(): Promise<boolean> {
    return Promise.resolve(this.exists);
  }

  replace(): ReturnType<ProductImageBook['replace']> {
    if (this.failReplace) return Promise.reject(new Error('database unavailable'));
    return Promise.resolve(
      this.exists
        ? ({ ok: true, previousStorageKey: this.previousStorageKey } as const)
        : ({ ok: false, reason: 'product-not-found' } as const),
    );
  }

  remove(): ReturnType<ProductImageBook['remove']> {
    if (!this.exists) return Promise.resolve({ ok: false, reason: 'product-not-found' });
    return Promise.resolve(
      this.imageExists
        ? ({ ok: true, removedStorageKey: 'nova/products/old' } as const)
        : ({ ok: false, reason: 'image-not-found' } as const),
    );
  }
}

const ids: IdGenerator = { generate: () => imageId };
const clock: Clock = { now: () => now };

describe('product image management', () => {
  it('stores a valid image and returns its delivery view', async () => {
    const storage = new FakeImageStorage();
    const action = new ReplaceProductImage(new FakeImageBook(), storage, ids, clock);

    await expect(action.execute({ productId, position: 1, content: jpeg })).resolves.toEqual({
      ok: true,
      image: {
        id: imageId,
        productId,
        position: 1,
        storageKey: 'nova/products/new',
        width: 800,
        height: 600,
        bytes: 24_000,
        format: 'webp',
        url: 'https://images.example/nova/products/new',
      },
    });
  });

  it('rejects forged content before calling external storage', async () => {
    const storage = new FakeImageStorage();
    const action = new ReplaceProductImage(new FakeImageBook(), storage, ids, clock);
    await expect(
      action.execute({ productId, position: 1, content: new TextEncoder().encode('fake') }),
    ).resolves.toEqual({ ok: false, reason: 'unsupported-image-format' });
    expect(storage.stored).toEqual([]);
  });

  it('compensates the new upload if database persistence fails', async () => {
    const storage = new FakeImageStorage();
    const book = new FakeImageBook();
    book.failReplace = true;
    const action = new ReplaceProductImage(book, storage, ids, clock);
    await expect(action.execute({ productId, position: 2, content: jpeg })).rejects.toThrow(
      'database unavailable',
    );
    expect(storage.removed).toEqual(['nova/products/new']);
  });

  it('removes the former external resource only after replacement', async () => {
    const storage = new FakeImageStorage();
    const book = new FakeImageBook();
    book.previousStorageKey = 'nova/products/old';
    const action = new ReplaceProductImage(book, storage, ids, clock);
    await action.execute({ productId, position: 1, content: jpeg });
    expect(storage.removed).toEqual(['nova/products/old']);
  });

  it('deletes the association before cleaning external storage', async () => {
    const storage = new FakeImageStorage();
    const action = new RemoveProductImage(new FakeImageBook(), storage, clock);
    await expect(action.execute({ productId, position: 1 })).resolves.toEqual({
      ok: true,
      removedStorageKey: 'nova/products/old',
    });
    expect(storage.removed).toEqual(['nova/products/old']);
  });
});
