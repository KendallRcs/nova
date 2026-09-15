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
import { TransferInventory } from '../../src/modules/inventory/hexagon/application/transfer-inventory';

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
        permissionCodes: ['inventory:read', 'inventory:transfer'],
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
});

function balance(locationId: string, quantity: number) {
  return {
    locationId,
    physicalQuantity: quantity,
    reservedQuantity: 0,
    reviewQuantity: 0,
    availableQuantity: quantity,
  };
}
