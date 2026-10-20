import type { ProductImagePosition } from '../domain/product-image';
import type { ProductImageStorage } from './product-images';

interface ProductImageRecord {
  readonly id: string;
  readonly storageKey: string;
  readonly position: ProductImagePosition;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly format: string;
}

export interface ProductImageCatalogItem extends Omit<ProductImageRecord, 'storageKey'> {
  readonly url: string;
}

export interface ProductCatalogRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly category: { readonly id: string; readonly name: string };
  readonly tags: readonly { readonly id: string; readonly name: string }[];
  readonly images: readonly ProductImageRecord[];
  readonly minimumPriceCents: number;
  readonly suggestedPriceCents: number | null;
  readonly maximumPriceCents: number | null;
  readonly stock: readonly {
    readonly locationId: string;
    readonly locationCode: string;
    readonly locationName: string;
    readonly physicalQuantity: number;
    readonly reservedQuantity: number;
    readonly reviewQuantity: number;
    readonly availableQuantity: number;
    readonly version: number;
  }[];
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProductCatalogItem extends Omit<ProductCatalogRecord, 'images'> {
  readonly images: readonly ProductImageCatalogItem[];
}

export interface ProductCatalogPage {
  readonly items: readonly ProductCatalogItem[];
  readonly nextProductId: string | null;
}

export interface ProductCatalog {
  findById(productId: string): Promise<ProductCatalogRecord | null>;
  search(input: {
    query?: string;
    categoryId?: string;
    tagId?: string;
    afterProductId?: string;
    limit: number;
  }): Promise<{
    readonly items: readonly ProductCatalogRecord[];
    readonly nextProductId: string | null;
  }>;
}

export type GetProductResult =
  | { readonly ok: true; readonly product: ProductCatalogItem }
  | { readonly ok: false; readonly reason: 'product-not-found' };

export class GetProduct {
  constructor(
    private readonly catalog: ProductCatalog,
    private readonly imageStorage: ProductImageStorage,
  ) {}

  async execute(productId: string): Promise<GetProductResult> {
    const product = await this.catalog.findById(productId);
    if (product === null) return { ok: false, reason: 'product-not-found' };
    return { ok: true, product: withDeliveryUrls(product, this.imageStorage) };
  }
}

export class SearchProducts {
  constructor(
    private readonly catalog: ProductCatalog,
    private readonly imageStorage: ProductImageStorage,
  ) {}

  async execute(input: Parameters<ProductCatalog['search']>[0]): Promise<ProductCatalogPage> {
    const page = await this.catalog.search(input);
    return {
      ...page,
      items: page.items.map((item) => withDeliveryUrls(item, this.imageStorage)),
    };
  }
}

function withDeliveryUrls(
  product: ProductCatalogRecord,
  imageStorage: ProductImageStorage,
): ProductCatalogItem {
  return {
    ...product,
    images: product.images.map(({ storageKey, ...image }) => ({
      ...image,
      url: imageStorage.deliveryUrl(storageKey),
    })),
  };
}
