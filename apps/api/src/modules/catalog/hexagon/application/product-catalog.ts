export interface ProductCatalogItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly category: { readonly id: string; readonly name: string };
  readonly tags: readonly { readonly id: string; readonly name: string }[];
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

export interface ProductCatalogPage {
  readonly items: readonly ProductCatalogItem[];
  readonly nextProductId: string | null;
}

export interface ProductCatalog {
  search(input: {
    query?: string;
    categoryId?: string;
    tagId?: string;
    afterProductId?: string;
    limit: number;
  }): Promise<ProductCatalogPage>;
}

export class SearchProducts {
  constructor(private readonly catalog: ProductCatalog) {}

  execute(input: Parameters<ProductCatalog['search']>[0]): Promise<ProductCatalogPage> {
    return this.catalog.search(input);
  }
}
