import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import { CustomersController } from '../../src/modules/customers/adapters/driving/http/customers.controller';
import type { AuthenticatedRequest } from '../../src/modules/identity-access/adapters/driving/http/permission.guard';
import {
  RegisterCustomer,
  SearchCustomers,
  UpdateCustomer,
} from '../../src/modules/customers/hexagon/application/manage-customers';
import { MergeCustomers } from '../../src/modules/customers/hexagon/application/merge-customers';
import { GetCustomerAccount } from '../../src/modules/customers/hexagon/application/customer-account';

const CUSTOMER_ID = '0199ef04-1b00-7000-8000-000000000060';
const DUPLICATE_ID = '0199ef04-1b00-7000-8000-000000000061';
const ACTOR_ID = '0199ef04-1b00-7000-8000-000000000062';
const view = {
  id: CUSTOMER_ID,
  name: 'María Pérez',
  phone: '+51987654321',
  dni: null,
  address: null,
  isActive: true,
  mergedIntoCustomerId: null,
  version: 1,
  createdAt: new Date('2026-09-15T18:00:00.000Z'),
  updatedAt: new Date('2026-09-15T18:00:00.000Z'),
};

describe('Customers HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        { provide: RegisterCustomer, useValue: { execute: () => Promise.resolve(view) } },
        { provide: SearchCustomers, useValue: { execute: () => Promise.resolve([view]) } },
        {
          provide: UpdateCustomer,
          useValue: {
            execute: () => Promise.resolve({ ok: true, customer: { ...view, version: 2 } }),
          },
        },
        {
          provide: MergeCustomers,
          useValue: {
            merge: (command: { operationId: string }) =>
              Promise.resolve({
                ok: true,
                replayed: false,
                merge: {
                  mergeId: '0199ef04-1b00-7000-8000-000000000063',
                  operationId: command.operationId,
                  primaryCustomerId: CUSTOMER_ID,
                  duplicateCustomerId: DUPLICATE_ID,
                  primaryVersion: 2,
                  duplicateVersion: 2,
                  identity: {
                    name: 'María Pérez',
                    nameNormalized: 'maría pérez',
                    phoneNormalized: '+51987654321',
                    dni: null,
                    address: null,
                  },
                  actorId: ACTOR_ID,
                  effectiveAt: new Date('2026-09-15T19:00:00.000Z'),
                },
              }),
          },
        },
        {
          provide: GetCustomerAccount,
          useValue: {
            execute: () =>
              Promise.resolve({
                ok: true,
                account: {
                  customer: {
                    id: CUSTOMER_ID,
                    name: 'María Pérez',
                    phone: '+51987654321',
                    dni: null,
                    address: null,
                    mergedCustomerIds: [DUPLICATE_ID],
                  },
                  summary: {
                    salesCount: 1,
                    activeDebtSalesCount: 1,
                    overdueSalesCount: 1,
                    totalPaidCents: 1_000,
                    totalOutstandingCents: 2_000,
                    overdueAmountCents: 2_000,
                    nearestDueDate: '2026-09-14',
                    lastPaymentAt: new Date('2026-09-15T20:00:00.000Z'),
                  },
                  sales: [
                    {
                      id: '0199ef04-1b00-7000-8000-000000000065',
                      createdBy: ACTOR_ID,
                      creatorUsername: 'admin',
                      lifecycle: 'confirmed',
                      originalTotalCents: 3_000,
                      currentTotalCents: 3_000,
                      paidCents: 1_000,
                      refundedCents: 0,
                      forgivenAmountCents: 0,
                      balanceCents: 2_000,
                      paymentSituation: 'partial',
                      deliverySituation: 'complete',
                      overdue: true,
                      dueDate: '2026-09-14',
                      lastPaymentAt: new Date('2026-09-15T20:00:00.000Z'),
                      payments: [
                        {
                          id: '0199ef04-1b00-7000-8000-000000000066',
                          amountCents: 1_000,
                          correctedCents: 0,
                          netAmountCents: 1_000,
                          method: 'yape',
                          registeredBy: ACTOR_ID,
                          registrarUsername: 'admin',
                          effectiveAt: new Date('2026-09-15T20:00:00.000Z'),
                        },
                      ],
                      confirmedAt: new Date('2026-09-15T19:00:00.000Z'),
                      finalizedAt: null,
                      cancelledAt: null,
                    },
                  ],
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
        permissionCodes: ['customers:read', 'customers:write-basic', 'customers:merge'],
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

  it('registers a customer while keeping DNI and address optional', async () => {
    const response = await request(httpServer)
      .post('/api/v1/customers')
      .send({ name: 'María Pérez', phone: '987654321' })
      .expect(201);
    expect(response.body).toMatchObject({
      id: CUSTOMER_ID,
      phone: '+51987654321',
      dni: null,
      address: null,
      version: 1,
    });
  });

  it('searches customers and updates with an expected version', async () => {
    await request(httpServer)
      .get('/api/v1/customers?query=Maria')
      .expect(200)
      .expect({
        items: [
          {
            ...view,
            createdAt: view.createdAt.toISOString(),
            updatedAt: view.updatedAt.toISOString(),
          },
        ],
      });
    const response = await request(httpServer)
      .put(`/api/v1/customers/${CUSTOMER_ID}`)
      .send({ name: 'María Pérez', phone: '987654321', expectedVersion: 1 })
      .expect(200);
    expect(response.body).toMatchObject({ version: 2 });
  });

  it('rejects malformed customer input at the HTTP boundary', async () => {
    await request(httpServer)
      .post('/api/v1/customers')
      .send({ name: '', phone: '987654321', unknown: true })
      .expect(422);
  });

  it('merges two customers through an idempotent administrative command', async () => {
    const response = await request(httpServer)
      .post('/api/v1/customers/merges')
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000064')
      .send({
        primaryCustomerId: CUSTOMER_ID,
        duplicateCustomerId: DUPLICATE_ID,
        expectedPrimaryVersion: 1,
        expectedDuplicateVersion: 1,
        resolvedName: 'María Pérez',
        resolvedPhone: '987654321',
      })
      .expect(201);
    expect(response.body).toMatchObject({
      primaryCustomerId: CUSTOMER_ID,
      duplicateCustomerId: DUPLICATE_ID,
      mergedBy: ACTOR_ID,
      primaryVersion: 2,
      duplicateVersion: 2,
      replayed: false,
    });
  });

  it('returns a consolidated customer account without exposing costs or margins', async () => {
    const response = await request(httpServer)
      .get(`/api/v1/customers/${CUSTOMER_ID}/account`)
      .expect(200);
    expect(response.body).toMatchObject({
      customer: { id: CUSTOMER_ID, mergedCustomerIds: [DUPLICATE_ID] },
      summary: {
        salesCount: 1,
        totalPaidCents: 1_000,
        totalOutstandingCents: 2_000,
        lastPaymentAt: '2026-09-15T20:00:00.000Z',
      },
      sales: [
        {
          paymentSituation: 'partial',
          balanceCents: 2_000,
          payments: [{ method: 'yape', netAmountCents: 1_000 }],
        },
      ],
    });
    const body = response.body as { sales: Record<string, unknown>[] };
    expect(body.sales[0]).not.toHaveProperty('allocatedCostCents');
    expect(body.sales[0]).not.toHaveProperty('marginCents');
  });
});
