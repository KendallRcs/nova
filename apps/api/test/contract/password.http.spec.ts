import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import { PasswordController } from '../../src/modules/identity-access/adapters/driving/http/password.controller';
import { AuthenticateSession } from '../../src/modules/identity-access/hexagon/application/authenticate-session';
import { EstablishPersonalPassword } from '../../src/modules/identity-access/hexagon/application/establish-personal-password';

describe('Password HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PasswordController],
      providers: [
        {
          provide: AuthenticateSession,
          useValue: {
            execute: (secret: string | null) =>
              Promise.resolve(
                secret === 'temporary-session'
                  ? {
                      ok: true,
                      actor: { userId: 'user-id' },
                      renewedUntil: null,
                    }
                  : { ok: false },
              ),
          },
        },
        {
          provide: EstablishPersonalPassword,
          useValue: { execute: () => Promise.resolve({ ok: true }) },
        },
        { provide: ConfigService, useValue: { getOrThrow: () => 'test' } },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
        exceptionFactory: validationProblem,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => app.close());

  it('establishes the personal password and removes the temporary session cookie', async () => {
    const response = await request(httpServer)
      .put('/api/v1/auth/password')
      .set('Cookie', 'nova-session=temporary-session')
      .send({ newPassword: 'una frase personal segura' })
      .expect(204);

    expect(response.body).toEqual({});
    expect(response.headers['set-cookie']?.[0]).toContain('nova-session=;');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
  });

  it('rejects the operation when the session cookie is absent', async () => {
    await request(httpServer)
      .put('/api/v1/auth/password')
      .send({ newPassword: 'una frase personal segura' })
      .expect(401);
  });
});
