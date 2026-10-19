import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import { AnalyticsController } from '../../src/modules/analytics/adapters/driving/http/analytics.controller';
import {
  GetCashFlow,
  GetMonthlyResult,
  GetProductPerformance,
  GetUserPerformance,
} from '../../src/modules/analytics/hexagon/application/get-analytics';

describe('Analytics HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: GetCashFlow,
          useValue: {
            execute: (month: string) =>
              Promise.resolve({
                month,
                inflowCents: 20_000,
                outflowCents: 8_000,
                netCashFlowCents: 12_000,
                byMethod: [
                  { method: 'cash', inflowCents: 20_000, outflowCents: 8_000, netCents: 12_000 },
                ],
                byCause: [
                  {
                    cause: 'sale-payment',
                    inflowCents: 20_000,
                    outflowCents: 0,
                    netCents: 20_000,
                  },
                ],
              }),
          },
        },
        {
          provide: GetMonthlyResult,
          useValue: {
            execute: (month: string) =>
              Promise.resolve({
                month,
                confirmedSalesCents: 30_000,
                saleAdjustmentsCents: 0,
                returnReductionsCents: 2_000,
                cancellationRefundsCents: 0,
                netSalesCents: 28_000,
                saleCostCents: 12_000,
                returnedCostCents: 1_000,
                netSaleCostCents: 11_000,
                grossMarginCents: 17_000,
                operatingExpensesCents: 3_000,
                inventoryWriteOffLossCents: 500,
                supplierAdvanceLossCents: 0,
                forgivenBalanceCents: 500,
                totalLossesCents: 1_000,
                estimatedResultCents: 13_000,
                soldUnits: 6,
                returnedUnits: 1,
                writtenOffUnits: 1,
              }),
          },
        },
        {
          provide: GetUserPerformance,
          useValue: {
            execute: (month: string) =>
              Promise.resolve({
                month,
                items: [
                  {
                    userId: '0199ef04-1b00-7000-8000-000000000201',
                    username: 'ana',
                    accountStatus: 'active',
                    salesCount: 2,
                    salesAmountCents: 30_000,
                    averageSaleTicketCents: 15_000,
                    paymentsCount: 3,
                    paymentsAmountCents: 20_000,
                    administrativeOperationsCount: 0,
                    administrativeAmountCents: 0,
                  },
                ],
              }),
          },
        },
        {
          provide: GetProductPerformance,
          useValue: {
            execute: (input: { month: string; sort: string; limit: number }) =>
              Promise.resolve({
                month: input.month,
                sort: input.sort,
                items: [
                  {
                    productId: '0199ef04-1b00-7000-8000-000000000301',
                    code: 'POLO-01',
                    name: 'Polo',
                    categoryId: '0199ef04-1b00-7000-8000-000000000302',
                    categoryName: 'Ropa',
                    productStatus: 'active',
                    soldUnits: 3,
                    returnedUnits: 1,
                    netUnitsSold: 2,
                    grossSalesCents: 9_000,
                    returnReductionsCents: 3_000,
                    netSalesCents: 6_000,
                    saleCostCents: 4_500,
                    returnedCostCents: 1_500,
                    netCostCents: 3_000,
                    grossMarginCents: 3_000,
                    marginBasisPoints: 5_000,
                    physicalQuantity: 5,
                    reservedQuantity: 1,
                    reviewQuantity: 1,
                    availableQuantity: 3,
                    stockByLocation: [
                      {
                        locationId: '0199ef04-1b00-7000-8000-000000000303',
                        locationName: 'Tienda',
                        locationType: 'store',
                        physicalQuantity: 5,
                        reservedQuantity: 1,
                        reviewQuantity: 1,
                      },
                    ],
                  },
                ],
              }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: false,
        validationError: { target: false, value: false },
        exceptionFactory: validationProblem,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => app.close());

  it('exposes cash flow and monthly result as different reports', async () => {
    await request(httpServer)
      .get('/api/v1/dashboards/cash-flow?month=2026-10')
      .expect(200)
      .expect((response) => {
        expect(response.body as unknown).toMatchObject({ netCashFlowCents: 12_000 });
      });
    await request(httpServer)
      .get('/api/v1/dashboards/monthly-result?month=2026-10')
      .expect(200)
      .expect((response) => {
        expect(response.body as unknown).toMatchObject({ estimatedResultCents: 13_000 });
      });
  });

  it('keeps sales and payments separate in user performance', async () => {
    await request(httpServer)
      .get('/api/v1/dashboards/user-performance?month=2026-10')
      .expect(200)
      .expect((response) => {
        expect(response.body as unknown).toMatchObject({
          items: [{ salesCount: 2, paymentsCount: 3 }],
        });
      });
  });

  it('supports product ordering and an explicit result limit', async () => {
    await request(httpServer)
      .get('/api/v1/dashboards/product-performance?month=2026-10&sort=availability-asc&limit=10')
      .expect(200)
      .expect((response) => {
        expect(response.body as unknown).toMatchObject({
          sort: 'availability-asc',
          items: [{ availableQuantity: 3, grossMarginCents: 3_000 }],
        });
      });
  });

  it('rejects invalid months and limits', async () => {
    await request(httpServer).get('/api/v1/dashboards/cash-flow?month=2026-13').expect(422);
    await request(httpServer)
      .get('/api/v1/dashboards/product-performance?month=2026-10&limit=101')
      .expect(422);
  });
});
