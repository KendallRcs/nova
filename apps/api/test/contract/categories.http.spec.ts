import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import { CategoriesController } from '../../src/modules/catalog/adapters/driving/http/categories.controller';
import type {
  Clock,
  IdGenerator,
} from '../../src/modules/catalog/hexagon/application/category.dependencies';
import type { CategoryRepository } from '../../src/modules/catalog/hexagon/application/category.repository';
import { CreateCategory } from '../../src/modules/catalog/hexagon/application/create-category';
import { ListCategories } from '../../src/modules/catalog/hexagon/application/list-categories';
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

  listActive(): Promise<Category[]> {
    return Promise.resolve([...this.categories]);
  }

  save(category: Category): Promise<void> {
    this.categories.push(category);
    return Promise.resolve();
  }
}

describe('Categories HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];

  beforeAll(async () => {
    const repository = new InMemoryCategoryRepository();
    const idGenerator: IdGenerator = {
      generate: () => '0198f9c2-7e00-7000-8000-000000000001',
    };
    const clock: Clock = {
      now: () => new Date('2026-08-26T20:00:00.000Z'),
    };
    const createCategory = new CreateCategory(repository, idGenerator, clock);
    const listCategories = new ListCategories(repository);
    const module = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CreateCategory, useValue: createCategory },
        { provide: ListCategories, useValue: listCategories },
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
        { provide: ConfigService, useValue: { getOrThrow: () => 'test' } },
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
      .set('Cookie', 'nova-session=admin-session')
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
      .set('Cookie', 'nova-session=admin-session')
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

  it('enforces authentication and the specific capability on the server', async () => {
    await request(httpServer).get('/api/v1/categories').expect(401);

    const forbidden = await request(httpServer)
      .post('/api/v1/categories')
      .set('Cookie', 'nova-session=employee-session')
      .send({ name: 'Solo administradores' })
      .expect(403);

    expect(forbidden.body).toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });
});
