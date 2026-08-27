import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import { SessionsController } from '../../src/modules/identity-access/adapters/driving/http/sessions.controller';
import { StartSession } from '../../src/modules/identity-access/hexagon/application/start-session';

describe('Sessions HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];

  beforeAll(async () => {
    const startSession = {
      execute: ({ username, password }: { username: string; password: string }) =>
        Promise.resolve(
          username === 'empleado1' && password === 'contraseña válida'
            ? {
                ok: true as const,
                sessionSecret: 'secret-that-must-only-appear-in-the-cookie',
                credentialExpiresAt: new Date('2027-08-27T00:00:00.000Z'),
                actor: {
                  userId: '0198f9c2-7e00-7000-8000-000000000001',
                  username: 'empleado1',
                  permissionCodes: ['stock:read', 'sales:create'],
                  requiresPasswordChange: false,
                },
              }
            : { ok: false as const, reason: 'invalid-credentials' as const },
        ),
    };
    const config = { getOrThrow: () => 'test' };
    const module = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        { provide: StartSession, useValue: startSession },
        { provide: ConfigService, useValue: config },
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

  afterAll(async () => {
    await app.close();
  });

  it('returns the actor and sends the opaque secret only in an HttpOnly cookie', async () => {
    const response = await request(httpServer)
      .post('/api/v1/auth/sessions')
      .send({ username: 'empleado1', password: 'contraseña válida' })
      .expect(201);

    expect(response.body).toEqual({
      actor: {
        userId: '0198f9c2-7e00-7000-8000-000000000001',
        username: 'empleado1',
        permissionCodes: ['stock:read', 'sales:create'],
        requiresPasswordChange: false,
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'secret-that-must-only-appear-in-the-cookie',
    );
    expect(response.headers['set-cookie']?.[0]).toContain(
      'nova-session=secret-that-must-only-appear-in-the-cookie',
    );
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Strict');
  });

  it('uses the same generic problem for an unknown user or an incorrect password', async () => {
    const unknownUser = await request(httpServer)
      .post('/api/v1/auth/sessions')
      .send({ username: 'desconocido', password: 'cualquier valor' })
      .expect(401);
    const wrongPassword = await request(httpServer)
      .post('/api/v1/auth/sessions')
      .send({ username: 'empleado1', password: 'incorrecta' })
      .expect(401);

    expect(unknownUser.body).toEqual(wrongPassword.body);
    expect(unknownUser.body).toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      detail: 'El usuario o la contraseña son incorrectos.',
    });
  });
});
