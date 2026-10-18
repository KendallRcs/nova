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
import { RecordSalePayment } from '../../src/modules/sales/hexagon/application/record-sale-payment';
import { ListSales } from '../../src/modules/sales/hexagon/application/sale-activity';
import { GetSaleDetail } from '../../src/modules/sales/hexagon/application/sale-detail';
import { ApproveSaleReturn } from '../../src/modules/sales/hexagon/application/approve-sale-return';
import { CancelSale } from '../../src/modules/sales/hexagon/application/cancel-sale';
import {
  AdjustSaleTotal,
  CorrectSalePayment,
  FinalizeSale,
} from '../../src/modules/sales/hexagon/application/manage-sale-financials';
import { Sale } from '../../src/modules/sales/hexagon/domain/sale';

const SALE_ID = '0199ef04-1b00-7000-8000-000000000080';
const LINE_ID = '0199ef04-1b00-7000-8000-000000000081';
const ACTOR_ID = '0199ef04-1b00-7000-8000-000000000082';
const PRODUCT_ID = '0199ef04-1b00-7000-8000-000000000083';
const LOCATION_ID = '0199ef04-1b00-7000-8000-000000000084';
const PAYMENT_ID = '0199ef04-1b00-7000-8000-000000000087';

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
                  initialPaymentCents: 0,
                  balanceCents: 3_000,
                  paymentSituation: 'unpaid',
                },
              }),
          },
        },
        {
          provide: RecordSalePayment,
          useValue: {
            execute: (command: {
              operationId: string;
              saleId: string;
              amountCents: number;
              method: 'cash' | 'yape' | 'plin' | 'pos';
            }) =>
              Promise.resolve({
                ok: true,
                replayed: false,
                payment: {
                  paymentId: '0199ef04-1b00-7000-8000-000000000087',
                  operationId: command.operationId,
                  saleId: command.saleId,
                  saleVersion: 3,
                  amountCents: command.amountCents,
                  method: command.method,
                  registeredBy: ACTOR_ID,
                  effectiveAt: new Date('2026-09-16T15:00:00.000Z'),
                  paidCents: command.amountCents,
                  balanceCents: 2_000,
                  paymentSituation: 'partial',
                },
              }),
          },
        },
        {
          provide: ListSales,
          useValue: {
            execute: () =>
              Promise.resolve({
                items: [
                  {
                    id: SALE_ID,
                    createdBy: ACTOR_ID,
                    creatorUsername: 'employee',
                    customer: null,
                    lifecycle: 'confirmed',
                    originalTotalCents: 3_000,
                    currentTotalCents: 3_000,
                    paidCents: 1_000,
                    balanceCents: 2_000,
                    paymentSituation: 'partial',
                    deliverySituation: 'partial',
                    overdue: true,
                    dueDate: '2026-09-15',
                    version: 3,
                    confirmedAt: new Date('2026-09-15T21:00:00.000Z'),
                    createdAt: new Date('2026-09-15T20:00:00.000Z'),
                    updatedAt: new Date('2026-09-16T15:00:00.000Z'),
                  },
                ],
                nextSaleId: null,
              }),
          },
        },
        {
          provide: GetSaleDetail,
          useValue: {
            execute: () =>
              Promise.resolve({
                ok: true,
                sale: {
                  id: SALE_ID,
                  createdBy: ACTOR_ID,
                  creatorUsername: 'employee',
                  customer: null,
                  lifecycle: 'confirmed',
                  originalTotalCents: 3_000,
                  currentTotalCents: 3_000,
                  paidCents: 1_000,
                  balanceCents: 2_000,
                  paymentSituation: 'partial',
                  deliverySituation: 'partial',
                  overdue: true,
                  dueDate: '2026-09-15',
                  paymentAgreementNote: null,
                  lines: [],
                  payments: [],
                  totalAdjustments: [],
                  returns: [],
                  cancellation: null,
                  closure: null,
                  version: 3,
                  confirmedAt: new Date('2026-09-15T21:00:00.000Z'),
                  finalizedAt: null,
                  cancelledAt: null,
                  createdAt: new Date('2026-09-15T20:00:00.000Z'),
                  updatedAt: new Date('2026-09-16T15:00:00.000Z'),
                },
              }),
          },
        },
        {
          provide: AdjustSaleTotal,
          useValue: {
            execute: (command: { operationId: string; saleId: string; newTotalCents: number }) =>
              Promise.resolve({
                ok: true,
                replayed: false,
                adjustment: {
                  adjustmentId: '0199ef04-1b00-7000-8000-000000000091',
                  operationId: command.operationId,
                  saleId: command.saleId,
                  saleVersion: 4,
                  previousTotalCents: 3_000,
                  currentTotalCents: command.newTotalCents,
                  differenceCents: command.newTotalCents - 3_000,
                  reason: 'Acuerdo final',
                  changedBy: ACTOR_ID,
                  effectiveAt: new Date('2026-09-17T15:00:00.000Z'),
                },
              }),
          },
        },
        {
          provide: FinalizeSale,
          useValue: {
            execute: (command: { operationId: string; saleId: string; reason: string | null }) =>
              Promise.resolve({
                ok: true,
                replayed: false,
                closure: {
                  closureId: '0199ef04-1b00-7000-8000-000000000092',
                  operationId: command.operationId,
                  saleId: command.saleId,
                  saleVersion: 6,
                  type: 'incomplete',
                  forgivenAmountCents: 1_500,
                  reason: command.reason,
                  closedBy: ACTOR_ID,
                  effectiveAt: new Date('2026-09-17T16:00:00.000Z'),
                },
              }),
          },
        },
        {
          provide: CorrectSalePayment,
          useValue: {
            execute: (command: {
              operationId: string;
              saleId: string;
              paymentId: string;
              amountCents: number;
              reason: string;
            }) =>
              Promise.resolve({
                ok: true,
                replayed: false,
                correction: {
                  correctionId: '0199ef04-1b00-7000-8000-000000000093',
                  operationId: command.operationId,
                  saleId: command.saleId,
                  paymentId: command.paymentId,
                  saleVersion: 5,
                  amountCents: command.amountCents,
                  method: 'yape',
                  reason: command.reason,
                  correctedBy: ACTOR_ID,
                  effectiveAt: new Date('2026-09-17T15:30:00.000Z'),
                },
              }),
          },
        },
        {
          provide: ApproveSaleReturn,
          useValue: {
            execute: (command: {
              operationId: string;
              saleId: string;
              refundMethod: 'cash' | 'yape' | 'plin' | 'pos' | null;
            }) =>
              Promise.resolve({
                ok: true,
                replayed: false,
                saleReturn: {
                  returnId: '0199ef04-1b00-7000-8000-000000000097',
                  operationId: command.operationId,
                  saleId: command.saleId,
                  saleVersion: 7,
                  commercialReductionCents: 1_500,
                  refundAmountCents: 500,
                  refundMethod: command.refundMethod,
                  currentTotalCents: 2_000,
                  paidCents: 2_000,
                  balanceCents: 0,
                  approvedBy: ACTOR_ID,
                  effectiveAt: new Date('2026-09-18T15:00:00.000Z'),
                },
              }),
          },
        },
        {
          provide: CancelSale,
          useValue: {
            execute: (command: {
              operationId: string;
              saleId: string;
              refundAmountCents: number;
              refundMethod: 'cash' | 'yape' | 'plin' | 'pos' | null;
            }) =>
              Promise.resolve({
                ok: true,
                replayed: false,
                cancellation: {
                  cancellationId: '0199ef04-1b00-7000-8000-000000000099',
                  operationId: command.operationId,
                  saleId: command.saleId,
                  saleVersion: 7,
                  refundAmountCents: command.refundAmountCents,
                  refundMethod: command.refundMethod,
                  paidCents: 500,
                  releasedQuantity: 1,
                  returnedQuantity: 0,
                  notReturnedQuantity: 1,
                  cancelledBy: ACTOR_ID,
                  effectiveAt: new Date('2026-09-18T16:00:00.000Z'),
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

  it('lists sale activity with debt and fulfillment indicators', async () => {
    const response = await request(httpServer).get('/api/v1/sales?debt=overdue').expect(200);
    expect(response.body).toMatchObject({
      items: [
        {
          id: SALE_ID,
          paidCents: 1_000,
          balanceCents: 2_000,
          paymentSituation: 'partial',
          deliverySituation: 'partial',
          overdue: true,
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
  });

  it('returns the operational detail of a sale', async () => {
    const response = await request(httpServer).get(`/api/v1/sales/${SALE_ID}`).expect(200);
    expect(response.body).toMatchObject({
      id: SALE_ID,
      paymentSituation: 'partial',
      balanceCents: 2_000,
      totalAdjustments: [],
      closure: null,
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

  it('records an idempotent payment for a sale', async () => {
    const response = await request(httpServer)
      .post(`/api/v1/sales/${SALE_ID}/payments`)
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000088')
      .send({ expectedVersion: 2, amountCents: 1_000, method: 'yape' })
      .expect(200);
    expect(response.body).toMatchObject({
      saleId: SALE_ID,
      saleVersion: 3,
      amountCents: 1_000,
      method: 'yape',
      balanceCents: 2_000,
      replayed: false,
    });
  });

  it('adjusts the agreed total through an idempotent admin command', async () => {
    const response = await request(httpServer)
      .post(`/api/v1/sales/${SALE_ID}/total-adjustments`)
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000094')
      .send({ expectedVersion: 3, newTotalCents: 3_500, reason: 'Acuerdo final' })
      .expect(200);
    expect(response.body).toMatchObject({
      saleVersion: 4,
      previousTotalCents: 3_000,
      currentTotalCents: 3_500,
      differenceCents: 500,
    });
  });

  it('corrects a payment without deleting its original record', async () => {
    const response = await request(httpServer)
      .post(`/api/v1/sales/${SALE_ID}/payments/${PAYMENT_ID}/corrections`)
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000095')
      .send({ expectedVersion: 4, amountCents: 500, reason: 'Cobro duplicado' })
      .expect(200);
    expect(response.body).toMatchObject({
      paymentId: PAYMENT_ID,
      saleVersion: 5,
      amountCents: 500,
      method: 'yape',
    });
  });

  it('finalizes a sale and records the forgiven balance', async () => {
    const response = await request(httpServer)
      .post(`/api/v1/sales/${SALE_ID}/closure`)
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000096')
      .send({ expectedVersion: 5, reason: 'Acuerdo de cierre' })
      .expect(200);
    expect(response.body).toMatchObject({
      saleVersion: 6,
      type: 'incomplete',
      forgivenAmountCents: 1_500,
      reason: 'Acuerdo de cierre',
    });
  });

  it('approves a return and exposes only the calculated paid excess as refund', async () => {
    const response = await request(httpServer)
      .post(`/api/v1/sales/${SALE_ID}/returns`)
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000098')
      .send({
        expectedVersion: 6,
        reason: 'Cliente cambió de opinión',
        refundMethod: 'yape',
        lines: [
          {
            saleLineId: LINE_ID,
            quantity: 1,
            productReturns: false,
          },
        ],
      })
      .expect(200);
    expect(response.body).toMatchObject({
      saleVersion: 7,
      commercialReductionCents: 1_500,
      refundAmountCents: 500,
      refundMethod: 'yape',
      currentTotalCents: 2_000,
      paidCents: 2_000,
      balanceCents: 0,
    });
  });

  it('cancels a sale using the manually declared refund', async () => {
    const response = await request(httpServer)
      .post(`/api/v1/sales/${SALE_ID}/cancellations`)
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-00000000009a')
      .send({
        expectedVersion: 6,
        reason: 'Acuerdo de cancelación',
        refundAmountCents: 500,
        refundMethod: 'yape',
        lines: [
          {
            saleLineId: LINE_ID,
            returnedQuantity: 0,
            notReturnedQuantity: 1,
          },
        ],
      })
      .expect(200);
    expect(response.body).toMatchObject({
      saleVersion: 7,
      refundAmountCents: 500,
      refundMethod: 'yape',
      paidCents: 500,
      releasedQuantity: 1,
      returnedQuantity: 0,
      notReturnedQuantity: 1,
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
