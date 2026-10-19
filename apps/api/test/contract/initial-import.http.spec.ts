import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ProblemDetailsFilter } from '../../src/composition/problem-details.filter';
import type { AuthenticatedRequest } from '../../src/modules/identity-access/adapters/driving/http/permission.guard';
import { InitialImportController } from '../../src/modules/initial-import/adapters/driving/http/initial-import.controller';
import {
  ConfirmInitialProductImport,
  ValidateInitialProductImport,
} from '../../src/modules/initial-import/hexagon/application/manage-initial-import';

const ACTOR_ID = '0199ef04-1b00-7000-8000-000000000301';
const IMPORT_ID = '0199ef04-1b00-7000-8000-000000000302';
const now = new Date('2026-10-18T20:00:00.000Z');
const preview = {
  id: IMPORT_ID,
  fileName: 'productos.xlsx',
  checksum: 'a'.repeat(64),
  status: 'validated' as const,
  totalRows: 1,
  validRows: 1,
  warningCount: 0,
  errorCount: 0,
  issues: [],
  rows: [
    {
      rowNumber: 2,
      code: 'PEL-001',
      codeNormalized: 'pel-001',
      name: 'Peluche',
      description: null,
      category: 'Peluches',
      categoryNormalized: 'peluches',
      tags: [],
      minimumPriceCents: 2000,
      suggestedPriceCents: 2500,
      maximumPriceCents: null,
      unitCostCents: 1000,
      storeQuantity: 1,
      warehouseQuantity: 2,
    },
  ],
  validatedAt: now,
  confirmedAt: null,
};

describe('Initial import HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InitialImportController],
      providers: [
        {
          provide: ValidateInitialProductImport,
          useValue: { execute: () => Promise.resolve(preview) },
        },
        {
          provide: ConfirmInitialProductImport,
          useValue: {
            execute: () =>
              Promise.resolve({
                ok: true,
                import: { ...preview, status: 'confirmed', confirmedAt: now },
                replayed: false,
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
        permissionCodes: ['imports:initial-products'],
        requiresPasswordChange: false,
      };
      next();
    });
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  });
  afterAll(async () => app.close());

  it('uploads an xlsx file and returns its validation preview', async () => {
    const response = await request(httpServer)
      .post('/api/v1/initial-product-imports/validation')
      .attach('file', Buffer.from('xlsx'), 'productos.xlsx')
      .expect(201);
    expect(response.body as unknown).toMatchObject({
      id: IMPORT_ID,
      status: 'validated',
      rows: [{ code: 'PEL-001', storeQuantity: 1, warehouseQuantity: 2 }],
    });
  });

  it('confirms a validated import through an idempotent command', async () => {
    const response = await request(httpServer)
      .post(`/api/v1/initial-product-imports/${IMPORT_ID}/confirmation`)
      .set('Idempotency-Key', '0199ef04-1b00-7000-8000-000000000303')
      .expect(201);
    expect(response.body as unknown).toMatchObject({ status: 'confirmed', replayed: false });
  });
});
