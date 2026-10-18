import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import type { AuthenticatedRequest } from '../../src/modules/identity-access/adapters/driving/http/permission.guard';
import { ProcurementController } from '../../src/modules/procurement/adapters/driving/http/procurement.controller';
import {
  RegisterSupplier,
  SearchSuppliers,
} from '../../src/modules/procurement/hexagon/application/manage-suppliers';
import { RegisterSupplierAdvance } from '../../src/modules/procurement/hexagon/application/register-supplier-advance';
import { ResolveSupplierAdvance } from '../../src/modules/procurement/hexagon/application/resolve-supplier-advance';

const SUPPLIER_ID = '0199ef04-1b00-7000-8000-000000000070';
const ACTOR_ID = '0199ef04-1b00-7000-8000-000000000071';
const now = new Date('2026-10-18T20:00:00.000Z');
const supplier = {
  id: SUPPLIER_ID,
  name: 'Distribuidora Norte',
  kind: 'occasional' as const,
  phone: null,
  document: null,
  description: 'Proveedor de campaña',
  status: 'active' as const,
  version: 1,
  createdAt: now,
  updatedAt: now,
};

describe('Procurement HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [
        { provide: RegisterSupplier, useValue: { execute: () => Promise.resolve(supplier) } },
        { provide: SearchSuppliers, useValue: { execute: () => Promise.resolve([supplier]) } },
        {
          provide: RegisterSupplierAdvance,
          useValue: {
            execute: (command: { operationId: string }) =>
              Promise.resolve({
                ok: true,
                replayed: false,
                advance: {
                  id: '0199ef04-1b00-7000-8000-000000000072',
                  operationId: command.operationId,
                  supplierId: SUPPLIER_ID,
                  originalAmountCents: 2_500,
                  currentBalanceCents: 2_500,
                  method: 'yape',
                  purpose: 'Reserva de peluches',
                  status: 'pending',
                  version: 1,
                  registeredBy: ACTOR_ID,
                  effectiveAt: now,
                },
              }),
          },
        },
        {
          provide: ResolveSupplierAdvance,
          useValue: {
            refund: (command: { operationId: string }) =>
              Promise.resolve({
                ok: true,
                replayed: false,
                resolution: {
                  id: '0199ef04-1b00-7000-8000-000000000074',
                  operationId: command.operationId,
                  advanceId: '0199ef04-1b00-7000-8000-000000000072',
                  type: 'refund',
                  amountCents: 1_000,
                  method: 'cash',
                  reason: null,
                  currentBalanceCents: 1_500,
                  status: 'pending',
                  advanceVersion: 2,
                  registeredBy: ACTOR_ID,
                  effectiveAt: now,
                },
              }),
            loss: (command: { operationId: string }) =>
              Promise.resolve({
                ok: true,
                replayed: false,
                resolution: {
                  id: '0199ef04-1b00-7000-8000-000000000075',
                  operationId: command.operationId,
                  advanceId: '0199ef04-1b00-7000-8000-000000000072',
                  type: 'loss',
                  amountCents: 1_500,
                  method: null,
                  reason: 'Proveedor no devolverá el saldo',
                  currentBalanceCents: 0,
                  status: 'resolved',
                  advanceVersion: 3,
                  registeredBy: ACTOR_ID,
                  effectiveAt: now,
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
        permissionCodes: ['purchases:manage'],
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

  it('registers and searches a supplier', async () => {
    await request(httpServer)
      .post('/api/v1/suppliers')
      .send({ name: 'Distribuidora Norte', kind: 'occasional' })
      .expect(201)
      .expect({
        ...supplier,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    await request(httpServer).get('/api/v1/suppliers?query=Norte').expect(200);
  });

  it('registers an idempotent advance with its real payment method', async () => {
    const response = await request(httpServer)
      .post('/api/v1/supplier-advances')
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000073')
      .send({
        supplierId: SUPPLIER_ID,
        amountCents: 2_500,
        method: 'yape',
        purpose: 'Reserva de peluches',
      })
      .expect(201);
    expect(response.body).toMatchObject({
      supplierId: SUPPLIER_ID,
      originalAmountCents: 2_500,
      currentBalanceCents: 2_500,
      method: 'yape',
      status: 'pending',
      replayed: false,
    });
  });

  it('refunds or recognizes a loss against the versioned advance balance', async () => {
    const advanceId = '0199ef04-1b00-7000-8000-000000000072';
    await request(httpServer)
      .post(`/api/v1/supplier-advances/${advanceId}/refunds`)
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000076')
      .send({ expectedVersion: 1, amountCents: 1_000, method: 'cash' })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({ type: 'refund', currentBalanceCents: 1_500 });
      });
    await request(httpServer)
      .post(`/api/v1/supplier-advances/${advanceId}/losses`)
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000077')
      .send({
        expectedVersion: 2,
        amountCents: 1_500,
        reason: 'Proveedor no devolverá el saldo',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({ type: 'loss', status: 'resolved', method: null });
      });
  });
});
