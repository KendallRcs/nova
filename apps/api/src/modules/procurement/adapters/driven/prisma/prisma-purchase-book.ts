import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  CashMovementDirection,
  CostMovementType,
  CostingPolicy,
  InventoryMovementType,
  PaymentMethod,
  Prisma,
  RecordStatus,
  SupplierAdvanceStatus,
} from '../../../../../generated/prisma/client';
import type {
  PreparedPurchase,
  PurchaseBook,
  PurchaseLineReceipt,
  PurchaseReceipt,
  PurchaseResult,
} from '../../../hexagon/application/purchase-book';
import { InventoryPosition } from '../../../../inventory/hexagon/domain/inventory-position';
import { ProductCostPosition } from '../../../../inventory/hexagon/domain/product-cost-position';
import { SupplierAdvance } from '../../../hexagon/domain/supplier-advance';

@Injectable()
export class PrismaPurchaseBook implements PurchaseBook {
  constructor(private readonly prisma: PrismaService) {}

  async confirm(command: PreparedPurchase): Promise<PurchaseResult> {
    const fingerprint = commandFingerprint(command);
    const existing = await findExisting(this.prisma, command.operationId);
    if (existing !== null) return replay(existing, command, fingerprint);
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const repeated = await findExisting(transaction, command.operationId);
          if (repeated !== null) return replay(repeated, command, fingerprint);
          await validateReferences(transaction, command);
          const advanceChanges = await prepareAdvances(transaction, command);
          await ensurePositions(transaction, command);
          const positions = await lockPositions(transaction, command);
          const costs = await lockCosts(transaction, command);
          const priorCosts = new Map(
            [...costs.entries()].map(([productId, cost]) => [productId, cost.snapshot()]),
          );
          await transaction.purchase.create({
            data: {
              id: command.purchaseId,
              operationId: command.operationId,
              requestFingerprint: fingerprint,
              supplierId: command.supplierId,
              totalCents: BigInt(command.totalCents),
              advanceAppliedCents: BigInt(command.advanceAppliedCents),
              newlyPaidCents: BigInt(command.newlyPaidCents),
              paymentMethod:
                command.paymentMethod === null ? null : toPrismaMethod(command.paymentMethod),
              createdBy: command.actorId,
              confirmedBy: command.actorId,
              effectiveAt: command.effectiveAt,
              createdAt: command.effectiveAt,
            },
          });
          const lines: PurchaseLineReceipt[] = [];
          for (const line of command.lines) {
            const positionKey = `${line.productId}:${line.destinationLocationId}`;
            const inventory = positions.get(positionKey);
            const cost = costs.get(line.productId);
            if (inventory === undefined || cost === undefined) {
              reject({ ok: false, reason: 'concurrency-conflict' });
            }
            const inventoryBefore = inventory.snapshot();
            const costBefore = cost.snapshot();
            const inventoryResult = inventory.receivePurchase(line.quantity, command.effectiveAt);
            const costResult = cost.receivePurchase(
              line.quantity,
              line.unitCostCents,
              command.effectiveAt,
            );
            if (!inventoryResult.ok || !costResult.ok) {
              reject({ ok: false, reason: 'concurrency-conflict' });
            }
            const inventoryAfter = inventory.snapshot();
            const costAfter = cost.snapshot();
            const priorCost = priorCosts.get(line.productId) ?? costBefore;
            const previousAverageUnitCostCents = averageUnitCost(priorCost);
            const resultingAverageUnitCostCents = averageUnitCost(costAfter) ?? 0;
            const priceReviewSuggested =
              priorCost.availableQuantity > 0 &&
              BigInt(line.unitCostCents) * BigInt(priorCost.availableQuantity) !==
                BigInt(priorCost.availableValueCents);
            await transaction.purchaseLine.create({
              data: {
                id: line.lineId,
                purchaseId: command.purchaseId,
                productId: line.productId,
                destinationLocationId: line.destinationLocationId,
                quantity: line.quantity,
                unitCostCents: BigInt(line.unitCostCents),
                subtotalCents: BigInt(line.subtotalCents),
                previousAverageUnitCostCents:
                  previousAverageUnitCostCents === null
                    ? null
                    : BigInt(previousAverageUnitCostCents),
                resultingAverageUnitCostCents: BigInt(resultingAverageUnitCostCents),
                priceReviewSuggested,
              },
            });
            await transaction.inventoryPosition.update({
              where: { id: inventoryAfter.id },
              data: {
                physicalQuantity: inventoryAfter.physicalQuantity,
                version: inventoryAfter.version,
                updatedAt: inventoryAfter.updatedAt,
              },
            });
            await transaction.productCostPosition.update({
              where: { id: costAfter.id },
              data: {
                availableQuantity: costAfter.availableQuantity,
                availableValueCents: BigInt(costAfter.availableValueCents),
                version: costAfter.version,
                updatedAt: costAfter.updatedAt,
              },
            });
            await transaction.inventoryMovement.create({
              data: {
                id: line.inventoryMovementId,
                productId: line.productId,
                locationId: line.destinationLocationId,
                type: InventoryMovementType.PURCHASE_IN,
                physicalDelta: line.quantity,
                reservedDelta: 0,
                reviewDelta: 0,
                previousPhysicalQuantity: inventoryBefore.physicalQuantity,
                resultingPhysicalQuantity: inventoryAfter.physicalQuantity,
                previousReservedQuantity: inventoryBefore.reservedQuantity,
                resultingReservedQuantity: inventoryAfter.reservedQuantity,
                previousReviewQuantity: inventoryBefore.reviewQuantity,
                resultingReviewQuantity: inventoryAfter.reviewQuantity,
                actorId: command.actorId,
                effectiveAt: command.effectiveAt,
                purchaseLineId: line.lineId,
                costMovement: {
                  create: {
                    id: line.costMovementId,
                    productId: line.productId,
                    type: CostMovementType.PURCHASE_IN,
                    quantityDelta: line.quantity,
                    valueDeltaCents: BigInt(line.subtotalCents),
                    previousAvailableQuantity: costBefore.availableQuantity,
                    resultingAvailableQuantity: costAfter.availableQuantity,
                    previousAvailableValueCents: BigInt(costBefore.availableValueCents),
                    resultingAvailableValueCents: BigInt(costAfter.availableValueCents),
                    previousReservedQuantity: costBefore.reservedQuantity,
                    resultingReservedQuantity: costAfter.reservedQuantity,
                    previousReservedValueCents: BigInt(costBefore.reservedValueCents),
                    resultingReservedValueCents: BigInt(costAfter.reservedValueCents),
                    previousReviewQuantity: costBefore.reviewQuantity,
                    resultingReviewQuantity: costAfter.reviewQuantity,
                    previousReviewValueCents: BigInt(costBefore.reviewValueCents),
                    resultingReviewValueCents: BigInt(costAfter.reviewValueCents),
                    declaredUnitCostCents: BigInt(line.unitCostCents),
                    policy: CostingPolicy.MOVING_AVERAGE_V1,
                    actorId: command.actorId,
                    effectiveAt: command.effectiveAt,
                    reason: `Ingreso por compra ${command.purchaseId}`,
                  },
                },
              },
            });
            lines.push({
              id: line.lineId,
              productId: line.productId,
              destinationLocationId: line.destinationLocationId,
              quantity: line.quantity,
              unitCostCents: line.unitCostCents,
              subtotalCents: line.subtotalCents,
              previousAverageUnitCostCents,
              resultingAverageUnitCostCents,
              priceReviewSuggested,
            });
          }
          for (const change of advanceChanges) {
            await transaction.advanceApplication.create({
              data: {
                id: change.applicationId,
                advanceId: change.advanceId,
                purchaseId: command.purchaseId,
                amountCents: BigInt(change.amountCents),
                expectedAdvanceVersion: change.expectedVersion,
                resultingBalanceCents: BigInt(change.currentBalanceCents),
                resultingAdvanceVersion: change.version,
                appliedBy: command.actorId,
                effectiveAt: command.effectiveAt,
              },
            });
            await transaction.supplierAdvance.update({
              where: { id: change.advanceId },
              data: {
                currentBalanceCents: BigInt(change.currentBalanceCents),
                status:
                  change.status === 'pending'
                    ? SupplierAdvanceStatus.PENDING
                    : SupplierAdvanceStatus.RESOLVED,
                version: change.version,
                updatedAt: command.effectiveAt,
              },
            });
          }
          if (
            command.newlyPaidCents > 0 &&
            command.paymentMethod !== null &&
            command.cashMovementId !== null
          ) {
            await transaction.cashMovement.create({
              data: {
                id: command.cashMovementId,
                idempotencyKey: command.operationId,
                direction: CashMovementDirection.OUTFLOW,
                amountCents: BigInt(command.newlyPaidCents),
                method: toPrismaMethod(command.paymentMethod),
                registeredBy: command.actorId,
                effectiveAt: command.effectiveAt,
                reason: `Pago de compra ${command.purchaseId}`,
                purchaseId: command.purchaseId,
              },
            });
          }
          return { ok: true, replayed: false, purchase: receipt(command, lines) };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof PurchaseRejected) return error.result;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        const repeated = await findExisting(this.prisma, command.operationId);
        return repeated === null
          ? { ok: false, reason: 'concurrency-conflict' }
          : replay(repeated, command, fingerprint);
      }
      throw error;
    }
  }
}

type Rejection = Exclude<PurchaseResult, { ok: true }>;
class PurchaseRejected extends Error {
  constructor(readonly result: Rejection) {
    super(result.reason);
  }
}
function reject(result: Rejection): never {
  throw new PurchaseRejected(result);
}

async function validateReferences(
  transaction: Prisma.TransactionClient,
  command: PreparedPurchase,
): Promise<void> {
  const supplier = await transaction.supplier.findFirst({
    where: { id: command.supplierId, status: RecordStatus.ACTIVE },
    select: { id: true },
  });
  if (supplier === null) reject({ ok: false, reason: 'supplier-not-found' });
  const productIds = [...new Set(command.lines.map((line) => line.productId))];
  const locationIds = [...new Set(command.lines.map((line) => line.destinationLocationId))];
  const [products, locations] = await Promise.all([
    transaction.product.findMany({
      where: { id: { in: productIds }, status: RecordStatus.ACTIVE },
      select: { id: true },
    }),
    transaction.location.findMany({
      where: { id: { in: locationIds }, status: RecordStatus.ACTIVE },
      select: { id: true },
    }),
  ]);
  const foundProducts = new Set(products.map(({ id }) => id));
  const missingProduct = productIds.find((id) => !foundProducts.has(id));
  if (missingProduct !== undefined) {
    reject({ ok: false, reason: 'product-not-found', referenceId: missingProduct });
  }
  const foundLocations = new Set(locations.map(({ id }) => id));
  const missingLocation = locationIds.find((id) => !foundLocations.has(id));
  if (missingLocation !== undefined) {
    reject({ ok: false, reason: 'location-not-found', referenceId: missingLocation });
  }
}

interface AdvanceChange {
  applicationId: string;
  advanceId: string;
  expectedVersion: number;
  amountCents: number;
  currentBalanceCents: number;
  status: 'pending' | 'resolved';
  version: number;
}
async function prepareAdvances(
  transaction: Prisma.TransactionClient,
  command: PreparedPurchase,
): Promise<AdvanceChange[]> {
  const applications = [...command.advanceApplications].sort((a, b) =>
    a.advanceId.localeCompare(b.advanceId),
  );
  const changes: AdvanceChange[] = [];
  for (const application of applications) {
    await transaction.$queryRaw(
      Prisma.sql`SELECT "id" FROM "supplier_advances" WHERE "id" = ${application.advanceId}::uuid FOR UPDATE`,
    );
    const row = await transaction.supplierAdvance.findUnique({
      where: { id: application.advanceId },
    });
    if (row === null) {
      reject({ ok: false, reason: 'advance-not-found', referenceId: application.advanceId });
    }
    if (row.supplierId !== command.supplierId) {
      reject({
        ok: false,
        reason: 'advance-supplier-mismatch',
        referenceId: application.advanceId,
      });
    }
    if (row.version !== application.expectedVersion) {
      reject({ ok: false, reason: 'advance-version-conflict', referenceId: application.advanceId });
    }
    const advance = SupplierAdvance.restore({
      id: row.id,
      currentBalanceCents: safeNumber(row.currentBalanceCents),
      status: row.status === SupplierAdvanceStatus.PENDING ? 'pending' : 'resolved',
      version: row.version,
      updatedAt: row.updatedAt,
    });
    const result = advance.resolve(application.amountCents, command.effectiveAt);
    if (!result.ok) {
      reject({
        ok: false,
        reason: 'insufficient-advance-balance',
        referenceId: application.advanceId,
        currentBalanceCents: safeNumber(row.currentBalanceCents),
      });
    }
    changes.push({ ...application, ...result.balance });
  }
  return changes;
}

async function ensurePositions(
  transaction: Prisma.TransactionClient,
  command: PreparedPurchase,
): Promise<void> {
  for (const line of command.lines) {
    await transaction.inventoryPosition.upsert({
      where: {
        productId_locationId: {
          productId: line.productId,
          locationId: line.destinationLocationId,
        },
      },
      create: {
        id: uuidv7(),
        productId: line.productId,
        locationId: line.destinationLocationId,
        createdAt: command.effectiveAt,
        updatedAt: command.effectiveAt,
      },
      update: {},
    });
    await transaction.productCostPosition.upsert({
      where: { productId: line.productId },
      create: {
        id: uuidv7(),
        productId: line.productId,
        createdAt: command.effectiveAt,
        updatedAt: command.effectiveAt,
      },
      update: {},
    });
  }
}

async function lockPositions(
  transaction: Prisma.TransactionClient,
  command: PreparedPurchase,
): Promise<Map<string, InventoryPosition>> {
  const sorted = [...command.lines].sort((a, b) =>
    `${a.productId}:${a.destinationLocationId}`.localeCompare(
      `${b.productId}:${b.destinationLocationId}`,
    ),
  );
  const result = new Map<string, InventoryPosition>();
  for (const line of sorted) {
    const rows = await transaction.$queryRaw<InventoryRow[]>(Prisma.sql`
      SELECT "id", "product_id" AS "productId", "location_id" AS "locationId",
        "physical_quantity" AS "physicalQuantity", "reserved_quantity" AS "reservedQuantity",
        "review_quantity" AS "reviewQuantity", "version", "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "inventory_positions"
      WHERE "product_id" = ${line.productId}::uuid AND "location_id" = ${line.destinationLocationId}::uuid
      FOR UPDATE
    `);
    const row = rows[0];
    if (row !== undefined) {
      result.set(`${line.productId}:${line.destinationLocationId}`, InventoryPosition.restore(row));
    }
  }
  return result;
}

async function lockCosts(
  transaction: Prisma.TransactionClient,
  command: PreparedPurchase,
): Promise<Map<string, ProductCostPosition>> {
  const productIds = [...new Set(command.lines.map((line) => line.productId))].sort();
  const result = new Map<string, ProductCostPosition>();
  for (const productId of productIds) {
    const rows = await transaction.$queryRaw<CostRow[]>(Prisma.sql`
      SELECT "id", "product_id" AS "productId", "available_quantity" AS "availableQuantity",
        "available_value_cents" AS "availableValueCents", "reserved_quantity" AS "reservedQuantity",
        "reserved_value_cents" AS "reservedValueCents", "review_quantity" AS "reviewQuantity",
        "review_value_cents" AS "reviewValueCents", "version", "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "product_cost_positions" WHERE "product_id" = ${productId}::uuid FOR UPDATE
    `);
    const row = rows[0];
    if (row !== undefined) {
      result.set(
        productId,
        ProductCostPosition.restore({
          ...row,
          availableValueCents: safeNumber(row.availableValueCents),
          reservedValueCents: safeNumber(row.reservedValueCents),
          reviewValueCents: safeNumber(row.reviewValueCents),
          policy: 'moving-average-v1',
        }),
      );
    }
  }
  return result;
}

interface InventoryRow {
  id: string;
  productId: string;
  locationId: string;
  physicalQuantity: number;
  reservedQuantity: number;
  reviewQuantity: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
interface CostRow {
  id: string;
  productId: string;
  availableQuantity: number;
  availableValueCents: bigint;
  reservedQuantity: number;
  reservedValueCents: bigint;
  reviewQuantity: number;
  reviewValueCents: bigint;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

type ExistingPurchase = Prisma.PurchaseGetPayload<{ include: { lines: true } }>;
function findExisting(client: Prisma.TransactionClient | PrismaService, operationId: string) {
  return client.purchase.findUnique({ where: { operationId }, include: { lines: true } });
}
function replay(
  row: ExistingPurchase,
  command: PreparedPurchase,
  fingerprint: string,
): PurchaseResult {
  if (row.supplierId !== command.supplierId || row.requestFingerprint !== fingerprint) {
    return { ok: false, reason: 'idempotency-conflict' };
  }
  return {
    ok: true,
    replayed: true,
    purchase: {
      id: row.id,
      operationId: row.operationId,
      supplierId: row.supplierId,
      totalCents: safeNumber(row.totalCents),
      advanceAppliedCents: safeNumber(row.advanceAppliedCents),
      newlyPaidCents: safeNumber(row.newlyPaidCents),
      paymentMethod: row.paymentMethod === null ? null : fromPrismaMethod(row.paymentMethod),
      createdBy: row.createdBy,
      confirmedBy: row.confirmedBy,
      effectiveAt: row.effectiveAt,
      lines: row.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        destinationLocationId: line.destinationLocationId,
        quantity: line.quantity,
        unitCostCents: safeNumber(line.unitCostCents),
        subtotalCents: safeNumber(line.subtotalCents),
        previousAverageUnitCostCents:
          line.previousAverageUnitCostCents === null
            ? null
            : safeNumber(line.previousAverageUnitCostCents),
        resultingAverageUnitCostCents: safeNumber(line.resultingAverageUnitCostCents),
        priceReviewSuggested: line.priceReviewSuggested,
      })),
    },
  };
}

function receipt(command: PreparedPurchase, lines: PurchaseLineReceipt[]): PurchaseReceipt {
  return {
    id: command.purchaseId,
    operationId: command.operationId,
    supplierId: command.supplierId,
    totalCents: command.totalCents,
    advanceAppliedCents: command.advanceAppliedCents,
    newlyPaidCents: command.newlyPaidCents,
    paymentMethod: command.paymentMethod,
    createdBy: command.actorId,
    confirmedBy: command.actorId,
    effectiveAt: command.effectiveAt,
    lines,
  };
}
function commandFingerprint(command: PreparedPurchase): string {
  return JSON.stringify({
    supplierId: command.supplierId,
    actorId: command.actorId,
    lines: command.lines.map(({ productId, destinationLocationId, quantity, unitCostCents }) => ({
      productId,
      destinationLocationId,
      quantity,
      unitCostCents,
    })),
    advanceApplications: command.advanceApplications.map(
      ({ advanceId, expectedVersion, amountCents }) => ({
        advanceId,
        expectedVersion,
        amountCents,
      }),
    ),
    paymentMethod: command.paymentMethod,
  });
}
function averageUnitCost(snapshot: {
  availableQuantity: number;
  availableValueCents: number;
}): number | null {
  return snapshot.availableQuantity === 0
    ? null
    : Math.floor(snapshot.availableValueCents / snapshot.availableQuantity);
}
function safeNumber(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Amount exceeds JSON safe integer range.');
  return result;
}
function toPrismaMethod(method: 'cash' | 'yape' | 'plin' | 'pos'): PaymentMethod {
  return method === 'cash'
    ? PaymentMethod.CASH
    : method === 'yape'
      ? PaymentMethod.YAPE
      : method === 'plin'
        ? PaymentMethod.PLIN
        : PaymentMethod.POS;
}
function fromPrismaMethod(method: PaymentMethod): 'cash' | 'yape' | 'plin' | 'pos' {
  return method === PaymentMethod.CASH
    ? 'cash'
    : method === PaymentMethod.YAPE
      ? 'yape'
      : method === PaymentMethod.PLIN
        ? 'plin'
        : 'pos';
}
