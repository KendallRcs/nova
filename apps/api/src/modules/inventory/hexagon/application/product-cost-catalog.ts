export interface ProductCostRecord {
  readonly productId: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly minimumPriceCents: number;
  readonly suggestedPriceCents: number | null;
  readonly maximumPriceCents: number | null;
  readonly availableQuantity: number;
  readonly availableValueCents: number;
  readonly reservedQuantity: number;
  readonly reservedValueCents: number;
  readonly reviewQuantity: number;
  readonly reviewValueCents: number;
  readonly lastPurchaseUnitCostCents: number | null;
  readonly lastPurchasedAt: Date | null;
  readonly policy: 'moving-average-v1' | null;
  readonly version: number | null;
}

export interface ProductCostCatalog {
  list(query?: string): Promise<readonly ProductCostRecord[]>;
}

export interface ProductCostBucket {
  readonly quantity: number;
  readonly valueCents: number;
  readonly averageUnitCostCents: number | null;
}

export interface ProductCostView {
  readonly productId: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly minimumPriceCents: number;
  readonly suggestedPriceCents: number | null;
  readonly maximumPriceCents: number | null;
  readonly available: ProductCostBucket;
  readonly reserved: ProductCostBucket;
  readonly review: ProductCostBucket;
  readonly total: ProductCostBucket;
  readonly lastPurchaseUnitCostCents: number | null;
  readonly lastPurchasedAt: Date | null;
  readonly policy: 'moving-average-v1' | null;
  readonly version: number | null;
}

export class ListProductCosts {
  constructor(private readonly catalog: ProductCostCatalog) {}

  async execute(query?: string): Promise<readonly ProductCostView[]> {
    return (await this.catalog.list(query)).map(toView);
  }
}

function toView(record: ProductCostRecord): ProductCostView {
  const totalQuantity = record.availableQuantity + record.reservedQuantity + record.reviewQuantity;
  const totalValueCents = safeNumber(
    BigInt(record.availableValueCents) +
      BigInt(record.reservedValueCents) +
      BigInt(record.reviewValueCents),
  );
  return {
    productId: record.productId,
    code: record.code,
    name: record.name,
    isActive: record.isActive,
    minimumPriceCents: record.minimumPriceCents,
    suggestedPriceCents: record.suggestedPriceCents,
    maximumPriceCents: record.maximumPriceCents,
    available: bucket(record.availableQuantity, record.availableValueCents),
    reserved: bucket(record.reservedQuantity, record.reservedValueCents),
    review: bucket(record.reviewQuantity, record.reviewValueCents),
    total: bucket(totalQuantity, totalValueCents),
    lastPurchaseUnitCostCents: record.lastPurchaseUnitCostCents,
    lastPurchasedAt: record.lastPurchasedAt,
    policy: record.policy,
    version: record.version,
  };
}

function bucket(quantity: number, valueCents: number): ProductCostBucket {
  return {
    quantity,
    valueCents,
    averageUnitCostCents: quantity === 0 ? null : Math.floor(valueCents / quantity),
  };
}

function safeNumber(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Cost amount exceeds safe integer range.');
  return result;
}
