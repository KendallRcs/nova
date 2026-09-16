import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import { CustomersController } from '../../src/modules/customers/adapters/driving/http/customers.controller';
import {
  RegisterCustomer,
  SearchCustomers,
  UpdateCustomer,
} from '../../src/modules/customers/hexagon/application/manage-customers';

const CUSTOMER_ID = '0199ef04-1b00-7000-8000-000000000060';
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
});
