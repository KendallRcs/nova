import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import type { AuthenticatedRequest } from '../../src/modules/identity-access/adapters/driving/http/permission.guard';
import { FinanceController } from '../../src/modules/operational-finance/adapters/driving/http/finance.controller';
import {
  CancelExpense,
  ListExpenses,
  ManageExpenseCategories,
  RegisterExpense,
} from '../../src/modules/operational-finance/hexagon/application/manage-finance';

const ACTOR_ID = '0199ef04-1b00-7000-8000-000000000201';
const CATEGORY_ID = '0199ef04-1b00-7000-8000-000000000202';
const EXPENSE_ID = '0199ef04-1b00-7000-8000-000000000203';
const now = new Date('2026-10-18T20:00:00.000Z');
const category = {
  id: CATEGORY_ID,
  name: 'Movilidad',
  description: null,
  status: 'active' as const,
  createdAt: now,
  updatedAt: now,
};
const expense = {
  id: EXPENSE_ID,
  operationId: '0199ef04-1b00-7000-8000-000000000204',
  categoryId: CATEGORY_ID,
  categoryName: 'Movilidad',
  amountCents: 3_000,
  method: 'cash' as const,
  description: 'Taxi',
  receiptStorageKey: null,
  status: 'confirmed' as const,
  registeredBy: ACTOR_ID,
  effectiveAt: now,
  cancellation: null,
};

describe('Operational finance HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        {
          provide: ManageExpenseCategories,
          useValue: {
            create: () => Promise.resolve({ ok: true, value: category, replayed: false }),
            list: () => Promise.resolve([category]),
            rename: () => Promise.resolve({ ok: true, value: category, replayed: false }),
            deactivate: () =>
              Promise.resolve({
                ok: true,
                value: { ...category, status: 'inactive' },
                replayed: false,
              }),
          },
        },
        {
          provide: RegisterExpense,
          useValue: {
            execute: () => Promise.resolve({ ok: true, value: expense, replayed: false }),
          },
        },
        { provide: ListExpenses, useValue: { execute: () => Promise.resolve([expense]) } },
        {
          provide: CancelExpense,
          useValue: {
            execute: () =>
              Promise.resolve({
                ok: true,
                value: {
                  ...expense,
                  status: 'cancelled',
                  cancellation: {
                    reason: 'Servicio cancelado',
                    refundAmountCents: 3_000,
                    refundMethod: 'yape',
                    cancelledBy: ACTOR_ID,
                    effectiveAt: now,
                  },
                },
                replayed: false,
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
        permissionCodes: ['expenses:manage'],
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

  it('manages expense categories', async () => {
    await request(httpServer)
      .post('/api/v1/expense-categories')
      .send({ name: 'Movilidad' })
      .expect(201)
      .expect((response) => {
        expect(response.body as unknown).toMatchObject({ id: CATEGORY_ID, status: 'active' });
      });
    await request(httpServer)
      .get('/api/v1/expense-categories')
      .expect(200)
      .expect((response) => {
        expect((response.body as { items: unknown[] }).items).toHaveLength(1);
      });
  });

  it('registers, lists and fully refunds a cancelled expense', async () => {
    await request(httpServer)
      .post('/api/v1/operating-expenses')
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000204')
      .send({
        categoryId: CATEGORY_ID,
        amountCents: 3_000,
        method: 'cash',
        description: 'Taxi',
        effectiveAt: now.toISOString(),
      })
      .expect(201)
      .expect((response) => {
        expect(response.body as unknown).toMatchObject({
          amountCents: 3_000,
          status: 'confirmed',
        });
      });
    await request(httpServer)
      .get('/api/v1/operating-expenses')
      .expect(200)
      .expect((response) => {
        expect((response.body as { items: unknown[] }).items).toHaveLength(1);
      });
    await request(httpServer)
      .post(`/api/v1/operating-expenses/${EXPENSE_ID}/cancellations`)
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000205')
      .send({ reason: 'Servicio cancelado', refundReceived: true, refundMethod: 'yape' })
      .expect(201)
      .expect((response) => {
        expect(response.body as unknown).toMatchObject({
          status: 'cancelled',
          cancellation: { refundAmountCents: 3_000, refundMethod: 'yape' },
        });
      });
  });

  it('rejects a declared refund without its real method', async () => {
    await request(httpServer)
      .post(`/api/v1/operating-expenses/${EXPENSE_ID}/cancellations`)
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000206')
      .send({ reason: 'Servicio cancelado', refundReceived: true })
      .expect(422);
  });
});
