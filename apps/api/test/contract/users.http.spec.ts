import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import { UsersController } from '../../src/modules/identity-access/adapters/driving/http/users.controller';
import { ResetCollaboratorPassword } from '../../src/modules/identity-access/hexagon/application/reset-collaborator-password';

const EXISTING_USER_ID = '0198f9c2-7e00-7000-8000-000000000001';
const INACTIVE_USER_ID = '0198f9c2-7e00-7000-8000-000000000002';

describe('Users HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: ResetCollaboratorPassword,
          useValue: {
            execute: (userId: string) =>
              Promise.resolve(
                userId === EXISTING_USER_ID
                  ? { ok: true, temporaryPassword: 'temporal-only-once' }
                  : userId === INACTIVE_USER_ID
                    ? { ok: false, reason: 'account-inactive' }
                    : { ok: false, reason: 'account-not-found' },
              ),
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

  it('returns the temporary credential only in the reset response', async () => {
    await request(httpServer)
      .post(`/api/v1/users/${EXISTING_USER_ID}/password-reset`)
      .expect(201)
      .expect({ temporaryPassword: 'temporal-only-once' });
  });

  it('rejects reset for an inactive account', async () => {
    const response = await request(httpServer)
      .post(`/api/v1/users/${INACTIVE_USER_ID}/password-reset`)
      .expect(409);

    expect(response.body).toMatchObject({ status: 409, code: 'USER_INACTIVE' });
  });

  it('validates the user identifier at the HTTP boundary', async () => {
    await request(httpServer).post('/api/v1/users/not-a-uuid/password-reset').expect(400);
  });
});
