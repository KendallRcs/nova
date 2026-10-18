import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  CashMovementDirection,
  CostMovementType,
  CostingPolicy,
  InventoryMovementType,
  InventoryReservationStatus,
  PaymentMethod,
  Prisma,
  RecordStatus,
  ReturnCondition,
  SaleLifecycleStatus,
} from '../../../../../generated/prisma/client';
import { InventoryPosition } from '../../../../inventory/hexagon/domain/inventory-position';
import { ProductCostPosition } from '../../../../inventory/hexagon/domain/product-cost-position';
import type {
  PreparedSaleCancellation,
  SaleCancellationBook,
  SaleCancellationReceipt,
  SaleCancellationResult,
} from '../../../hexagon/application/sale-cancellation-book';
import { safeSaleNumber, toSaleDomain } from './prisma-sale-draft.repository';

@Injectable()
export class PrismaSaleCancellationBook implements SaleCancellationBook {
  constructor(private readonly prisma: PrismaService) {}

  async cancel(command: PreparedSaleCancellation): Promise<SaleCancellationResult> {
    const fingerprint = commandFingerprint(command);
    const existing = await findByOperation(this.prisma, command.operationId);
    if (existing !== null) return replay(existing, command, fingerprint);
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          await lockSale(transaction, command.saleId);
          const repeated = await findByOperation(transaction, command.operationId);
          if (repeated !== null) return replay(repeated, command, fingerprint);
          const row = await transaction.sale.findUnique({
            where: { id: command.saleId },
            include: saleInclude,
          });
          if (row === null) reject({ ok: false, reason: 'sale-not-found' });
          if (row.version !== command.expectedVersion) {
            reject({ ok: false, reason: 'version-conflict' });
          }

          const returnLocationIds = command.lines.flatMap((line) =>
            line.returnedQuantity > 0 && line.returnLocationId !== null
              ? [line.returnLocationId]
              : [],
          );
          if (returnLocationIds.length > 0) {
            const locations = await transaction.location.findMany({
              where: { id: { in: [...new Set(returnLocationIds)] }, status: RecordStatus.ACTIVE },
              select: { id: true },
            });
            const active = new Set(locations.map(({ id }) => id));
            const missing = returnLocationIds.find((id) => !active.has(id));
            if (missing !== undefined) {
              reject({ ok: false, reason: 'location-not-found', referenceId: missing });
            }
          }

          const linesById = new Map(row.lines.map((line) => [line.id, line]));
          const cancellationId = uuidv7();
          const sale = toSaleDomain(row);
          const cancelled = sale.cancel({
            cancellation: {
              id: cancellationId,
              reason: command.reason,
              refundAmountCents: command.refundAmountCents,
              refundMethod: command.refundMethod,
              cancelledBy: command.actorId,
              effectiveAt: command.effectiveAt,
              lines: command.lines.map((line) => {
                const source = linesById.get(line.saleLineId);
                return {
                  id: uuidv7(),
                  ...line,
                  releasedQuantity:
                    source?.inventoryReservations.reduce(
                      (sum, reservation) => sum + reservation.activeQuantity,
                      0,
                    ) ?? 0,
                  releasedCostCents:
                    source?.costAllocations.reduce(
                      (sum, allocation) =>
                        sum + safeSaleNumber(allocation.reservedRemainingValueCents),
                      0,
                    ) ?? 0,
                };
              }),
            },
            canCancel: true,
            now: command.effectiveAt,
          });
          if (!cancelled.ok) reject(cancelled);
          const values = sale.toPrimitives();
          const cancellation = values.cancellation;
          if (cancellation === null) throw new Error('Sale cancellation was not recorded.');

          const created = await transaction.saleCancellation.create({
            data: {
              id: cancellationId,
              saleId: command.saleId,
              operationId: command.operationId,
              requestFingerprint: fingerprint,
              reason: cancellation.reason,
              refundAmountCents: BigInt(cancellation.refundAmountCents),
              resultingPaidCents: BigInt(cancelled.paidCents),
              cancelledBy: command.actorId,
              effectiveAt: command.effectiveAt,
              resultingSaleVersion: values.version,
              lines: {
                create: cancellation.lines.map((line) => ({
                  id: line.id,
                  saleLineId: line.saleLineId,
                  releasedQuantity: line.releasedQuantity,
                  returnedQuantity: line.returnedQuantity,
                  notReturnedQuantity: line.notReturnedQuantity,
                  returnLocationId: line.returnLocationId,
                  condition:
                    line.condition === null
                      ? null
                      : line.condition === 'available'
                        ? ReturnCondition.AVAILABLE
                        : ReturnCondition.REVIEW,
                  releasedCostCents: BigInt(line.releasedCostCents),
                  attributedReturnedCostCents: BigInt(line.attributedReturnedCostCents),
                })),
              },
              ...(cancellation.refundAmountCents === 0 || cancellation.refundMethod === null
                ? {}
                : {
                    refund: {
                      create: {
                        id: uuidv7(),
                        amountCents: BigInt(cancellation.refundAmountCents),
                        method: toPrismaPaymentMethod(cancellation.refundMethod),
                        registeredBy: command.actorId,
                        effectiveAt: command.effectiveAt,
                        cashMovement: {
                          create: {
                            id: uuidv7(),
                            idempotencyKey: command.operationId,
                            direction: CashMovementDirection.OUTFLOW,
                            amountCents: BigInt(cancellation.refundAmountCents),
                            method: toPrismaPaymentMethod(cancellation.refundMethod),
                            registeredBy: command.actorId,
                            effectiveAt: command.effectiveAt,
                            reason: `Reembolso de cancelación ${cancellationId}`,
                          },
                        },
                      },
                    },
                  }),
            },
            include: { lines: true, refund: true },
          });

          for (const line of [...cancellation.lines].sort((left, right) => {
            const a = linesById.get(left.saleLineId)?.productId ?? '';
            const b = linesById.get(right.saleLineId)?.productId ?? '';
            return a.localeCompare(b);
          })) {
            const source = linesById.get(line.saleLineId);
            if (source === undefined) throw new Error('Validated cancellation line is missing.');
            if (line.releasedQuantity > 0) {
              await releaseReservation(transaction, {
                cancellationLineId: line.id,
                saleLineId: line.saleLineId,
                productId: source.productId,
                locationId: source.locationId,
                quantity: line.releasedQuantity,
                costCents: line.releasedCostCents,
                actorId: command.actorId,
                reason: cancellation.reason,
                effectiveAt: command.effectiveAt,
              });
            }
            if (line.returnedQuantity > 0) {
              if (line.returnLocationId === null || line.condition === null) {
                throw new Error('Validated cancellation return is incomplete.');
              }
              await receiveCancellationReturn(transaction, {
                cancellationLineId: line.id,
                productId: source.productId,
                locationId: line.returnLocationId,
                quantity: line.returnedQuantity,
                costCents: line.attributedReturnedCostCents,
                condition: line.condition,
                actorId: command.actorId,
                reason: cancellation.reason,
                effectiveAt: command.effectiveAt,
              });
            }
          }

          await transaction.sale.update({
            where: { id: command.saleId },
            data: {
              lifecycleStatus: SaleLifecycleStatus.CANCELLED,
              cancelledAt: command.effectiveAt,
              version: values.version,
              updatedAt: command.effectiveAt,
            },
          });
          return { ok: true, replayed: false, cancellation: receipt(created) };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof CancellationRejected) return error.result;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        const repeated = await findByOperation(this.prisma, command.operationId);
        return repeated === null
          ? { ok: false, reason: 'concurrency-conflict' }
          : replay(repeated, command, fingerprint);
      }
      throw error;
    }
  }
}

interface InventoryCostEffect {
  cancellationLineId: string;
  productId: string;
  locationId: string;
  quantity: number;
  costCents: number;
  actorId: string;
  reason: string;
  effectiveAt: Date;
}

async function releaseReservation(
  transaction: Prisma.TransactionClient,
  input: InventoryCostEffect & { saleLineId: string },
): Promise<void> {
  const state = await lockAndLoadPositions(transaction, input.productId, input.locationId);
  const inventoryChange = state.inventory.releaseReserved(input.quantity, input.effectiveAt);
  const costChange = state.cost.releaseReserved(input.quantity, input.costCents, input.effectiveAt);
  if (!inventoryChange.ok || !costChange.ok) {
    throw new Error('Invalid validated reservation release.');
  }
  await persistEffect(transaction, input, inventoryChange, costChange, 'release');
  await transaction.inventoryReservation.updateMany({
    where: { saleLineId: input.saleLineId, activeQuantity: { gt: 0 } },
    data: {
      activeQuantity: 0,
      status: InventoryReservationStatus.RELEASED,
      endedAt: input.effectiveAt,
    },
  });
  await transaction.saleCostAllocation.updateMany({
    where: { saleLineId: input.saleLineId, reservedRemainingQuantity: { gt: 0 } },
    data: { reservedRemainingQuantity: 0, reservedRemainingValueCents: 0n },
  });
}

async function receiveCancellationReturn(
  transaction: Prisma.TransactionClient,
  input: InventoryCostEffect & { condition: 'available' | 'review' },
): Promise<void> {
  await transaction.inventoryPosition.upsert({
    where: { productId_locationId: { productId: input.productId, locationId: input.locationId } },
    create: {
      id: uuidv7(),
      productId: input.productId,
      locationId: input.locationId,
      createdAt: input.effectiveAt,
      updatedAt: input.effectiveAt,
    },
    update: {},
  });
  const state = await lockAndLoadPositions(transaction, input.productId, input.locationId);
  const inventoryChange = state.inventory.receiveReturn(
    input.quantity,
    input.condition,
    input.effectiveAt,
  );
  const costChange = state.cost.receiveHistoricalReturn(
    input.quantity,
    input.costCents,
    input.condition,
    input.effectiveAt,
  );
  if (!inventoryChange.ok || !costChange.ok) {
    throw new Error('Invalid validated cancellation return.');
  }
  await persistEffect(transaction, input, inventoryChange, costChange, input.condition);
}

async function lockAndLoadPositions(
  transaction: Prisma.TransactionClient,
  productId: string,
  locationId: string,
) {
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "inventory_positions" WHERE "product_id" = ${productId}::uuid AND "location_id" = ${locationId}::uuid FOR UPDATE`,
  );
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "product_cost_positions" WHERE "product_id" = ${productId}::uuid FOR UPDATE`,
  );
  const [positionRow, costRow] = await Promise.all([
    transaction.inventoryPosition.findUnique({
      where: { productId_locationId: { productId, locationId } },
    }),
    transaction.productCostPosition.findUnique({ where: { productId } }),
  ]);
  if (positionRow === null || costRow === null) {
    reject({ ok: false, reason: 'cost-unavailable' });
  }
  return {
    inventory: InventoryPosition.restore({ ...positionRow }),
    cost: ProductCostPosition.restore({
      ...costRow,
      availableValueCents: safeSaleNumber(costRow.availableValueCents),
      reservedValueCents: safeSaleNumber(costRow.reservedValueCents),
      reviewValueCents: safeSaleNumber(costRow.reviewValueCents),
      policy: 'moving-average-v1',
    }),
  };
}

type InventoryChange = Extract<ReturnType<InventoryPosition['receiveReturn']>, { ok: true }>;
type CostChange = Extract<ReturnType<ProductCostPosition['receiveHistoricalReturn']>, { ok: true }>;

async function persistEffect(
  transaction: Prisma.TransactionClient,
  input: InventoryCostEffect,
  inventoryChange: InventoryChange,
  costChange: CostChange,
  kind: 'release' | 'available' | 'review',
): Promise<void> {
  await transaction.inventoryPosition.update({
    where: { id: inventoryChange.after.id },
    data: {
      physicalQuantity: inventoryChange.after.physicalQuantity,
      reservedQuantity: inventoryChange.after.reservedQuantity,
      reviewQuantity: inventoryChange.after.reviewQuantity,
      version: inventoryChange.after.version,
      updatedAt: input.effectiveAt,
    },
  });
  await transaction.productCostPosition.update({
    where: { id: costChange.after.id },
    data: {
      availableQuantity: costChange.after.availableQuantity,
      availableValueCents: BigInt(costChange.after.availableValueCents),
      reservedQuantity: costChange.after.reservedQuantity,
      reservedValueCents: BigInt(costChange.after.reservedValueCents),
      reviewQuantity: costChange.after.reviewQuantity,
      reviewValueCents: BigInt(costChange.after.reviewValueCents),
      version: costChange.after.version,
      updatedAt: input.effectiveAt,
    },
  });
  await transaction.inventoryMovement.create({
    data: {
      id: uuidv7(),
      productId: input.productId,
      locationId: input.locationId,
      type:
        kind === 'release'
          ? InventoryMovementType.RELEASE
          : kind === 'available'
            ? InventoryMovementType.RETURN_AVAILABLE
            : InventoryMovementType.RETURN_REVIEW,
      physicalDelta:
        inventoryChange.after.physicalQuantity - inventoryChange.before.physicalQuantity,
      reservedDelta:
        inventoryChange.after.reservedQuantity - inventoryChange.before.reservedQuantity,
      reviewDelta: inventoryChange.after.reviewQuantity - inventoryChange.before.reviewQuantity,
      previousPhysicalQuantity: inventoryChange.before.physicalQuantity,
      resultingPhysicalQuantity: inventoryChange.after.physicalQuantity,
      previousReservedQuantity: inventoryChange.before.reservedQuantity,
      resultingReservedQuantity: inventoryChange.after.reservedQuantity,
      previousReviewQuantity: inventoryChange.before.reviewQuantity,
      resultingReviewQuantity: inventoryChange.after.reviewQuantity,
      actorId: input.actorId,
      effectiveAt: input.effectiveAt,
      reason: input.reason,
      cancellationLineId: input.cancellationLineId,
      costMovement: {
        create: {
          id: uuidv7(),
          productId: input.productId,
          type:
            kind === 'release'
              ? CostMovementType.RELEASE
              : kind === 'available'
                ? CostMovementType.RETURN_AVAILABLE
                : CostMovementType.RETURN_REVIEW,
          quantityDelta:
            costChange.after.availableQuantity - costChange.before.availableQuantity ||
            costChange.after.reviewQuantity - costChange.before.reviewQuantity,
          valueDeltaCents: BigInt(
            costChange.after.availableValueCents - costChange.before.availableValueCents ||
              costChange.after.reviewValueCents - costChange.before.reviewValueCents,
          ),
          previousAvailableQuantity: costChange.before.availableQuantity,
          resultingAvailableQuantity: costChange.after.availableQuantity,
          previousAvailableValueCents: BigInt(costChange.before.availableValueCents),
          resultingAvailableValueCents: BigInt(costChange.after.availableValueCents),
          previousReservedQuantity: costChange.before.reservedQuantity,
          resultingReservedQuantity: costChange.after.reservedQuantity,
          previousReservedValueCents: BigInt(costChange.before.reservedValueCents),
          resultingReservedValueCents: BigInt(costChange.after.reservedValueCents),
          previousReviewQuantity: costChange.before.reviewQuantity,
          resultingReviewQuantity: costChange.after.reviewQuantity,
          previousReviewValueCents: BigInt(costChange.before.reviewValueCents),
          resultingReviewValueCents: BigInt(costChange.after.reviewValueCents),
          policy: CostingPolicy.MOVING_AVERAGE_V1,
          actorId: input.actorId,
          effectiveAt: input.effectiveAt,
          reason: input.reason,
        },
      },
    },
  });
}

const saleInclude = {
  lines: { include: { inventoryReservations: true, costAllocations: true } },
  payments: { include: { corrections: true } },
  totalAdjustments: true,
  closure: true,
  returns: { include: { lines: true, refund: true } },
  deliveries: { include: { lines: true } },
  cancellation: { include: { lines: true, refund: true } },
} satisfies Prisma.SaleInclude;

type ExistingCancellation = Prisma.SaleCancellationGetPayload<{
  include: { lines: true; refund: true };
}>;
function findByOperation(client: Prisma.TransactionClient | PrismaService, operationId: string) {
  return client.saleCancellation.findUnique({
    where: { operationId },
    include: { lines: true, refund: true },
  });
}
function replay(
  row: ExistingCancellation,
  command: PreparedSaleCancellation,
  fingerprint: string,
): SaleCancellationResult {
  if (row.saleId !== command.saleId || row.requestFingerprint !== fingerprint) {
    return { ok: false, reason: 'idempotency-conflict' };
  }
  return { ok: true, replayed: true, cancellation: receipt(row) };
}
function receipt(row: ExistingCancellation): SaleCancellationReceipt {
  return {
    cancellationId: row.id,
    operationId: row.operationId,
    saleId: row.saleId,
    saleVersion: row.resultingSaleVersion,
    refundAmountCents: safeSaleNumber(row.refundAmountCents),
    refundMethod: row.refund === null ? null : fromPrismaPaymentMethod(row.refund.method),
    paidCents: safeSaleNumber(row.resultingPaidCents),
    releasedQuantity: row.lines.reduce((sum, line) => sum + line.releasedQuantity, 0),
    returnedQuantity: row.lines.reduce((sum, line) => sum + line.returnedQuantity, 0),
    notReturnedQuantity: row.lines.reduce((sum, line) => sum + line.notReturnedQuantity, 0),
    cancelledBy: row.cancelledBy,
    effectiveAt: row.effectiveAt,
  };
}
function commandFingerprint(command: PreparedSaleCancellation): string {
  return JSON.stringify({
    saleId: command.saleId,
    expectedVersion: command.expectedVersion,
    actorId: command.actorId,
    reason: command.reason,
    refundAmountCents: command.refundAmountCents,
    refundMethod: command.refundMethod,
    lines: command.lines,
  });
}
async function lockSale(transaction: Prisma.TransactionClient, saleId: string): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "sales" WHERE "id" = ${saleId}::uuid FOR UPDATE`,
  );
}
type Rejection = Exclude<SaleCancellationResult, { ok: true }>;
class CancellationRejected extends Error {
  constructor(readonly result: Rejection) {
    super(result.reason);
  }
}
function reject(result: Rejection): never {
  throw new CancellationRejected(result);
}
function toPrismaPaymentMethod(method: 'cash' | 'yape' | 'plin' | 'pos'): PaymentMethod {
  return method === 'cash'
    ? PaymentMethod.CASH
    : method === 'yape'
      ? PaymentMethod.YAPE
      : method === 'plin'
        ? PaymentMethod.PLIN
        : PaymentMethod.POS;
}
function fromPrismaPaymentMethod(method: PaymentMethod): 'cash' | 'yape' | 'plin' | 'pos' {
  return method === PaymentMethod.CASH
    ? 'cash'
    : method === PaymentMethod.YAPE
      ? 'yape'
      : method === PaymentMethod.PLIN
        ? 'plin'
        : 'pos';
}
