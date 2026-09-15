import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import { CsrfGuard } from '../../src/composition/csrf.guard';
import { CsrfTokens } from '../../src/composition/csrf-tokens';
import { CategoriesController } from '../../src/modules/catalog/adapters/driving/http/categories.controller';
import type {
  Clock,
  IdGenerator,
} from '../../src/modules/catalog/hexagon/application/category.dependencies';
import type { CategoryRepository } from '../../src/modules/catalog/hexagon/application/category.repository';
import { CreateCategory } from '../../src/modules/catalog/hexagon/application/create-category';
import { ListCategories } from '../../src/modules/catalog/hexagon/application/list-categories';
import {
  DeactivateCategory,
  RenameCategory,
} from '../../src/modules/catalog/hexagon/application/manage-category';
import type { Category } from '../../src/modules/catalog/hexagon/domain/category';
import { AuthenticateSession } from '../../src/modules/identity-access/hexagon/application/authenticate-session';
import { PermissionGuard } from '../../src/modules/identity-access/adapters/driving/http/permission.guard';

class InMemoryCategoryRepository implements CategoryRepository {
  readonly categories: Category[] = [];

  findByNormalizedName(nameNormalized: string): Promise<Category | null> {
    return Promise.resolve(
      this.categories.find(
        (category) => category.toPrimitives().nameNormalized === nameNormalized,
      ) ?? null,
    );
  }

  findById(id: string): Promise<Category | null> {
    return Promise.resolve(
      this.categories.find((category) => category.toPrimitives().id === id) ?? null,
    );
  }

  listActive(): Promise<Category[]> {
    return Promise.resolve(
      this.categories.filter((category) => category.toPrimitives().status === 'active'),
    );
  }

  save(category: Category): Promise<void> {
    this.categories.push(category);
    return Promise.resolve();
  }

  update(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

describe('Categories HTTP contract', () => {
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
    const repository = new InMemoryCategoryRepository();
    const idGenerator: IdGenerator = {
      generate: () => '0198f9c2-7e00-7000-8000-000000000001',
    };
    const clock: Clock = {
      now: () => new Date('2026-08-26T20:00:00.000Z'),
    };
    const createCategory = new CreateCategory(repository, idGenerator, clock);
    const listCategories = new ListCategories(repository);
    const renameCategory = new RenameCategory(repository, clock);
    const deactivateCategory = new DeactivateCategory(repository, clock);
    const module = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CreateCategory, useValue: createCategory },
        { provide: ListCategories, useValue: listCategories },
        { provide: RenameCategory, useValue: renameCategory },
        { provide: DeactivateCategory, useValue: deactivateCategory },
        {
          provide: AuthenticateSession,
          useValue: {
            execute: (secret: string | null) =>
              Promise.resolve(
                secret === null
                  ? { ok: false }
                  : {
                      ok: true,
                      renewedUntil: null,
                      actor: {
                        sessionId: 'session-id',
                        userId: 'user-id',
                        username: secret,
                        securityVersion: 1,
                        permissionCodes:
                          secret === 'admin-session'
                            ? ['catalog:read', 'catalog:manage']
                            : ['catalog:read'],
                        requiresPasswordChange: false,
                      },
                    },
              ),
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

  it('creates and lists a category without exposing domain or Prisma models', async () => {
    const created = await request(httpServer)
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfTokens.issue('admin-session'))
      .set('Cookie', [
        'nova-session=admin-session',
        `nova-csrf=${csrfTokens.issue('admin-session')}`,
      ])
      .send({ name: ' Accesorios ', description: 'Complementos' })
      .expect(201);

    expect(created.body).toEqual({
      id: '0198f9c2-7e00-7000-8000-000000000001',
      name: 'Accesorios',
      description: 'Complementos',
      isActive: true,
      createdAt: '2026-08-26T20:00:00.000Z',
      updatedAt: '2026-08-26T20:00:00.000Z',
    });

    const listed = await request(httpServer)
      .get('/api/v1/categories')
      .set('Cookie', 'nova-session=employee-session')
      .expect(200);
    expect(listed.body).toEqual({ items: [created.body] });
  });

  it('rejects unknown request properties with Problem Details', async () => {
    const response = await request(httpServer)
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfTokens.issue('admin-session'))
      .set('Cookie', [
        'nova-session=admin-session',
        `nova-csrf=${csrfTokens.issue('admin-session')}`,
      ])
      .send({ name: 'Vehículos', unexpected: true })
      .expect(422);

    expect(response.body).toMatchObject({
      type: 'https://nova.example/problems/validation-failed',
      status: 422,
      code: 'VALIDATION_FAILED',
      instance: '/api/v1/categories',
    });
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it('renames and deactivates a category without deleting it', async () => {
    const categoryId = '0198f9c2-7e00-7000-8000-000000000001';
    const cookie = ['nova-session=admin-session', `nova-csrf=${csrfTokens.issue('admin-session')}`];
    const renamed = await request(httpServer)
      .patch(`/api/v1/categories/${categoryId}`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfTokens.issue('admin-session'))
      .set('Cookie', cookie)
      .send({ name: 'Complementos' })
      .expect(200);
    expect(renamed.body).toMatchObject({ id: categoryId, name: 'Complementos' });

    await request(httpServer)
      .post(`/api/v1/categories/${categoryId}/deactivation`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfTokens.issue('admin-session'))
      .set('Cookie', cookie)
      .expect(201);
    await request(httpServer)
      .get('/api/v1/categories')
      .set('Cookie', 'nova-session=employee-session')
      .expect(200)
      .expect({ items: [] });
  });

  it('enforces authentication and the specific capability on the server', async () => {
    await request(httpServer).get('/api/v1/categories').expect(401);

    const forbidden = await request(httpServer)
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfTokens.issue('employee-session'))
      .set('Cookie', [
        'nova-session=employee-session',
        `nova-csrf=${csrfTokens.issue('employee-session')}`,
      ])
      .send({ name: 'Solo administradores' })
      .expect(403);

    expect(forbidden.body).toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });

  it('rejects a mutable request with an invalid origin or CSRF token', async () => {
    await request(httpServer)
      .post('/api/v1/categories')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', 'nova-session=admin-session')
      .send({ name: 'Ataque' })
      .expect(403);

    const rejected = await request(httpServer)
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', 'modified')
      .set('Cookie', ['nova-session=admin-session', 'nova-csrf=modified'])
      .send({ name: 'Ataque' })
      .expect(403);
    expect(rejected.body).toMatchObject({ code: 'CSRF_REJECTED' });
  });
});
