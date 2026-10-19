import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  CostMovementType,
  CostingPolicy,
  InitialImportStatus,
  InventoryMovementType,
  Prisma,
  RecordStatus,
} from '../../../../../generated/prisma/client';
import { normalizeProductSearchName } from '../../../../catalog/hexagon/domain/product';
import type {
  ImportIssue,
  InitialProductRow,
} from '../../../hexagon/domain/initial-product-import';
import type {
  InitialImportBook,
  InitialImportPreview,
  InitialImportResult,
} from '../../../hexagon/application/initial-import.ports';

@Injectable()
export class PrismaInitialImportBook implements InitialImportBook {
  constructor(private readonly prisma: PrismaService) {}

  async referenceIssues(rows: readonly InitialProductRow[]): Promise<ImportIssue[]> {
    const codes = rows.map((row) => row.codeNormalized);
    const categories = [...new Set(rows.map((row) => row.categoryNormalized))];
    const tags = [...new Set(rows.flatMap((row) => row.tags.map((tag) => tag.nameNormalized)))];
    const [products, categoryRows, tagRows] = await Promise.all([
      this.prisma.product.findMany({
        where: { codeNormalized: { in: codes } },
        select: { codeNormalized: true },
      }),
      this.prisma.category.findMany({
        where: { nameNormalized: { in: categories } },
        select: { nameNormalized: true, status: true },
      }),
      this.prisma.tag.findMany({
        where: { nameNormalized: { in: tags } },
        select: { nameNormalized: true, status: true },
      }),
    ]);
    const existingCodes = new Set(products.map((row) => row.codeNormalized));
    const inactiveCategories = new Set(
      categoryRows
        .filter((row) => row.status === RecordStatus.INACTIVE)
        .map((row) => row.nameNormalized),
    );
    const inactiveTags = new Set(
      tagRows
        .filter((row) => row.status === RecordStatus.INACTIVE)
        .map((row) => row.nameNormalized),
    );
    const issues: ImportIssue[] = [];
    for (const row of rows) {
      if (existingCodes.has(row.codeNormalized))
        issues.push(
          issue(
            row.rowNumber,
            'codigo',
            'PRODUCT_CODE_EXISTS',
            'El código ya pertenece a un producto del catálogo.',
          ),
        );
      if (inactiveCategories.has(row.categoryNormalized))
        issues.push(
          issue(
            row.rowNumber,
            'categoria',
            'CATEGORY_INACTIVE',
            'La categoría existe, pero está inactiva.',
          ),
        );
      for (const tag of row.tags)
        if (inactiveTags.has(tag.nameNormalized))
          issues.push(
            issue(
              row.rowNumber,
              'etiquetas',
              'TAG_INACTIVE',
              `La etiqueta “${tag.name}” está inactiva.`,
            ),
          );
    }
    return issues;
  }

  async saveValidation(
    input: Parameters<InitialImportBook['saveValidation']>[0],
  ): Promise<InitialImportPreview> {
    const errorCount = input.issues.filter((value) => value.severity === 'error').length;
    const warningCount = input.issues.length - errorCount;
    const row = await this.prisma.initialProductImport.create({
      data: {
        id: input.id,
        fileName: input.fileName,
        fileChecksum: input.checksum,
        status: errorCount === 0 ? InitialImportStatus.VALIDATED : InitialImportStatus.FAILED,
        totalRows: input.totalRows,
        validRows:
          input.totalRows -
          new Set(
            input.issues
              .filter((value) => value.severity === 'error' && value.rowNumber !== null)
              .map((value) => value.rowNumber),
          ).size,
        warningCount,
        errorCount,
        validationSummary: input.issues as unknown as Prisma.InputJsonValue,
        normalizedRows: input.rows as unknown as Prisma.InputJsonValue,
        requestedBy: input.actorId,
        validatedAt: input.validatedAt,
        createdAt: input.validatedAt,
      },
    });
    return preview(row);
  }

  async confirm(input: Parameters<InitialImportBook['confirm']>[0]): Promise<InitialImportResult> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw(
            Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('nova-initial-product-import'))`,
          );
          const source = await tx.initialProductImport.findUnique({
            where: { id: input.importId },
          });
          if (source === null) return { ok: false, reason: 'import-not-found' } as const;
          if (source.status === InitialImportStatus.CONFIRMED)
            return source.confirmationOperationId === input.operationId
              ? ({ ok: true, import: preview(source), replayed: true } as const)
              : ({ ok: false, reason: 'idempotency-conflict' } as const);
          if (source.status === InitialImportStatus.FAILED || source.errorCount > 0)
            return {
              ok: false,
              reason: 'import-has-errors',
              issues: parseIssues(source.validationSummary),
            } as const;
          const previous = await tx.initialProductImport.findFirst({
            where: { status: InitialImportStatus.CONFIRMED },
            select: { id: true },
          });
          if (previous !== null) return { ok: false, reason: 'already-confirmed' } as const;
          const rows = parseRows(source.normalizedRows);
          const codes = rows.map((row) => row.codeNormalized);
          if (await tx.product.count({ where: { codeNormalized: { in: codes } } }))
            return { ok: false, reason: 'catalog-conflict' } as const;
          const locations = await tx.location.findMany({
            where: { code: { in: ['STORE', 'WAREHOUSE'] }, status: RecordStatus.ACTIVE },
          });
          const store = locations.find((row) => row.code === 'STORE');
          const warehouse = locations.find((row) => row.code === 'WAREHOUSE');
          if (store === undefined || warehouse === undefined)
            return { ok: false, reason: 'concurrency-conflict' } as const;
          const categoryNames = new Map(rows.map((row) => [row.categoryNormalized, row.category]));
          const tagNames = new Map(
            rows.flatMap((row) => row.tags.map((tag) => [tag.nameNormalized, tag.name] as const)),
          );
          const categoryIds = await categories(tx, categoryNames, input);
          const tagIds = await tags(tx, tagNames, input);
          if (categoryIds === null || tagIds === null)
            return { ok: false, reason: 'classification-inactive' } as const;
          for (const row of rows)
            await createProduct(tx, row, categoryIds, tagIds, store.id, warehouse.id, input);
          const confirmed = await tx.initialProductImport.update({
            where: { id: source.id },
            data: {
              status: InitialImportStatus.CONFIRMED,
              confirmationOperationId: input.operationId,
              confirmedAt: input.confirmedAt,
            },
          });
          return { ok: true, import: preview(confirmed), replayed: false } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      )
        return { ok: false, reason: 'concurrency-conflict' };
      throw error;
    }
  }
}

async function categories(
  tx: Prisma.TransactionClient,
  names: Map<string, string>,
  input: Parameters<InitialImportBook['confirm']>[0],
): Promise<Map<string, string> | null> {
  const existing = await tx.category.findMany({
    where: { nameNormalized: { in: [...names.keys()] } },
    select: { id: true, nameNormalized: true, status: true },
  });
  if (existing.some((row) => row.status === RecordStatus.INACTIVE)) return null;
  const ids = new Map(existing.map((row) => [row.nameNormalized, row.id]));
  for (const [nameNormalized, name] of [...names].sort(([a], [b]) => a.localeCompare(b))) {
    if (ids.has(nameNormalized)) continue;
    const id = input.ids.generate();
    await tx.category.create({
      data: {
        id,
        name,
        nameNormalized,
        description: null,
        createdAt: input.confirmedAt,
        updatedAt: input.confirmedAt,
      },
    });
    ids.set(nameNormalized, id);
  }
  return ids;
}

async function tags(
  tx: Prisma.TransactionClient,
  names: Map<string, string>,
  input: Parameters<InitialImportBook['confirm']>[0],
): Promise<Map<string, string> | null> {
  const existing = await tx.tag.findMany({
    where: { nameNormalized: { in: [...names.keys()] } },
    select: { id: true, nameNormalized: true, status: true },
  });
  if (existing.some((row) => row.status === RecordStatus.INACTIVE)) return null;
  const ids = new Map(existing.map((row) => [row.nameNormalized, row.id]));
  for (const [nameNormalized, name] of [...names].sort(([a], [b]) => a.localeCompare(b))) {
    if (ids.has(nameNormalized)) continue;
    const id = input.ids.generate();
    await tx.tag.create({
      data: {
        id,
        name,
        nameNormalized,
        createdAt: input.confirmedAt,
        updatedAt: input.confirmedAt,
      },
    });
    ids.set(nameNormalized, id);
  }
  return ids;
}

async function createProduct(
  tx: Prisma.TransactionClient,
  row: InitialProductRow,
  categoryIds: Map<string, string>,
  tagIds: Map<string, string>,
  storeId: string,
  warehouseId: string,
  input: Parameters<InitialImportBook['confirm']>[0],
): Promise<void> {
  const productId = input.ids.generate();
  const total = row.storeQuantity + row.warehouseQuantity;
  const totalValue = total * row.unitCostCents;
  await tx.product.create({
    data: {
      id: productId,
      categoryId: requiredId(categoryIds, row.categoryNormalized),
      code: row.code,
      codeNormalized: row.codeNormalized,
      name: row.name,
      searchName: normalizeProductSearchName(row.name),
      description: row.description,
      minimumPriceCents: BigInt(row.minimumPriceCents),
      suggestedPriceCents:
        row.suggestedPriceCents === null ? null : BigInt(row.suggestedPriceCents),
      maximumPriceCents: row.maximumPriceCents === null ? null : BigInt(row.maximumPriceCents),
      createdAt: input.confirmedAt,
      updatedAt: input.confirmedAt,
      tags: { create: row.tags.map((tag) => ({ tagId: requiredId(tagIds, tag.nameNormalized) })) },
      costPosition: {
        create: {
          id: input.ids.generate(),
          availableQuantity: total,
          availableValueCents: BigInt(totalValue),
          createdAt: input.confirmedAt,
          updatedAt: input.confirmedAt,
        },
      },
    },
  });
  let previousQuantity = 0;
  let previousValue = 0;
  for (const [locationId, quantity] of [
    [storeId, row.storeQuantity],
    [warehouseId, row.warehouseQuantity],
  ] as const) {
    await tx.inventoryPosition.create({
      data: {
        id: input.ids.generate(),
        productId,
        locationId,
        physicalQuantity: quantity,
        createdAt: input.confirmedAt,
        updatedAt: input.confirmedAt,
      },
    });
    if (quantity === 0) continue;
    const value = quantity * row.unitCostCents;
    const movementId = input.ids.generate();
    await tx.inventoryMovement.create({
      data: {
        id: movementId,
        productId,
        locationId,
        type: InventoryMovementType.OPENING,
        physicalDelta: quantity,
        reservedDelta: 0,
        reviewDelta: 0,
        previousPhysicalQuantity: 0,
        resultingPhysicalQuantity: quantity,
        previousReservedQuantity: 0,
        resultingReservedQuantity: 0,
        previousReviewQuantity: 0,
        resultingReviewQuantity: 0,
        actorId: input.actorId,
        effectiveAt: input.confirmedAt,
        reason: `Apertura por importación inicial ${input.importId}`,
        initialImportId: input.importId,
        costMovement: {
          create: {
            id: input.ids.generate(),
            productId,
            type: CostMovementType.OPENING,
            quantityDelta: quantity,
            valueDeltaCents: BigInt(value),
            previousAvailableQuantity: previousQuantity,
            resultingAvailableQuantity: previousQuantity + quantity,
            previousAvailableValueCents: BigInt(previousValue),
            resultingAvailableValueCents: BigInt(previousValue + value),
            previousReservedQuantity: 0,
            resultingReservedQuantity: 0,
            previousReservedValueCents: 0n,
            resultingReservedValueCents: 0n,
            previousReviewQuantity: 0,
            resultingReviewQuantity: 0,
            previousReviewValueCents: 0n,
            resultingReviewValueCents: 0n,
            declaredUnitCostCents: BigInt(row.unitCostCents),
            policy: CostingPolicy.MOVING_AVERAGE_V1,
            actorId: input.actorId,
            effectiveAt: input.confirmedAt,
            reason: `Costo de apertura por importación inicial ${input.importId}`,
            initialImportId: input.importId,
          },
        },
      },
    });
    previousQuantity += quantity;
    previousValue += value;
  }
}

function issue(rowNumber: number, field: string, code: string, message: string): ImportIssue {
  return { rowNumber, field, severity: 'error', code, message };
}
function requiredId(values: Map<string, string>, key: string): string {
  const value = values.get(key);
  if (value === undefined) throw new Error(`Missing classification ${key}.`);
  return value;
}
function parseRows(value: Prisma.JsonValue): InitialProductRow[] {
  if (!Array.isArray(value)) throw new Error('Invalid normalized import rows.');
  return value as unknown as InitialProductRow[];
}
function parseIssues(value: Prisma.JsonValue): ImportIssue[] {
  if (!Array.isArray(value)) throw new Error('Invalid import issues.');
  return value as unknown as ImportIssue[];
}
type ImportRow = Prisma.InitialProductImportGetPayload<Record<string, never>>;
function preview(row: ImportRow): InitialImportPreview {
  return {
    id: row.id,
    fileName: row.fileName,
    checksum: row.fileChecksum,
    status:
      row.status === InitialImportStatus.VALIDATED
        ? 'validated'
        : row.status === InitialImportStatus.FAILED
          ? 'failed'
          : 'confirmed',
    totalRows: row.totalRows,
    validRows: row.validRows,
    warningCount: row.warningCount,
    errorCount: row.errorCount,
    issues: parseIssues(row.validationSummary),
    rows: parseRows(row.normalizedRows),
    validatedAt: row.validatedAt,
    confirmedAt: row.confirmedAt,
  };
}
