import { describe, expect, it } from 'vitest';

import {
  ListProductCosts,
  type ProductCostCatalog,
  type ProductCostRecord,
} from './product-cost-catalog';

const record: ProductCostRecord = {
  productId: '0199ef04-1b00-7000-8000-000000000101',
  code: 'MUN-001',
  name: 'Muñeca',
  isActive: true,
  minimumPriceCents: 4_000,
  suggestedPriceCents: 5_000,
  maximumPriceCents: null,
  availableQuantity: 3,
  availableValueCents: 7_501,
  reservedQuantity: 1,
  reservedValueCents: 2_400,
  reviewQuantity: 1,
  reviewValueCents: 2_600,
  lastPurchaseUnitCostCents: 3_000,
  lastPurchasedAt: new Date('2026-10-19T18:00:00.000Z'),
  policy: 'moving-average-v1',
  version: 4,
};

describe('ListProductCosts', () => {
  it('calculates current averages from the value and units in each bucket', async () => {
    const received: unknown[] = [];
    const catalog: ProductCostCatalog = {
      list: (query) => {
        received.push(query);
        return Promise.resolve([record]);
      },
    };

    await expect(new ListProductCosts(catalog).execute('muñeca')).resolves.toEqual([
      {
        productId: record.productId,
        code: 'MUN-001',
        name: 'Muñeca',
        isActive: true,
        minimumPriceCents: 4_000,
        suggestedPriceCents: 5_000,
        maximumPriceCents: null,
        available: { quantity: 3, valueCents: 7_501, averageUnitCostCents: 2_500 },
        reserved: { quantity: 1, valueCents: 2_400, averageUnitCostCents: 2_400 },
        review: { quantity: 1, valueCents: 2_600, averageUnitCostCents: 2_600 },
        total: { quantity: 5, valueCents: 12_501, averageUnitCostCents: 2_500 },
        lastPurchaseUnitCostCents: 3_000,
        lastPurchasedAt: new Date('2026-10-19T18:00:00.000Z'),
        policy: 'moving-average-v1',
        version: 4,
      },
    ]);
    expect(received).toEqual(['muñeca']);
  });

  it('does not invent an average when there are no valued units', async () => {
    const catalog: ProductCostCatalog = {
      list: () =>
        Promise.resolve([
          {
            ...record,
            availableQuantity: 0,
            availableValueCents: 0,
            reservedQuantity: 0,
            reservedValueCents: 0,
            reviewQuantity: 0,
            reviewValueCents: 0,
          },
        ]),
    };

    const [view] = await new ListProductCosts(catalog).execute();
    expect(view?.available.averageUnitCostCents).toBeNull();
    expect(view?.total.averageUnitCostCents).toBeNull();
  });
});
