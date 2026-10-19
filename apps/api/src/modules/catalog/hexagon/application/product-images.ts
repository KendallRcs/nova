import type { Clock, IdGenerator } from './category.dependencies';
import {
  validateProductImage,
  type ProductImageMediaType,
  type ProductImagePosition,
} from '../domain/product-image';

export interface StoredProductImage {
  readonly storageKey: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly format: string;
}

export interface ProductImageView extends StoredProductImage {
  readonly id: string;
  readonly productId: string;
  readonly position: ProductImagePosition;
  readonly url: string;
}

export interface ProductImageStorage {
  store(input: {
    assetId: string;
    productId: string;
    content: Uint8Array;
    mediaType: ProductImageMediaType;
  }): Promise<StoredProductImage>;
  remove(storageKey: string): Promise<boolean>;
  deliveryUrl(storageKey: string): string;
}

export type ReplaceProductImageBookResult =
  | { readonly ok: false; readonly reason: 'product-not-found' }
  | { readonly ok: true; readonly previousStorageKey: string | null };

export type RemoveProductImageBookResult =
  | { readonly ok: false; readonly reason: 'product-not-found' | 'image-not-found' }
  | { readonly ok: true; readonly removedStorageKey: string };

export interface ProductImageBook {
  productExists(productId: string): Promise<boolean>;
  replace(input: {
    id: string;
    productId: string;
    position: ProductImagePosition;
    image: StoredProductImage;
    now: Date;
  }): Promise<ReplaceProductImageBookResult>;
  remove(input: {
    productId: string;
    position: ProductImagePosition;
    now: Date;
  }): Promise<RemoveProductImageBookResult>;
}

export class ProductImageStorageUnavailableError extends Error {
  constructor(message = 'El almacenamiento de imágenes no está disponible.') {
    super(message);
    this.name = 'ProductImageStorageUnavailableError';
  }
}

export type ReplaceProductImageResult =
  | { readonly ok: true; readonly image: ProductImageView }
  | {
      readonly ok: false;
      readonly reason:
        'product-not-found' | 'empty-image' | 'image-too-large' | 'unsupported-image-format';
    };

export class ReplaceProductImage {
  constructor(
    private readonly book: ProductImageBook,
    private readonly storage: ProductImageStorage,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    productId: string;
    position: ProductImagePosition;
    content: Uint8Array;
  }): Promise<ReplaceProductImageResult> {
    const validation = validateProductImage(input.content);
    if (!validation.ok) return { ok: false, reason: validationReason(validation.reason) };
    if (!(await this.book.productExists(input.productId))) {
      return { ok: false, reason: 'product-not-found' };
    }

    const id = this.idGenerator.generate();
    const stored = await this.storage.store({
      assetId: id,
      productId: input.productId,
      content: input.content,
      mediaType: validation.mediaType,
    });

    let persisted: ReplaceProductImageBookResult;
    try {
      persisted = await this.book.replace({
        id,
        productId: input.productId,
        position: input.position,
        image: stored,
        now: this.clock.now(),
      });
    } catch (error) {
      await this.storage.remove(stored.storageKey);
      throw error;
    }
    if (!persisted.ok) {
      await this.storage.remove(stored.storageKey);
      return persisted;
    }
    if (
      persisted.previousStorageKey !== null &&
      persisted.previousStorageKey !== stored.storageKey
    ) {
      await this.storage.remove(persisted.previousStorageKey);
    }

    return {
      ok: true,
      image: {
        id,
        productId: input.productId,
        position: input.position,
        ...stored,
        url: this.storage.deliveryUrl(stored.storageKey),
      },
    };
  }
}

export class RemoveProductImage {
  constructor(
    private readonly book: ProductImageBook,
    private readonly storage: ProductImageStorage,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    productId: string;
    position: ProductImagePosition;
  }): Promise<RemoveProductImageBookResult> {
    const result = await this.book.remove({ ...input, now: this.clock.now() });
    if (result.ok) await this.storage.remove(result.removedStorageKey);
    return result;
  }
}

function validationReason(
  reason: 'empty' | 'too-large' | 'unsupported-format',
): 'empty-image' | 'image-too-large' | 'unsupported-image-format' {
  if (reason === 'empty') return 'empty-image';
  if (reason === 'too-large') return 'image-too-large';
  return 'unsupported-image-format';
}
