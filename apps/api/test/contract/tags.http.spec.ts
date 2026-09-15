import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CsrfGuard } from '../../src/composition/csrf.guard';
import { CsrfTokens } from '../../src/composition/csrf-tokens';
import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import { TagsController } from '../../src/modules/catalog/adapters/driving/http/tags.controller';
import {
  CreateTag,
  DeactivateTag,
  ListTags,
  RenameTag,
} from '../../src/modules/catalog/hexagon/application/manage-tags';
import type { TagRepository } from '../../src/modules/catalog/hexagon/application/tag.repository';
import type { Tag } from '../../src/modules/catalog/hexagon/domain/tag';
import { PermissionGuard } from '../../src/modules/identity-access/adapters/driving/http/permission.guard';
import { AuthenticateSession } from '../../src/modules/identity-access/hexagon/application/authenticate-session';

class InMemoryTags implements TagRepository {
  readonly items: Tag[] = [];
  findById(id: string): Promise<Tag | null> {
    return Promise.resolve(this.items.find((tag) => tag.toPrimitives().id === id) ?? null);
  }
  findByNormalizedName(name: string): Promise<Tag | null> {
    return Promise.resolve(
      this.items.find((tag) => tag.toPrimitives().nameNormalized === name) ?? null,
    );
  }
  listActive(): Promise<Tag[]> {
    return Promise.resolve(this.items.filter((tag) => tag.toPrimitives().status === 'active'));
  }
  save(tag: Tag): Promise<void> {
    this.items.push(tag);
    return Promise.resolve();
  }
  update(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

describe('Tags HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];
  let csrfTokens: CsrfTokens;

  beforeAll(async () => {
    const config = {
      getOrThrow: (key: string) =>
        key === 'NODE_ENV'
          ? 'test'
          : key === 'FRONTEND_ORIGIN'
            ? 'http://localhost:3000'
            : '12345678901234567890123456789012',
    };
    csrfTokens = new CsrfTokens(config as never);
    const repository = new InMemoryTags();
    const clock = { now: () => new Date('2026-09-15T15:00:00.000Z') };
    const module = await Test.createTestingModule({
      controllers: [TagsController],
      providers: [
        {
          provide: CreateTag,
          useValue: new CreateTag(
            repository,
            { generate: () => '0198f9c2-7e00-7000-8000-000000000061' },
            clock,
          ),
        },
        { provide: ListTags, useValue: new ListTags(repository) },
        { provide: RenameTag, useValue: new RenameTag(repository, clock) },
        { provide: DeactivateTag, useValue: new DeactivateTag(repository, clock) },
        {
          provide: AuthenticateSession,
          useValue: {
            execute: () =>
              Promise.resolve({
                ok: true,
                renewedUntil: null,
                actor: {
                  sessionId: 'session',
                  userId: 'admin',
                  username: 'admin',
                  securityVersion: 1,
                  permissionCodes: ['catalog:read', 'catalog:manage'],
                  requiresPasswordChange: false,
                },
              }),
          },
        },
        { provide: ConfigService, useValue: config },
        { provide: CsrfTokens, useValue: csrfTokens },
        { provide: APP_GUARD, useClass: CsrfGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
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
        exceptionFactory: validationProblem,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => app.close());

  it('creates, lists, renames and deactivates a tag', async () => {
    const id = '0198f9c2-7e00-7000-8000-000000000061';
    const csrf = csrfTokens.issue('admin-session');
    const mutate = (path: string) =>
      request(httpServer)
        .post(path)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', csrf)
        .set('Cookie', ['nova-session=admin-session', `nova-csrf=${csrf}`]);

    await mutate('/api/v1/tags').send({ name: ' Peluche ' }).expect(201);
    const listed = await request(httpServer)
      .get('/api/v1/tags')
      .set('Cookie', 'nova-session=admin-session')
      .expect(200);
    expect(listed.body).toMatchObject({ items: [{ id, name: 'Peluche' }] });
    await request(httpServer)
      .patch(`/api/v1/tags/${id}`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrf)
      .set('Cookie', ['nova-session=admin-session', `nova-csrf=${csrf}`])
      .send({ name: 'Suave' })
      .expect(200);
    await mutate(`/api/v1/tags/${id}/deactivation`).expect(201);
    await request(httpServer)
      .get('/api/v1/tags')
      .set('Cookie', 'nova-session=admin-session')
      .expect(200)
      .expect({ items: [] });
  });
});
