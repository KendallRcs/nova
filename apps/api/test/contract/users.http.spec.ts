import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import { UsersController } from '../../src/modules/identity-access/adapters/driving/http/users.controller';
import { ResetCollaboratorPassword } from '../../src/modules/identity-access/hexagon/application/reset-collaborator-password';
import { CreateCollaboratorAccount } from '../../src/modules/identity-access/hexagon/application/create-collaborator-account';
import {
  DeactivateCollaboratorAccount,
  ReactivateCollaboratorAccount,
} from '../../src/modules/identity-access/hexagon/application/change-collaborator-account-status';
import { ListCollaboratorAccounts } from '../../src/modules/identity-access/hexagon/application/user-account-directory';
import { EMPLOYEE_PROFILE_ID } from '../../src/modules/identity-access/hexagon/domain/access-policy';
import { UserAccount } from '../../src/modules/identity-access/hexagon/domain/user-account';
import { RevokeCollaboratorSessions } from '../../src/modules/identity-access/hexagon/application/revocable-sessions';

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
          provide: CreateCollaboratorAccount,
          useValue: {
            execute: ({ username }: { username: string }) =>
              Promise.resolve(
                username.trim() === ''
                  ? { ok: false, reason: 'invalid-username' }
                  : {
                      ok: true,
                      account: testAccount('password-change-required'),
                      temporaryPassword: 'temporary-only-once',
                    },
              ),
          },
        },
        { provide: ListCollaboratorAccounts, useValue: { execute: () => Promise.resolve([]) } },
        {
          provide: DeactivateCollaboratorAccount,
          useValue: { execute: () => Promise.resolve({ ok: false, reason: 'account-not-found' }) },
        },
        {
          provide: ReactivateCollaboratorAccount,
          useValue: { execute: () => Promise.resolve({ ok: false, reason: 'account-not-found' }) },
        },
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
        {
          provide: RevokeCollaboratorSessions,
          useValue: {
            execute: (userId: string) =>
              Promise.resolve(userId === EXISTING_USER_ID ? 'revoked' : 'user-not-found'),
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

  it('creates a collaborator with a validated initial profile', async () => {
    const response = await request(httpServer)
      .post('/api/v1/users')
      .send({ username: 'empleado1', profile: 'employee' })
      .expect(201);

    expect(response.body).toMatchObject({
      account: {
        id: EXISTING_USER_ID,
        username: 'empleado1',
        profile: 'employee',
        status: 'password-change-required',
      },
      temporaryPassword: 'temporary-only-once',
    });
    await request(httpServer)
      .post('/api/v1/users')
      .send({ username: 'empleado2', profile: 'owner' })
      .expect(422);
  });

  it('lists accounts without exposing credential material', async () => {
    await request(httpServer).get('/api/v1/users').expect(200).expect({ items: [] });
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

  it('revokes every active session for an existing collaborator', async () => {
    await request(httpServer)
      .post(`/api/v1/users/${EXISTING_USER_ID}/session-revocations`)
      .expect(201);
  });
});

function testAccount(status: 'password-change-required'): UserAccount {
  return UserAccount.restore({
    id: EXISTING_USER_ID,
    profileId: EMPLOYEE_PROFILE_ID,
    usernameNormalized: 'empleado1',
    credentialHash: 'must-not-be-exposed',
    status,
    securityVersion: 1,
    createdAt: new Date('2026-09-15T12:00:00.000Z'),
    updatedAt: new Date('2026-09-15T12:00:00.000Z'),
  });
}
