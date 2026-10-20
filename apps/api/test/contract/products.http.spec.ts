import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validationProblem } from '../../src/composition/http-validation';
import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import { ProductsController } from '../../src/modules/catalog/adapters/driving/http/products.controller';
import {
  CreateProduct,
  DeactivateProduct,
  UpdateProduct,
} from '../../src/modules/catalog/hexagon/application/manage-products';
import {
  GetProduct,
  SearchProducts,
} from '../../src/modules/catalog/hexagon/application/product-catalog';
import {
  RemoveProductImage,
  ReplaceProductImage,
} from '../../src/modules/catalog/hexagon/application/product-images';
import { Product } from '../../src/modules/catalog/hexagon/domain/product';

const now = new Date('2026-09-15T16:00:00.000Z');
const product = Product.create({
  id: '0199eec8-7900-7000-8000-000000000001',
  categoryId: '0199eec8-7900-7000-8000-000000000002',
  tagIds: ['0199eec8-7900-7000-8000-000000000003'],
  code: 'MUN-001',
  name: 'Muñeca',
  description: 'Edición clásica',
  minimumPriceCents: 2_000,
  suggestedPriceCents: 2_500,
  maximumPriceCents: 3_000,
  now,
});

describe('Products HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: CreateProduct,
          useValue: { execute: () => Promise.resolve({ ok: true, product }) },
        },
        {
          provide: UpdateProduct,
          useValue: { execute: () => Promise.resolve({ ok: true, product }) },
        },
        {
          provide: DeactivateProduct,
          useValue: { execute: () => Promise.resolve({ ok: true, product }) },
        },
        {
          provide: SearchProducts,
          useValue: {
            execute: () =>
              Promise.resolve({
                items: [
                  {
                    id: product.toPrimitives().id,
                    code: 'MUN-001',
                    name: 'Muñeca',
                    description: 'Edición clásica',
                    category: {
                      id: '0199eec8-7900-7000-8000-000000000002',
                      name: 'Juguetes',
                    },
                    tags: [{ id: '0199eec8-7900-7000-8000-000000000003', name: 'Clásico' }],
                    images: [],
                    minimumPriceCents: 2_000,
                    suggestedPriceCents: 2_500,
                    maximumPriceCents: 3_000,
                    stock: [
                      {
                        locationId: '0199ef04-1b00-7000-8000-000000000001',
                        locationCode: 'STORE',
                        locationName: 'Tienda',
                        physicalQuantity: 0,
                        reservedQuantity: 0,
                        reviewQuantity: 0,
                        availableQuantity: 0,
                      },
                    ],
                    isActive: true,
                    createdAt: now,
                    updatedAt: now,
                  },
                ],
                nextProductId: null,
              }),
          },
        },
        {
          provide: GetProduct,
          useValue: {
            execute: () =>
              Promise.resolve({
                ok: true,
                product: {
                  id: product.toPrimitives().id,
                  code: 'MUN-001',
                  name: 'Muñeca',
                  description: 'Edición clásica',
                  category: {
                    id: '0199eec8-7900-7000-8000-000000000002',
                    name: 'Juguetes',
                  },
                  tags: [],
                  images: [],
                  minimumPriceCents: 2_000,
                  suggestedPriceCents: 2_500,
                  maximumPriceCents: 3_000,
                  stock: [],
                  isActive: true,
                  createdAt: now,
                  updatedAt: now,
                },
              }),
          },
        },
        {
          provide: ReplaceProductImage,
          useValue: {
            execute: () =>
              Promise.resolve({
                ok: true,
                image: {
                  id: '0199eec8-7900-7000-8000-000000000004',
                  productId: product.toPrimitives().id,
                  position: 1,
                  storageKey: 'nova/products/image',
                  url: 'https://images.example/image',
                  width: 800,
                  height: 600,
                  bytes: 12_000,
                  format: 'webp',
                },
              }),
          },
        },
        {
          provide: RemoveProductImage,
          useValue: {
            execute: () => Promise.resolve({ ok: true, removedStorageKey: 'nova/products/image' }),
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

  it('creates a product with integer prices and explicit classifications', async () => {
    const response = await request(httpServer)
      .post('/api/v1/products')
      .send({
        code: 'MUN-001',
        name: 'Muñeca',
        categoryId: '0199eec8-7900-7000-8000-000000000002',
        tagIds: ['0199eec8-7900-7000-8000-000000000003'],
        description: 'Edición clásica',
        minimumPriceCents: 2_000,
        suggestedPriceCents: 2_500,
        maximumPriceCents: 3_000,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: '0199eec8-7900-7000-8000-000000000001',
      code: 'MUN-001',
      minimumPriceCents: 2_000,
      isActive: true,
    });
  });

  it('searches products and returns cursor-shaped pagination', async () => {
    const response = await request(httpServer)
      .get('/api/v1/products?query=mun&categoryId=0199eec8-7900-7000-8000-000000000002')
      .expect(200);
    expect(response.body).toMatchObject({
      items: [{ code: 'MUN-001', category: { name: 'Juguetes' } }],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
  });

  it('gets one active product with its commercial data and stock', async () => {
    const response = await request(httpServer)
      .get(`/api/v1/products/${product.toPrimitives().id}`)
      .expect(200);
    expect(response.body).toMatchObject({
      id: product.toPrimitives().id,
      code: 'MUN-001',
      minimumPriceCents: 2_000,
      stock: [],
    });
  });

  it('rejects malformed UUIDs and non-integer monetary values', async () => {
    const response = await request(httpServer)
      .post('/api/v1/products')
      .send({
        code: 'MUN-002',
        name: 'Muñeca',
        categoryId: 'not-a-uuid',
        minimumPriceCents: 20.5,
      })
      .expect(422);
    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED', status: 422 });
  });

  it('uploads a product image through the multipart contract without exposing storage keys', async () => {
    const response = await request(httpServer)
      .put(`/api/v1/products/${product.toPrimitives().id}/images/1`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0x00]), {
        filename: 'product.jpg',
        contentType: 'image/jpeg',
      })
      .expect(200);
    expect(response.body).toMatchObject({
      productId: product.toPrimitives().id,
      position: 1,
      format: 'webp',
      url: 'https://images.example/image',
    });
    expect(response.body).not.toHaveProperty('storageKey');
  });

  it('deletes an occupied image position and rejects positions outside one and two', async () => {
    await request(httpServer)
      .delete(`/api/v1/products/${product.toPrimitives().id}/images/2`)
      .expect(204);
    const response = await request(httpServer)
      .delete(`/api/v1/products/${product.toPrimitives().id}/images/3`)
      .expect(422);
    expect(response.body).toMatchObject({ code: 'INVALID_PRODUCT_IMAGE_POSITION' });
  });
});
