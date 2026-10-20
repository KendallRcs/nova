import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import { InventoryController } from '../../src/modules/inventory/adapters/driving/http/inventory.controller';
import type { AuthenticatedRequest } from '../../src/modules/identity-access/adapters/driving/http/permission.guard';
import { ListInventoryLocations } from '../../src/modules/inventory/hexagon/application/inventory-catalog';
import {
  AdjustInventoryCount,
  ResolveInventoryReview,
  WriteOffInventory,
} from '../../src/modules/inventory/hexagon/application/administer-inventory';
import { TransferInventory } from '../../src/modules/inventory/hexagon/application/transfer-inventory';
import { ListProductCosts } from '../../src/modules/inventory/hexagon/application/product-cost-catalog';
import { ListInventoryMovements } from '../../src/modules/inventory/hexagon/application/inventory-movement-history';

const STORE_ID = '0199ef04-1b00-7000-8000-000000000001';
const WAREHOUSE_ID = '0199ef04-1b00-7000-8000-000000000002';
const PRODUCT_ID = '0199eec8-7900-7000-8000-000000000001';
const ACTOR_ID = '0199eec8-7900-7000-8000-000000000004';

describe('Inventory HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        {
          provide: ListInventoryLocations,
          useValue: {
            execute: () =>
              Promise.resolve([
                { id: STORE_ID, code: 'STORE', name: 'Tienda', type: 'store' },
                { id: WAREHOUSE_ID, code: 'WAREHOUSE', name: 'Almacén', type: 'warehouse' },
              ]),
          },
        },
        {
          provide: TransferInventory,
          useValue: {
            transfer: (command: { operationId: string }) =>
              Promise.resolve({
                ok: true,
                replayed: false,
                transfer: {
                  transferId: '0199ef04-1b00-7000-8000-000000000010',
                  operationId: command.operationId,
                  productId: PRODUCT_ID,
                  originLocationId: STORE_ID,
                  destinationLocationId: WAREHOUSE_ID,
                  quantity: 2,
                  actorId: ACTOR_ID,
                  effectiveAt: new Date('2026-09-15T17:00:00.000Z'),
                  origin: balance(STORE_ID, 3),
                  destination: balance(WAREHOUSE_ID, 2),
                },
              }),
          },
        },
        {
          provide: WriteOffInventory,
          useValue: { execute: administrationResult('write-off', -2, -500) },
        },
        {
          provide: AdjustInventoryCount,
          useValue: { execute: administrationResult('adjustment-in', 2, 500) },
        },
        {
          provide: ResolveInventoryReview,
          useValue: { execute: administrationResult('review-approved', 0, 250) },
        },
        {
          provide: ListProductCosts,
          useValue: {
            execute: () =>
              Promise.resolve([
                {
                  productId: PRODUCT_ID,
                  code: 'MUN-001',
                  name: 'Muñeca',
                  isActive: true,
                  minimumPriceCents: 4_000,
                  suggestedPriceCents: 5_000,
                  maximumPriceCents: null,
                  available: { quantity: 3, valueCents: 7_500, averageUnitCostCents: 2_500 },
                  reserved: { quantity: 1, valueCents: 2_400, averageUnitCostCents: 2_400 },
                  review: { quantity: 1, valueCents: 2_600, averageUnitCostCents: 2_600 },
                  total: { quantity: 5, valueCents: 12_500, averageUnitCostCents: 2_500 },
                  lastPurchaseUnitCostCents: 3_000,
                  lastPurchasedAt: new Date('2026-10-19T18:00:00.000Z'),
                  policy: 'moving-average-v1',
                  version: 4,
                },
              ]),
          },
        },
        {
          provide: ListInventoryMovements,
          useValue: {
            execute: () =>
              Promise.resolve({
                items: [
                  {
                    id: '0199ef04-1b00-7000-8000-000000000030',
                    product: {
                      id: PRODUCT_ID,
                      currentCode: 'MUN-001',
                      currentName: 'Muñeca',
                    },
                    location: { id: STORE_ID, code: 'STORE', name: 'Tienda', type: 'store' },
                    type: 'delivery',
                    physicalDelta: -1,
                    reservedDelta: 0,
                    reviewDelta: 0,
                    previous: {
                      physicalQuantity: 5,
                      reservedQuantity: 0,
                      reviewQuantity: 0,
                      availableQuantity: 5,
                    },
                    resulting: {
                      physicalQuantity: 4,
                      reservedQuantity: 0,
                      reviewQuantity: 0,
                      availableQuantity: 4,
                    },
                    actor: { id: ACTOR_ID, username: 'admin' },
                    effectiveAt: new Date('2026-10-19T18:30:00.000Z'),
                    reason: null,
                    administrativeCategory: null,
                    references: {
                      operationId: null,
                      transferId: null,
                      saleId: '0199ef04-1b00-7000-8000-000000000031',
                      saleLineId: '0199ef04-1b00-7000-8000-000000000032',
                      returnId: null,
                      returnLineId: null,
                      cancellationId: null,
                      cancellationLineId: null,
                      deliveryId: null,
                      deliveryLineId: null,
                      purchaseId: null,
                      purchaseLineId: null,
                      initialImportId: null,
                    },
                  },
                ],
                nextMovementId: null,
              }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use((incoming: AuthenticatedRequest, _response: Response, next: NextFunction) => {
      incoming.novaActor = {
        sessionId: 'session-1',
        userId: ACTOR_ID,
        username: 'admin',
        securityVersion: 1,
        permissionCodes: [
          'inventory:read',
          'inventory:transfer',
          'inventory:write-off',
          'inventory:adjust',
          'inventory:inspect-return',
          'dashboards:financial',
        ],
        requiresPasswordChange: false,
      };
      next();
    });
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        transform: false,
        validationError: { target: false, value: false },
        exceptionFactory: validationProblem,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => app.close());

  it('lists the fixed operational locations', async () => {
    await request(httpServer)
      .get('/api/v1/inventory/locations')
      .expect(200)
      .expect({
        items: [
          { id: STORE_ID, code: 'STORE', name: 'Tienda', type: 'store' },
          { id: WAREHOUSE_ID, code: 'WAREHOUSE', name: 'Almacén', type: 'warehouse' },
        ],
      });
  });

  it('exposes current and last purchase costs only through the administrative endpoint', async () => {
    await request(httpServer)
      .get('/api/v1/inventory/cost-positions?query=muneca')
      .expect(200)
      .expect({
        items: [
          {
            productId: PRODUCT_ID,
            code: 'MUN-001',
            name: 'Muñeca',
            isActive: true,
            minimumPriceCents: 4_000,
            suggestedPriceCents: 5_000,
            maximumPriceCents: null,
            available: { quantity: 3, valueCents: 7_500, averageUnitCostCents: 2_500 },
            reserved: { quantity: 1, valueCents: 2_400, averageUnitCostCents: 2_400 },
            review: { quantity: 1, valueCents: 2_600, averageUnitCostCents: 2_600 },
            total: { quantity: 5, valueCents: 12_500, averageUnitCostCents: 2_500 },
            lastPurchaseUnitCostCents: 3_000,
            lastPurchasedAt: '2026-10-19T18:00:00.000Z',
            policy: 'moving-average-v1',
            version: 4,
          },
        ],
      });
  });

  it('lists inventory movements with balances and their business reference without costs', async () => {
    await request(httpServer)
      .get(`/api/v1/inventory/movements?productId=${PRODUCT_ID}&type=delivery`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          items: [
            {
              product: { id: PRODUCT_ID, currentCode: 'MUN-001' },
              location: { id: STORE_ID, code: 'STORE' },
              type: 'delivery',
              physicalDelta: -1,
              previous: { availableQuantity: 5 },
              resulting: { availableQuantity: 4 },
              actor: { id: ACTOR_ID, username: 'admin' },
              effectiveAt: '2026-10-19T18:30:00.000Z',
              references: { saleId: '0199ef04-1b00-7000-8000-000000000031' },
            },
          ],
          pageInfo: { nextCursor: null, hasNextPage: false },
        });
        const body = response.body as { items: Record<string, unknown>[] };
        expect(body.items[0]).not.toHaveProperty('valueDeltaCents');
      });
  });

  it('requires an idempotency key and exposes resulting balances', async () => {
    const body = {
      productId: PRODUCT_ID,
      originLocationId: STORE_ID,
      destinationLocationId: WAREHOUSE_ID,
      quantity: 2,
    };
    await request(httpServer).post('/api/v1/inventory/transfers').send(body).expect(422);
    const response = await request(httpServer)
      .post('/api/v1/inventory/transfers')
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000020')
      .send(body)
      .expect(201);
    expect(response.body).toMatchObject({
      operationId: '0199ef04-1b00-7000-8000-000000000020',
      quantity: 2,
      transferredBy: ACTOR_ID,
      origin: { locationId: STORE_ID, availableQuantity: 3 },
      destination: { locationId: WAREHOUSE_ID, availableQuantity: 2 },
      replayed: false,
    });
  });

  it('writes off stock with an explicit category and reason', async () => {
    const response = await request(httpServer)
      .post('/api/v1/inventory/write-offs')
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000021')
      .send({
        productId: PRODUCT_ID,
        locationId: STORE_ID,
        quantity: 2,
        category: 'damaged',
        reason: 'Empaque destruido',
      })
      .expect(201);
    expect(response.body).toMatchObject({
      type: 'write-off',
      physicalDelta: -2,
      valueDeltaCents: -500,
      category: 'damaged',
      replayed: false,
    });
  });

  it('adjusts a physical count using the observed stock version', async () => {
    const response = await request(httpServer)
      .post('/api/v1/inventory/count-adjustments')
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000022')
      .send({
        productId: PRODUCT_ID,
        locationId: STORE_ID,
        observedPhysicalQuantity: 7,
        expectedPositionVersion: 3,
        declaredUnitCostCents: 250,
        reason: 'Conteo físico',
      })
      .expect(201);
    expect(response.body).toMatchObject({
      type: 'adjustment-in',
      physicalDelta: 2,
      valueDeltaCents: 500,
      declaredUnitCostCents: 250,
      replayed: false,
    });
  });

  it('approves reviewed stock for sale with optimistic concurrency', async () => {
    const response = await request(httpServer)
      .post('/api/v1/inventory/review-resolutions')
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000023')
      .send({
        productId: PRODUCT_ID,
        locationId: STORE_ID,
        quantity: 1,
        expectedPositionVersion: 4,
        resolution: 'available',
        reason: 'Producto revisado y apto',
      })
      .expect(201);
    expect(response.body).toMatchObject({
      type: 'review-approved',
      physicalDelta: 0,
      valueDeltaCents: 250,
      category: null,
      replayed: false,
    });
  });
});

function administrationResult(
  type: 'write-off' | 'adjustment-in' | 'review-approved',
  physicalDelta: number,
  valueDeltaCents: number,
) {
  return (command: {
    operationId: string;
    productId: string;
    locationId: string;
    actorId: string;
    reason: string;
    category?: 'damaged';
    declaredUnitCostCents?: number | null;
  }) =>
    Promise.resolve({
      ok: true as const,
      replayed: false,
      movement: {
        movementId: '0199ef04-1b00-7000-8000-000000000030',
        operationId: command.operationId,
        productId: command.productId,
        locationId: command.locationId,
        type,
        physicalDelta,
        valueDeltaCents,
        physicalQuantity: 7,
        reservedQuantity: 0,
        reviewQuantity: 0,
        availableQuantity: 7,
        availableCostQuantity: 7,
        availableCostValueCents: 1750,
        actorId: command.actorId,
        effectiveAt: new Date('2026-09-15T17:00:00.000Z'),
        reason: command.reason,
        category: command.category ?? null,
        declaredUnitCostCents: command.declaredUnitCostCents ?? null,
      },
    });
}

function balance(locationId: string, quantity: number) {
  return {
    locationId,
    physicalQuantity: quantity,
    reservedQuantity: 0,
    reviewQuantity: 0,
    availableQuantity: quantity,
  };
}
