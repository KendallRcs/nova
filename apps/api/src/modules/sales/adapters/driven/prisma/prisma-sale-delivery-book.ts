import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  CostMovementType,
  CostingPolicy,
  InventoryMovementType,
  InventoryReservationStatus,
  Prisma,
} from '../../../../../generated/prisma/client';
import { InventoryPosition } from '../../../../inventory/hexagon/domain/inventory-position';
import { ProductCostPosition } from '../../../../inventory/hexagon/domain/product-cost-position';
import type {
  PreparedSaleDelivery,
  SaleDeliveryBook,
  SaleDeliveryReceipt,
  SaleDeliveryResult,
} from '../../../hexagon/application/sale-delivery-book';
import { safeSaleNumber, toSaleDomain } from './prisma-sale-draft.repository';

@Injectable()
export class PrismaSaleDeliveryBook implements SaleDeliveryBook {
  constructor(private readonly prisma: PrismaService) {}

  async deliver(command: PreparedSaleDelivery): Promise<SaleDeliveryResult> {
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

          const linesById = new Map(row.lines.map((line) => [line.id, line]));
          const seen = new Set<string>();
          for (const requested of command.lines) {
            if (seen.has(requested.saleLineId)) {
              reject({ ok: false, reason: 'duplicate-line', saleLineId: requested.saleLineId });
            }
            seen.add(requested.saleLineId);
            if (!Number.isSafeInteger(requested.quantity) || requested.quantity <= 0) {
              reject({ ok: false, reason: 'invalid-quantity', saleLineId: requested.saleLineId });
            }
            if (!linesById.has(requested.saleLineId)) {
              reject({
                ok: false,
                reason: 'sale-line-not-found',
                saleLineId: requested.saleLineId,
              });
            }
          }

          const requestedLines = command.lines
            .map((requested) => {
              const source = linesById.get(requested.saleLineId);
              if (source === undefined) {
                reject({
                  ok: false,
                  reason: 'sale-line-not-found',
                  saleLineId: requested.saleLineId,
                });
              }
              return { requested, source };
            })
            .sort((left, right) => left.source.productId.localeCompare(right.source.productId));
          for (const { source } of requestedLines) {
            await lockInventoryState(transaction, source.productId, source.locationId);
          }

          const preparedLines = requestedLines.map(({ requested, source }) => {
            const activeQuantity = source.inventoryReservations.reduce(
              (sum, reservation) => sum + reservation.activeQuantity,
              0,
            );
            if (requested.quantity > activeQuantity) {
              reject({
                ok: false,
                reason: 'quantity-exceeds-reserved',
                saleLineId: requested.saleLineId,
                deliverableQuantity: activeQuantity,
              });
            }
            const cost = costConsumption(source.costAllocations, requested.quantity);
            return {
              id: uuidv7(),
              saleLineId: requested.saleLineId,
              locationId: source.locationId,
              quantity: requested.quantity,
              consumedCostCents: cost.totalCostCents,
              costUpdates: cost.updates,
              source,
            };
          });

          const deliveryId = uuidv7();
          const sale = toSaleDomain(row);
          const delivered = sale.deliver({
            delivery: {
              id: deliveryId,
              deliveredBy: command.actorId,
              effectiveAt: command.effectiveAt,
              lines: preparedLines.map((line) => ({
                id: line.id,
                saleLineId: line.saleLineId,
                locationId: line.locationId,
                quantity: line.quantity,
                consumedCostCents: line.consumedCostCents,
              })),
            },
            actorId: command.actorId,
            canDeliverAny: command.canDeliverAny,
            now: command.effectiveAt,
          });
          if (!delivered.ok) {
            if (delivered.reason === 'invalid-cost') {
              reject({
                ok: false,
                reason: 'cost-unavailable',
                ...(delivered.saleLineId === undefined ? {} : { saleLineId: delivered.saleLineId }),
              });
            }
            reject({
              ok: false,
              reason: delivered.reason,
              ...(delivered.saleLineId === undefined ? {} : { saleLineId: delivered.saleLineId }),
              ...(delivered.deliverableQuantity === undefined
                ? {}
                : { deliverableQuantity: delivered.deliverableQuantity }),
            });
          }
          const values = sale.toPrimitives();
          const created = await transaction.delivery.create({
            data: {
              id: deliveryId,
              saleId: command.saleId,
              operationId: command.operationId,
              requestFingerprint: fingerprint,
              deliveredBy: command.actorId,
              effectiveAt: command.effectiveAt,
              resultingSaleVersion: values.version,
              remainingReservedQuantity: delivered.remainingReservedQuantity,
              lines: {
                create: preparedLines.map((line) => ({
                  id: line.id,
                  saleLineId: line.saleLineId,
                  locationId: line.locationId,
                  quantity: line.quantity,
                  consumedCostCents: BigInt(line.consumedCostCents),
                })),
              },
            },
            include: { lines: true },
          });

          for (const line of preparedLines) {
            await consumeReservedLine(transaction, line, command);
          }
          await transaction.sale.update({
            where: { id: command.saleId },
            data: { version: values.version, updatedAt: command.effectiveAt },
          });
          return {
            ok: true,
            replayed: false,
            delivery: receipt(created),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof DeliveryRejected) return error.result;
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

type SourceLine = Prisma.SaleLineGetPayload<{
  include: { inventoryReservations: true; costAllocations: true };
}>;
interface PreparedLine {
  id: string;
  saleLineId: string;
  locationId: string;
  quantity: number;
  consumedCostCents: number;
  costUpdates: readonly CostUpdate[];
  source: SourceLine;
}
interface CostUpdate {
  id: string;
  quantity: number;
  valueCents: number;
  nextQuantity: number;
  nextValueCents: number;
}

async function consumeReservedLine(
  transaction: Prisma.TransactionClient,
  line: PreparedLine,
  command: PreparedSaleDelivery,
): Promise<void> {
  const [inventoryRow, costRow] = await Promise.all([
    transaction.inventoryPosition.findUnique({
      where: {
        productId_locationId: {
          productId: line.source.productId,
          locationId: line.locationId,
        },
      },
    }),
    transaction.productCostPosition.findUnique({ where: { productId: line.source.productId } }),
  ]);
  if (inventoryRow === null || costRow === null) {
    reject({ ok: false, reason: 'cost-unavailable', saleLineId: line.saleLineId });
  }
  const inventory = InventoryPosition.restore({ ...inventoryRow });
  const cost = ProductCostPosition.restore({
    ...costRow,
    availableValueCents: safeSaleNumber(costRow.availableValueCents),
    reservedValueCents: safeSaleNumber(costRow.reservedValueCents),
    reviewValueCents: safeSaleNumber(costRow.reviewValueCents),
    policy: 'moving-average-v1',
  });
  const inventoryChange = inventory.deliverReserved(line.quantity, command.effectiveAt);
  const costChange = cost.removeReserved(
    line.quantity,
    line.consumedCostCents,
    command.effectiveAt,
  );
  if (!inventoryChange.ok) {
    reject({
      ok: false,
      reason: 'quantity-exceeds-reserved',
      saleLineId: line.saleLineId,
      deliverableQuantity: inventory.snapshot().reservedQuantity,
    });
  }
  if (!costChange.ok)
    reject({ ok: false, reason: 'cost-unavailable', saleLineId: line.saleLineId });

  await transaction.inventoryPosition.update({
    where: { id: inventoryChange.after.id },
    data: {
      physicalQuantity: inventoryChange.after.physicalQuantity,
      reservedQuantity: inventoryChange.after.reservedQuantity,
      reviewQuantity: inventoryChange.after.reviewQuantity,
      version: inventoryChange.after.version,
      updatedAt: command.effectiveAt,
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
      updatedAt: command.effectiveAt,
    },
  });
  let remaining = line.quantity;
  for (const reservation of line.source.inventoryReservations
    .filter(({ activeQuantity }) => activeQuantity > 0)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
    const consumed = Math.min(remaining, reservation.activeQuantity);
    const next = reservation.activeQuantity - consumed;
    await transaction.inventoryReservation.update({
      where: { id: reservation.id },
      data: {
        activeQuantity: next,
        status:
          next === 0
            ? InventoryReservationStatus.CONSUMED
            : InventoryReservationStatus.PARTIALLY_CONSUMED,
        endedAt: next === 0 ? command.effectiveAt : null,
      },
    });
    remaining -= consumed;
    if (remaining === 0) break;
  }
  for (const update of line.costUpdates) {
    await transaction.saleCostAllocation.update({
      where: { id: update.id },
      data: {
        reservedRemainingQuantity: update.nextQuantity,
        reservedRemainingValueCents: BigInt(update.nextValueCents),
      },
    });
  }
  await transaction.inventoryMovement.create({
    data: {
      id: uuidv7(),
      productId: line.source.productId,
      locationId: line.locationId,
      type: InventoryMovementType.DELIVERY,
      physicalDelta: -line.quantity,
      reservedDelta: -line.quantity,
      reviewDelta: 0,
      previousPhysicalQuantity: inventoryChange.before.physicalQuantity,
      resultingPhysicalQuantity: inventoryChange.after.physicalQuantity,
      previousReservedQuantity: inventoryChange.before.reservedQuantity,
      resultingReservedQuantity: inventoryChange.after.reservedQuantity,
      previousReviewQuantity: inventoryChange.before.reviewQuantity,
      resultingReviewQuantity: inventoryChange.after.reviewQuantity,
      actorId: command.actorId,
      effectiveAt: command.effectiveAt,
      reason: `Entrega posterior de venta ${command.saleId}`,
      saleLineId: line.saleLineId,
      deliveryLineId: line.id,
      costMovement: {
        create: {
          id: uuidv7(),
          productId: line.source.productId,
          type: CostMovementType.SALE_ALLOCATION,
          quantityDelta: -line.quantity,
          valueDeltaCents: BigInt(-line.consumedCostCents),
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
          actorId: command.actorId,
          effectiveAt: command.effectiveAt,
          reason: `Entrega posterior de venta ${command.saleId}`,
        },
      },
    },
  });
}

function costConsumption(
  allocations: SourceLine['costAllocations'],
  requestedQuantity: number,
): { totalCostCents: number; updates: CostUpdate[] } {
  let remaining = requestedQuantity;
  let totalCostCents = 0;
  const updates: CostUpdate[] = [];
  for (const allocation of [...allocations].sort(
    (left, right) =>
      left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
  )) {
    if (remaining === 0 || allocation.reservedRemainingQuantity === 0) continue;
    const quantity = Math.min(remaining, allocation.reservedRemainingQuantity);
    const remainingValue = safeSaleNumber(allocation.reservedRemainingValueCents);
    const valueCents =
      quantity === allocation.reservedRemainingQuantity
        ? remainingValue
        : Number(
            (BigInt(remainingValue) * BigInt(quantity)) /
              BigInt(allocation.reservedRemainingQuantity),
          );
    if (!Number.isSafeInteger(valueCents)) throw new Error('Delivery cost exceeds safe range.');
    updates.push({
      id: allocation.id,
      quantity,
      valueCents,
      nextQuantity: allocation.reservedRemainingQuantity - quantity,
      nextValueCents: remainingValue - valueCents,
    });
    totalCostCents += valueCents;
    remaining -= quantity;
  }
  if (remaining > 0) reject({ ok: false, reason: 'cost-unavailable' });
  return { totalCostCents, updates };
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

type ExistingDelivery = Prisma.DeliveryGetPayload<{ include: { lines: true } }>;
function findByOperation(client: Prisma.TransactionClient | PrismaService, operationId: string) {
  return client.delivery.findUnique({ where: { operationId }, include: { lines: true } });
}
function replay(
  row: ExistingDelivery,
  command: PreparedSaleDelivery,
  fingerprint: string,
): SaleDeliveryResult {
  if (row.saleId !== command.saleId || row.requestFingerprint !== fingerprint) {
    return { ok: false, reason: 'idempotency-conflict' };
  }
  return { ok: true, replayed: true, delivery: receipt(row) };
}
function receipt(row: ExistingDelivery): SaleDeliveryReceipt {
  return {
    deliveryId: row.id,
    operationId: row.operationId,
    saleId: row.saleId,
    saleVersion: row.resultingSaleVersion,
    deliveredQuantity: row.lines.reduce((sum, line) => sum + line.quantity, 0),
    remainingReservedQuantity: row.remainingReservedQuantity,
    deliveredBy: row.deliveredBy,
    effectiveAt: row.effectiveAt,
    lines: row.lines.map((line) => ({
      saleLineId: line.saleLineId,
      locationId: line.locationId,
      quantity: line.quantity,
      consumedCostCents: safeSaleNumber(line.consumedCostCents),
    })),
  };
}
function commandFingerprint(command: PreparedSaleDelivery): string {
  return JSON.stringify({
    saleId: command.saleId,
    expectedVersion: command.expectedVersion,
    actorId: command.actorId,
    lines: command.lines,
  });
}
async function lockSale(transaction: Prisma.TransactionClient, saleId: string): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "sales" WHERE "id" = ${saleId}::uuid FOR UPDATE`,
  );
}
async function lockInventoryState(
  transaction: Prisma.TransactionClient,
  productId: string,
  locationId: string,
): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "inventory_positions" WHERE "product_id" = ${productId}::uuid AND "location_id" = ${locationId}::uuid FOR UPDATE`,
  );
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "product_cost_positions" WHERE "product_id" = ${productId}::uuid FOR UPDATE`,
  );
}
type Rejection = Exclude<SaleDeliveryResult, { ok: true }>;
class DeliveryRejected extends Error {
  constructor(readonly result: Rejection) {
    super(result.reason);
  }
}
function reject(result: Rejection): never {
  throw new DeliveryRejected(result);
}
