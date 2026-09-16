import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import type { AuthenticatedRequest } from '../../src/modules/identity-access/adapters/driving/http/permission.guard';
import { SalesController } from '../../src/modules/sales/adapters/driving/http/sales.controller';
import {
  CreateSaleDraft,
  UpdateSaleDraft,
} from '../../src/modules/sales/hexagon/application/manage-sale-drafts';
import { ConfirmSale } from '../../src/modules/sales/hexagon/application/confirm-sale';
import { Sale } from '../../src/modules/sales/hexagon/domain/sale';

const SALE_ID = '0199ef04-1b00-7000-8000-000000000080';
const LINE_ID = '0199ef04-1b00-7000-8000-000000000081';
const ACTOR_ID = '0199ef04-1b00-7000-8000-000000000082';
const PRODUCT_ID = '0199ef04-1b00-7000-8000-000000000083';
const LOCATION_ID = '0199ef04-1b00-7000-8000-000000000084';

describe('Sales HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [
        { provide: CreateSaleDraft, useValue: { execute: () => Promise.resolve(draft(1)) } },
        { provide: UpdateSaleDraft, useValue: { execute: () => Promise.resolve(draft(2)) } },
        {
          provide: ConfirmSale,
          useValue: {
            execute: (command: { operationId: string; saleId: string }) =>
              Promise.resolve({
                ok: true,
                replayed: false,
                confirmation: {
                  saleId: command.saleId,
                  operationId: command.operationId,
                  version: 2,
                  confirmedBy: ACTOR_ID,
                  confirmedAt: new Date('2026-09-15T21:00:00.000Z'),
                  totalCents: 3_000,
                  deliveredQuantity: 1,
                  reservedQuantity: 1,
                  allocatedCostCents: 1_000,
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
        username: 'employee',
        securityVersion: 1,
        permissionCodes: ['sales:create', 'sales:update-own-draft'],
        requiresPasswordChange: false,
      };
      next();
    });
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

  it('creates a multi-line sale draft without inventory or cash effects', async () => {
    const response = await request(httpServer)
      .post('/api/v1/sales')
      .send({ lines: [lineRequest()] })
      .expect(201);
    expect(response.body).toMatchObject({
      id: SALE_ID,
      lifecycle: 'draft',
      createdBy: ACTOR_ID,
      originalTotalCents: 3_000,
      version: 1,
      lines: [{ pendingQuantity: 0 }],
    });
  });

  it('replaces an owned draft using optimistic concurrency', async () => {
    const response = await request(httpServer)
      .put(`/api/v1/sales/${SALE_ID}`)
      .send({ expectedVersion: 1, dueDate: '2026-10-15', lines: [lineRequest()] })
      .expect(200);
    expect(response.body).toMatchObject({ version: 2 });
  });

  it('rejects malformed sale references at the HTTP boundary', async () => {
    await request(httpServer)
      .post('/api/v1/sales')
      .send({ lines: [{ ...lineRequest(), productId: 'not-a-uuid' }] })
      .expect(422);
  });

  it('confirms a draft through an idempotent inventory command', async () => {
    const response = await request(httpServer)
      .post(`/api/v1/sales/${SALE_ID}/confirmation`)
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000086')
      .send({ expectedVersion: 1, priceExceptions: [] })
      .expect(200);
    expect(response.body).toMatchObject({
      saleId: SALE_ID,
      version: 2,
      deliveredQuantity: 1,
      reservedQuantity: 1,
      replayed: false,
    });
  });
});

function draft(version: number) {
  const result = Sale.createDraft({
    id: SALE_ID,
    createdBy: ACTOR_ID,
    lines: [{ id: LINE_ID, ...lineRequest() }],
    now: new Date('2026-09-15T20:00:00.000Z'),
  });
  if (!result.ok) throw new Error(result.reason);
  if (version === 2) {
    const revised = result.sale.reviseDraft({
      lines: [{ id: LINE_ID, ...lineRequest() }],
      now: new Date('2026-09-15T20:01:00.000Z'),
    });
    if (!revised.ok) throw new Error(revised.reason);
  }
  return { ok: true as const, sale: result.sale };
}
function lineRequest() {
  return {
    productId: PRODUCT_ID,
    locationId: LOCATION_ID,
    quantity: 2,
    deliveryQuantity: 1,
    reservationQuantity: 1,
    agreedUnitPriceCents: 1_500,
  };
}
