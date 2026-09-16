import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  CostingPolicy,
  CostMovementType,
  CustomerStatus,
  InventoryMovementType,
  Prisma,
  RecordStatus,
  SaleLifecycleStatus,
} from '../../../../../generated/prisma/client';
import { InventoryPosition } from '../../../../inventory/hexagon/domain/inventory-position';
import { ProductCostPosition } from '../../../../inventory/hexagon/domain/product-cost-position';
import type {
  PreparedSaleConfirmation,
  SaleConfirmationBook,
  SaleConfirmationReceipt,
  SaleConfirmationResult,
} from '../../../hexagon/application/sale-confirmation-book';
import { safeSaleNumber, toSaleDomain } from './prisma-sale-draft.repository';

@Injectable()
export class PrismaSaleConfirmationBook implements SaleConfirmationBook {
  constructor(private readonly prisma: PrismaService) {}

  async confirm(command: PreparedSaleConfirmation): Promise<SaleConfirmationResult> {
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
            include: { lines: { include: { costAllocations: true } } },
          });
          if (row === null) reject({ ok: false, reason: 'sale-not-found' });
          if (row.lifecycleStatus !== SaleLifecycleStatus.DRAFT) {
            reject({ ok: false, reason: 'sale-not-draft' });
          }
          if (row.createdBy !== command.actorId && !command.canConfirmAny) {
            reject({ ok: false, reason: 'not-owner' });
          }
          if (row.version !== command.expectedVersion) {
            reject({ ok: false, reason: 'version-conflict' });
          }

          const canonicalCustomerId = await resolveCustomer(transaction, row.customerId);
          const productIds = row.lines.map(({ productId }) => productId);
          const products = await transaction.product.findMany({
            where: { id: { in: productIds }, status: RecordStatus.ACTIVE },
          });
          const productById = new Map(products.map((product) => [product.id, product]));
          const locationIds = [...new Set(row.lines.map(({ locationId }) => locationId))];
          const locations = await transaction.location.findMany({
            where: { id: { in: locationIds }, status: RecordStatus.ACTIVE },
            select: { id: true },
          });
          const activeLocations = new Set(locations.map(({ id }) => id));
          const missingLocation = locationIds.find((id) => !activeLocations.has(id));
          if (missingLocation !== undefined) {
            reject({ ok: false, reason: 'location-not-found', referenceId: missingLocation });
          }

          const sale = toSaleDomain(row);
          const confirmed = sale.confirm({
            customerId: canonicalCustomerId,
            productSnapshots: new Map(
              products.map((product) => [
                product.id,
                {
                  code: product.code,
                  name: product.name,
                  minimumPriceCents: safeSaleNumber(product.minimumPriceCents),
                  suggestedPriceCents:
                    product.suggestedPriceCents === null
                      ? null
                      : safeSaleNumber(product.suggestedPriceCents),
                  maximumPriceCents:
                    product.maximumPriceCents === null
                      ? null
                      : safeSaleNumber(product.maximumPriceCents),
                },
              ]),
            ),
            priceExceptionReasons: new Map(
              command.priceExceptions.map(({ saleLineId, reason }) => [saleLineId, reason]),
            ),
            confirmedBy: command.actorId,
            canApprovePriceException: command.canApprovePriceException,
            now: command.effectiveAt,
          });
          if (!confirmed.ok) {
            reject({
              ok: false,
              reason: confirmed.reason,
              ...(confirmed.productId === undefined ? {} : { referenceId: confirmed.productId }),
            });
          }

          let deliveredQuantity = 0;
          let reservedQuantity = 0;
          let allocatedCostCents = 0;
          for (const line of [...sale.toPrimitives().lines].sort((left, right) =>
            `${left.productId}:${left.locationId}`.localeCompare(
              `${right.productId}:${right.locationId}`,
            ),
          )) {
            if (!productById.has(line.productId)) {
              reject({ ok: false, reason: 'product-not-found', referenceId: line.productId });
            }
            const fulfilled = await fulfillLine(transaction, line, command);
            deliveredQuantity += line.deliveryQuantity;
            reservedQuantity += line.reservationQuantity;
            allocatedCostCents += fulfilled.totalCostCents;
            sale.attributeConfirmedCost(line.id, fulfilled.totalCostCents);
          }

          const values = sale.toPrimitives();
          await transaction.sale.update({
            where: { id: values.id },
            data: {
              customerId: values.customerId,
              lifecycleStatus: SaleLifecycleStatus.CONFIRMED,
              version: values.version,
              confirmedAt: command.effectiveAt,
              confirmedBy: command.actorId,
              confirmationOperationId: command.operationId,
              confirmationFingerprint: fingerprint,
              updatedAt: command.effectiveAt,
            },
          });
          for (const line of values.lines) {
            if (line.snapshot === null) throw new Error('Confirmed line is missing its snapshot.');
            await transaction.saleLine.update({
              where: { id: line.id },
              data: {
                snapshotCode: line.snapshot.code,
                snapshotName: line.snapshot.name,
                snapshotMinimumPriceCents: BigInt(line.snapshot.minimumPriceCents),
                snapshotSuggestedPriceCents:
                  line.snapshot.suggestedPriceCents === null
                    ? null
                    : BigInt(line.snapshot.suggestedPriceCents),
                snapshotMaximumPriceCents:
                  line.snapshot.maximumPriceCents === null
                    ? null
                    : BigInt(line.snapshot.maximumPriceCents),
                priceExceptionReason: line.priceExceptionReason,
                priceApprovedBy: line.priceApprovedBy,
                allocatedCostCents: BigInt(line.allocatedCostCents ?? 0),
                costingPolicy: CostingPolicy.MOVING_AVERAGE_V1,
                updatedAt: command.effectiveAt,
              },
            });
          }
          return {
            ok: true,
            replayed: false,
            confirmation: {
              saleId: values.id,
              operationId: command.operationId,
              version: values.version,
              confirmedBy: command.actorId,
              confirmedAt: command.effectiveAt,
              totalCents: values.currentTotalCents,
              deliveredQuantity,
              reservedQuantity,
              allocatedCostCents,
            },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof ConfirmationRejected) return error.result;
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

type Rejection = Exclude<SaleConfirmationResult, { ok: true }>;
class ConfirmationRejected extends Error {
  constructor(readonly result: Rejection) {
    super(result.reason);
  }
}
function reject(result: Rejection): never {
  throw new ConfirmationRejected(result);
}

async function resolveCustomer(
  transaction: Prisma.TransactionClient,
  customerId: string | null,
): Promise<string | null> {
  if (customerId === null) return null;
  const customer = await transaction.customer.findUnique({ where: { id: customerId } });
  if (customer === null)
    reject({ ok: false, reason: 'customer-not-found', referenceId: customerId });
  if (customer.status === CustomerStatus.ACTIVE) return customer.id;
  if (customer.mergedIntoCustomerId === null) {
    reject({ ok: false, reason: 'customer-not-found', referenceId: customerId });
  }
  return customer.mergedIntoCustomerId;
}

type ConfirmedLine = ReturnType<ReturnType<typeof toSaleDomain>['toPrimitives']>['lines'][number];
async function fulfillLine(
  transaction: Prisma.TransactionClient,
  line: ConfirmedLine,
  command: PreparedSaleConfirmation,
): Promise<{ totalCostCents: number }> {
  const quantity = line.deliveryQuantity + line.reservationQuantity;
  if (quantity === 0) return { totalCostCents: 0 };
  const inventoryRow = await lockInventory(transaction, line.productId, line.locationId);
  if (inventoryRow === undefined) {
    reject({
      ok: false,
      reason: 'insufficient-stock',
      referenceId: line.productId,
      availableQuantity: 0,
    });
  }
  const costRow = await lockCost(transaction, line.productId);
  if (costRow === undefined)
    reject({ ok: false, reason: 'cost-unavailable', referenceId: line.productId });
  const inventory = InventoryPosition.restore(inventoryRow);
  const cost = ProductCostPosition.restore({
    ...costRow,
    availableValueCents: safeSaleNumber(costRow.availableValueCents),
    reservedValueCents: safeSaleNumber(costRow.reservedValueCents),
    reviewValueCents: safeSaleNumber(costRow.reviewValueCents),
    policy: 'moving-average-v1',
  });
  let totalCostCents = 0;
  let reservedCostCents = 0;
  if (line.reservationQuantity > 0) {
    const changed = inventory.reserveAvailable(line.reservationQuantity, command.effectiveAt);
    if (!changed.ok) reject(stockRejection(line.productId, changed.availableQuantity));
    const costChanged = cost.reserveAvailable(line.reservationQuantity, command.effectiveAt);
    if (!costChanged.ok)
      reject({ ok: false, reason: 'cost-unavailable', referenceId: line.productId });
    reservedCostCents = costChanged.reservedValueCents;
    totalCostCents += reservedCostCents;
    await recordEffect(transaction, line, command, changed, costChanged, 'reservation');
    await transaction.inventoryReservation.create({
      data: {
        id: uuidv7(),
        saleLineId: line.id,
        locationId: line.locationId,
        initialQuantity: line.reservationQuantity,
        activeQuantity: line.reservationQuantity,
        createdAt: command.effectiveAt,
      },
    });
  }
  if (line.deliveryQuantity > 0) {
    const changed = inventory.deliverAvailable(line.deliveryQuantity, command.effectiveAt);
    if (!changed.ok) reject(stockRejection(line.productId, changed.availableQuantity));
    const costChanged = cost.removeAvailable(line.deliveryQuantity, command.effectiveAt);
    if (!costChanged.ok)
      reject({ ok: false, reason: 'cost-unavailable', referenceId: line.productId });
    totalCostCents += costChanged.removedValueCents;
    await recordEffect(transaction, line, command, changed, costChanged, 'delivery');
  }
  const inventoryAfter = inventory.snapshot();
  const costAfter = cost.snapshot();
  await transaction.inventoryPosition.update({
    where: { id: inventoryAfter.id },
    data: {
      physicalQuantity: inventoryAfter.physicalQuantity,
      reservedQuantity: inventoryAfter.reservedQuantity,
      reviewQuantity: inventoryAfter.reviewQuantity,
      version: inventoryAfter.version,
      updatedAt: inventoryAfter.updatedAt,
    },
  });
  await transaction.productCostPosition.update({
    where: { id: costAfter.id },
    data: {
      availableQuantity: costAfter.availableQuantity,
      availableValueCents: BigInt(costAfter.availableValueCents),
      reservedQuantity: costAfter.reservedQuantity,
      reservedValueCents: BigInt(costAfter.reservedValueCents),
      reviewQuantity: costAfter.reviewQuantity,
      reviewValueCents: BigInt(costAfter.reviewValueCents),
      version: costAfter.version,
      updatedAt: costAfter.updatedAt,
    },
  });
  await transaction.saleCostAllocation.create({
    data: {
      id: uuidv7(),
      saleLineId: line.id,
      quantity,
      totalCostCents: BigInt(totalCostCents),
      reservedRemainingQuantity: line.reservationQuantity,
      reservedRemainingValueCents: BigInt(reservedCostCents),
      policy: CostingPolicy.MOVING_AVERAGE_V1,
      createdAt: command.effectiveAt,
    },
  });
  return { totalCostCents };
}

function stockRejection(productId: string, availableQuantity?: number): Rejection {
  return {
    ok: false,
    reason: 'insufficient-stock',
    referenceId: productId,
    ...(availableQuantity === undefined ? {} : { availableQuantity }),
  };
}

interface InventoryChange {
  before: ReturnType<InventoryPosition['snapshot']>;
  after: ReturnType<InventoryPosition['snapshot']>;
}
interface CostChange {
  before: ReturnType<ProductCostPosition['snapshot']>;
  after: ReturnType<ProductCostPosition['snapshot']>;
}
async function recordEffect(
  transaction: Prisma.TransactionClient,
  line: ConfirmedLine,
  command: PreparedSaleConfirmation,
  inventory: InventoryChange,
  cost: CostChange,
  kind: 'reservation' | 'delivery',
): Promise<void> {
  const movementId = uuidv7();
  await transaction.inventoryMovement.create({
    data: {
      id: movementId,
      productId: line.productId,
      locationId: line.locationId,
      type:
        kind === 'reservation' ? InventoryMovementType.RESERVATION : InventoryMovementType.DELIVERY,
      physicalDelta: inventory.after.physicalQuantity - inventory.before.physicalQuantity,
      reservedDelta: inventory.after.reservedQuantity - inventory.before.reservedQuantity,
      reviewDelta: 0,
      previousPhysicalQuantity: inventory.before.physicalQuantity,
      resultingPhysicalQuantity: inventory.after.physicalQuantity,
      previousReservedQuantity: inventory.before.reservedQuantity,
      resultingReservedQuantity: inventory.after.reservedQuantity,
      previousReviewQuantity: inventory.before.reviewQuantity,
      resultingReviewQuantity: inventory.after.reviewQuantity,
      actorId: command.actorId,
      effectiveAt: command.effectiveAt,
      reason: `Confirmación de venta ${command.saleId}`,
      saleLineId: line.id,
      costMovement: {
        create: {
          id: uuidv7(),
          productId: line.productId,
          type:
            kind === 'reservation'
              ? CostMovementType.RESERVATION
              : CostMovementType.SALE_ALLOCATION,
          quantityDelta: cost.after.availableQuantity - cost.before.availableQuantity,
          valueDeltaCents: BigInt(cost.after.availableValueCents - cost.before.availableValueCents),
          previousAvailableQuantity: cost.before.availableQuantity,
          resultingAvailableQuantity: cost.after.availableQuantity,
          previousAvailableValueCents: BigInt(cost.before.availableValueCents),
          resultingAvailableValueCents: BigInt(cost.after.availableValueCents),
          previousReservedQuantity: cost.before.reservedQuantity,
          resultingReservedQuantity: cost.after.reservedQuantity,
          previousReservedValueCents: BigInt(cost.before.reservedValueCents),
          resultingReservedValueCents: BigInt(cost.after.reservedValueCents),
          previousReviewQuantity: cost.before.reviewQuantity,
          resultingReviewQuantity: cost.after.reviewQuantity,
          previousReviewValueCents: BigInt(cost.before.reviewValueCents),
          resultingReviewValueCents: BigInt(cost.after.reviewValueCents),
          policy: CostingPolicy.MOVING_AVERAGE_V1,
          actorId: command.actorId,
          effectiveAt: command.effectiveAt,
          reason: `Confirmación de venta ${command.saleId}`,
        },
      },
    },
  });
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
async function lockSale(tx: Prisma.TransactionClient, saleId: string): Promise<void> {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "sales" WHERE "id" = ${saleId}::uuid FOR UPDATE`);
}
async function lockInventory(tx: Prisma.TransactionClient, productId: string, locationId: string) {
  const rows = await tx.$queryRaw<InventoryRow[]>(Prisma.sql`
    SELECT "id", "product_id" AS "productId", "location_id" AS "locationId",
      "physical_quantity" AS "physicalQuantity", "reserved_quantity" AS "reservedQuantity",
      "review_quantity" AS "reviewQuantity", "version", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
    FROM "inventory_positions" WHERE "product_id" = ${productId}::uuid AND "location_id" = ${locationId}::uuid FOR UPDATE
  `);
  return rows[0];
}
async function lockCost(tx: Prisma.TransactionClient, productId: string) {
  const rows = await tx.$queryRaw<CostRow[]>(Prisma.sql`
    SELECT "id", "product_id" AS "productId", "available_quantity" AS "availableQuantity",
      "available_value_cents" AS "availableValueCents", "reserved_quantity" AS "reservedQuantity",
      "reserved_value_cents" AS "reservedValueCents", "review_quantity" AS "reviewQuantity",
      "review_value_cents" AS "reviewValueCents", "version", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
    FROM "product_cost_positions" WHERE "product_id" = ${productId}::uuid FOR UPDATE
  `);
  return rows[0];
}

type ExistingConfirmation = Prisma.SaleGetPayload<{
  include: { lines: { include: { costAllocations: true } } };
}>;
function findByOperation(client: Prisma.TransactionClient | PrismaService, operationId: string) {
  return client.sale.findUnique({
    where: { confirmationOperationId: operationId },
    include: { lines: { include: { costAllocations: true } } },
  });
}
function replay(
  sale: ExistingConfirmation,
  command: PreparedSaleConfirmation,
  fingerprint: string,
): SaleConfirmationResult {
  if (sale.id !== command.saleId || sale.confirmationFingerprint !== fingerprint) {
    return { ok: false, reason: 'idempotency-conflict' };
  }
  return { ok: true, replayed: true, confirmation: receiptFromRow(sale) };
}
function receiptFromRow(sale: ExistingConfirmation): SaleConfirmationReceipt {
  if (
    sale.confirmationOperationId === null ||
    sale.confirmedBy === null ||
    sale.confirmedAt === null
  ) {
    throw new Error('Confirmed sale is missing confirmation metadata.');
  }
  return {
    saleId: sale.id,
    operationId: sale.confirmationOperationId,
    version: sale.version,
    confirmedBy: sale.confirmedBy,
    confirmedAt: sale.confirmedAt,
    totalCents: safeSaleNumber(sale.currentTotalCents),
    deliveredQuantity: sale.lines.reduce((sum, line) => sum + line.deliveryQuantity, 0),
    reservedQuantity: sale.lines.reduce((sum, line) => sum + line.reservationQuantity, 0),
    allocatedCostCents: sale.lines.reduce(
      (sum, line) => sum + safeSaleNumber(line.allocatedCostCents ?? 0n),
      0,
    ),
  };
}
function commandFingerprint(command: PreparedSaleConfirmation): string {
  return JSON.stringify({
    saleId: command.saleId,
    expectedVersion: command.expectedVersion,
    actorId: command.actorId,
    priceExceptions: [...command.priceExceptions]
      .map(({ saleLineId, reason }) => ({ saleLineId, reason: reason.trim() }))
      .sort((left, right) => left.saleLineId.localeCompare(right.saleLineId)),
  });
}
