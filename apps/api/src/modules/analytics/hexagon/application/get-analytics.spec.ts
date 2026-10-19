import { describe, expect, it } from 'vitest';

import type { AnalyticsSource } from './analytics.source';
import { GetCashFlow, GetMonthlyResult, GetProductPerformance } from './get-analytics';

const source: AnalyticsSource = {
  cashMovements: () =>
    Promise.resolve([
      { direction: 'inflow', amountCents: 10_000, method: 'cash', cause: 'sale-payment' },
      { direction: 'outflow', amountCents: 2_000, method: 'cash', cause: 'purchase' },
      { direction: 'inflow', amountCents: 1_000, method: 'yape', cause: 'supplier-refund' },
    ]),
  resultFacts: () =>
    Promise.resolve({
      confirmedSalesCents: 20_000,
      saleAdjustmentsCents: 1_000,
      returnReductionsCents: 2_000,
      cancellationRefundsCents: 0,
      saleCostCents: 8_000,
      returnedCostCents: 500,
      operatingExpensesCents: 2_000,
      inventoryWriteOffLossCents: 300,
      supplierAdvanceLossCents: 200,
      forgivenBalanceCents: 1_000,
      soldUnits: 5,
      returnedUnits: 1,
      writtenOffUnits: 1,
    }),
  userPerformance: () => Promise.resolve([]),
  productPerformance: () =>
    Promise.resolve([
      {
        productId: 'p1',
        code: 'A',
        name: 'Producto A',
        categoryId: 'c1',
        categoryName: 'Ropa',
        productStatus: 'active',
        soldUnits: 3,
        returnedUnits: 1,
        grossSalesCents: 9_000,
        returnReductionsCents: 3_000,
        saleCostCents: 4_500,
        returnedCostCents: 1_500,
        stockByLocation: [
          {
            locationId: 'l1',
            locationName: 'Tienda',
            locationType: 'store',
            physicalQuantity: 5,
            reservedQuantity: 1,
            reviewQuantity: 1,
          },
        ],
      },
    ]),
};

describe('analytics reports', () => {
  it('separates cash inflows and outflows from the net flow', async () => {
    await expect(new GetCashFlow(source).execute('2026-10')).resolves.toMatchObject({
      inflowCents: 11_000,
      outflowCents: 2_000,
      netCashFlowCents: 9_000,
    });
  });

  it('derives commercial result without treating purchases as expenses', async () => {
    await expect(new GetMonthlyResult(source).execute('2026-10')).resolves.toMatchObject({
      netSalesCents: 19_000,
      netSaleCostCents: 7_500,
      grossMarginCents: 11_500,
      totalLossesCents: 1_500,
      estimatedResultCents: 8_000,
    });
  });

  it('keeps profitability and availability as separate product metrics', async () => {
    const report = await new GetProductPerformance(source).execute({
      month: '2026-10',
      sort: 'margin-desc',
      limit: 25,
    });

    expect(report.items[0]).toMatchObject({
      netUnitsSold: 2,
      netSalesCents: 6_000,
      netCostCents: 3_000,
      grossMarginCents: 3_000,
      marginBasisPoints: 5_000,
      availableQuantity: 3,
    });
  });
});
