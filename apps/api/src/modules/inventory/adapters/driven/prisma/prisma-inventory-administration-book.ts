import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  CostMovementType,
  CostingPolicy,
  InventoryAdministrativeCategory,
  InventoryMovementType,
  Prisma,
  RecordStatus,
} from '../../../../../generated/prisma/client';
import type {
  InventoryAdministrationBook,
  InventoryAdministrationReceipt,
  InventoryAdministrationResult,
  PreparedInventoryAdministrationCommand,
} from '../../../hexagon/application/inventory-administration-book';
import { InventoryPosition } from '../../../hexagon/domain/inventory-position';
import { ProductCostPosition } from '../../../hexagon/domain/product-cost-position';

@Injectable()
export class PrismaInventoryAdministrationBook implements InventoryAdministrationBook {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    command: PreparedInventoryAdministrationCommand,
  ): Promise<InventoryAdministrationResult> {
    const existing = await findExisting(this.prisma, command.operationId);
    if (existing !== null) return replay(existing, command);

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const repeated = await findExisting(transaction, command.operationId);
          if (repeated !== null) return replay(repeated, command);

          const product = await transaction.product.findFirst({
            where: { id: command.productId, status: RecordStatus.ACTIVE },
            select: { id: true },
          });
          if (product === null) reject({ ok: false, reason: 'product-not-found' });
          const location = await transaction.location.findFirst({
            where: { id: command.locationId, status: RecordStatus.ACTIVE },
            select: { id: true },
          });
          if (location === null) reject({ ok: false, reason: 'location-not-found' });

          const previousPosition = await transaction.inventoryPosition.findUnique({
            where: {
              productId_locationId: {
                productId: command.productId,
                locationId: command.locationId,
              },
            },
            select: { version: true },
          });
          if (
            command.kind === 'count-adjustment' &&
            command.expectedPositionVersion !== (previousPosition?.version ?? 0)
          ) {
            reject({ ok: false, reason: 'version-conflict' });
          }

          await transaction.inventoryPosition.upsert({
            where: {
              productId_locationId: {
                productId: command.productId,
                locationId: command.locationId,
              },
            },
            create: {
              id: uuidv7(),
              productId: command.productId,
              locationId: command.locationId,
              createdAt: command.effectiveAt,
              updatedAt: command.effectiveAt,
            },
            update: {},
          });
          await transaction.productCostPosition.upsert({
            where: { productId: command.productId },
            create: {
              id: uuidv7(),
              productId: command.productId,
              createdAt: command.effectiveAt,
              updatedAt: command.effectiveAt,
            },
            update: {},
          });

          const inventoryRow = await lockInventoryPosition(
            transaction,
            command.productId,
            command.locationId,
          );
          const costRow = await lockCostPosition(transaction, command.productId);
          if (inventoryRow === undefined || costRow === undefined) {
            reject({ ok: false, reason: 'concurrency-conflict' });
          }
          const inventory = InventoryPosition.restore(inventoryRow);
          const cost = ProductCostPosition.restore({
            ...costRow,
            availableValueCents: safeNumber(costRow.availableValueCents),
            reservedValueCents: safeNumber(costRow.reservedValueCents),
            reviewValueCents: safeNumber(costRow.reviewValueCents),
            policy: 'moving-average-v1',
          });
          const changed = applyChange(inventory, cost, command);
          await transaction.inventoryPosition.update({
            where: { id: changed.inventoryAfter.id },
            data: {
              physicalQuantity: changed.inventoryAfter.physicalQuantity,
              reservedQuantity: changed.inventoryAfter.reservedQuantity,
              reviewQuantity: changed.inventoryAfter.reviewQuantity,
              version: changed.inventoryAfter.version,
              updatedAt: changed.inventoryAfter.updatedAt,
            },
          });
          await transaction.productCostPosition.update({
            where: { id: changed.costAfter.id },
            data: {
              availableQuantity: changed.costAfter.availableQuantity,
              availableValueCents: BigInt(changed.costAfter.availableValueCents),
              reservedQuantity: changed.costAfter.reservedQuantity,
              reservedValueCents: BigInt(changed.costAfter.reservedValueCents),
              reviewQuantity: changed.costAfter.reviewQuantity,
              reviewValueCents: BigInt(changed.costAfter.reviewValueCents),
              version: changed.costAfter.version,
              updatedAt: changed.costAfter.updatedAt,
            },
          });
          const movementType = movementTypeFor(command, changed.physicalDelta);
          await transaction.inventoryMovement.create({
            data: {
              id: command.movementId,
              operationId: command.operationId,
              expectedPositionVersion:
                command.kind === 'count-adjustment' ? command.expectedPositionVersion : null,
              productId: command.productId,
              locationId: command.locationId,
              type: movementType.inventory,
              administrativeCategory:
                command.kind === 'write-off' ? CATEGORY_TO_PRISMA[command.category] : null,
              physicalDelta: changed.physicalDelta,
              reservedDelta: 0,
              reviewDelta: 0,
              previousPhysicalQuantity: changed.inventoryBefore.physicalQuantity,
              resultingPhysicalQuantity: changed.inventoryAfter.physicalQuantity,
              previousReservedQuantity: changed.inventoryBefore.reservedQuantity,
              resultingReservedQuantity: changed.inventoryAfter.reservedQuantity,
              previousReviewQuantity: changed.inventoryBefore.reviewQuantity,
              resultingReviewQuantity: changed.inventoryAfter.reviewQuantity,
              actorId: command.actorId,
              effectiveAt: command.effectiveAt,
              reason: command.reason,
              costMovement: {
                create: {
                  id: command.costMovementId,
                  productId: command.productId,
                  type: movementType.cost,
                  quantityDelta:
                    changed.costAfter.availableQuantity - changed.costBefore.availableQuantity,
                  valueDeltaCents: BigInt(changed.valueDeltaCents),
                  previousAvailableQuantity: changed.costBefore.availableQuantity,
                  resultingAvailableQuantity: changed.costAfter.availableQuantity,
                  previousAvailableValueCents: BigInt(changed.costBefore.availableValueCents),
                  resultingAvailableValueCents: BigInt(changed.costAfter.availableValueCents),
                  previousReservedQuantity: changed.costBefore.reservedQuantity,
                  resultingReservedQuantity: changed.costAfter.reservedQuantity,
                  previousReservedValueCents: BigInt(changed.costBefore.reservedValueCents),
                  resultingReservedValueCents: BigInt(changed.costAfter.reservedValueCents),
                  previousReviewQuantity: changed.costBefore.reviewQuantity,
                  resultingReviewQuantity: changed.costAfter.reviewQuantity,
                  previousReviewValueCents: BigInt(changed.costBefore.reviewValueCents),
                  resultingReviewValueCents: BigInt(changed.costAfter.reviewValueCents),
                  declaredUnitCostCents:
                    command.kind === 'count-adjustment' && command.declaredUnitCostCents !== null
                      ? BigInt(command.declaredUnitCostCents)
                      : null,
                  policy: CostingPolicy.MOVING_AVERAGE_V1,
                  actorId: command.actorId,
                  effectiveAt: command.effectiveAt,
                  reason: command.reason,
                },
              },
            },
          });
          return {
            ok: true,
            movement: receipt(command, changed, movementType.label),
            replayed: false,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof AdministrationRejected) return error.result;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        const repeated = await findExisting(this.prisma, command.operationId);
        return repeated === null
          ? { ok: false, reason: 'concurrency-conflict' }
          : replay(repeated, command);
      }
      throw error;
    }
  }
}

type Rejection = Exclude<InventoryAdministrationResult, { ok: true }>;
class AdministrationRejected extends Error {
  constructor(readonly result: Rejection) {
    super(result.reason);
  }
}
function reject(result: Rejection): never {
  throw new AdministrationRejected(result);
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

async function lockInventoryPosition(
  tx: Prisma.TransactionClient,
  productId: string,
  locationId: string,
): Promise<InventoryRow | undefined> {
  const rows = await tx.$queryRaw<InventoryRow[]>(Prisma.sql`
    SELECT "id", "product_id" AS "productId", "location_id" AS "locationId",
      "physical_quantity" AS "physicalQuantity", "reserved_quantity" AS "reservedQuantity",
      "review_quantity" AS "reviewQuantity", "version", "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    FROM "inventory_positions"
    WHERE "product_id" = ${productId}::uuid AND "location_id" = ${locationId}::uuid
    FOR UPDATE
  `);
  return rows[0];
}

async function lockCostPosition(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<CostRow | undefined> {
  const rows = await tx.$queryRaw<CostRow[]>(Prisma.sql`
    SELECT "id", "product_id" AS "productId", "available_quantity" AS "availableQuantity",
      "available_value_cents" AS "availableValueCents", "reserved_quantity" AS "reservedQuantity",
      "reserved_value_cents" AS "reservedValueCents", "review_quantity" AS "reviewQuantity",
      "review_value_cents" AS "reviewValueCents", "version", "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    FROM "product_cost_positions" WHERE "product_id" = ${productId}::uuid FOR UPDATE
  `);
  return rows[0];
}

function applyChange(
  inventory: InventoryPosition,
  cost: ProductCostPosition,
  command: PreparedInventoryAdministrationCommand,
) {
  const inventoryBefore = inventory.snapshot();
  const costBefore = cost.snapshot();
  if (command.kind === 'write-off') {
    const inventoryResult = inventory.writeOffAvailable(command.quantity, command.effectiveAt);
    if (!inventoryResult.ok) {
      reject({
        ok: false,
        reason: inventoryResult.reason,
        ...(inventoryResult.availableQuantity === undefined
          ? {}
          : { availableQuantity: inventoryResult.availableQuantity }),
      });
    }
    const costResult = cost.removeAvailable(command.quantity, command.effectiveAt);
    if (!costResult.ok) reject({ ok: false, reason: 'cost-unavailable' });
  } else {
    const inventoryResult = inventory.adjustToPhysicalCount(
      command.observedPhysicalQuantity,
      command.effectiveAt,
    );
    if (!inventoryResult.ok) {
      reject({
        ok: false,
        reason: inventoryResult.reason,
        ...(inventoryResult.minimumPhysicalQuantity === undefined
          ? {}
          : { minimumPhysicalQuantity: inventoryResult.minimumPhysicalQuantity }),
      });
    }
    const costResult =
      inventoryResult.difference < 0
        ? cost.removeAvailable(-inventoryResult.difference, command.effectiveAt)
        : cost.addAvailableAtMovingAverage(
            inventoryResult.difference,
            command.declaredUnitCostCents,
            command.effectiveAt,
          );
    if (!costResult.ok) {
      reject({
        ok: false,
        reason:
          costResult.reason === 'unit-cost-required' || costResult.reason === 'invalid-unit-cost'
            ? costResult.reason
            : 'cost-unavailable',
      });
    }
  }
  const inventoryAfter = inventory.snapshot();
  const costAfter = cost.snapshot();
  return {
    inventoryBefore,
    inventoryAfter,
    costBefore,
    costAfter,
    physicalDelta: inventoryAfter.physicalQuantity - inventoryBefore.physicalQuantity,
    valueDeltaCents: costAfter.availableValueCents - costBefore.availableValueCents,
  };
}

function movementTypeFor(command: PreparedInventoryAdministrationCommand, physicalDelta: number) {
  if (command.kind === 'write-off') {
    return {
      inventory: InventoryMovementType.WRITE_OFF,
      cost: CostMovementType.WRITE_OFF,
      label: 'write-off' as const,
    };
  }
  return physicalDelta > 0
    ? {
        inventory: InventoryMovementType.ADJUSTMENT_IN,
        cost: CostMovementType.ADJUSTMENT_IN,
        label: 'adjustment-in' as const,
      }
    : {
        inventory: InventoryMovementType.ADJUSTMENT_OUT,
        cost: CostMovementType.ADJUSTMENT_OUT,
        label: 'adjustment-out' as const,
      };
}

const CATEGORY_TO_PRISMA = {
  damaged: InventoryAdministrativeCategory.DAMAGED,
  lost: InventoryAdministrativeCategory.LOST,
  defective: InventoryAdministrativeCategory.DEFECTIVE,
  other: InventoryAdministrativeCategory.OTHER,
} as const;

type Change = ReturnType<typeof applyChange>;
function receipt(
  command: PreparedInventoryAdministrationCommand,
  change: Change,
  type: InventoryAdministrationReceipt['type'],
): InventoryAdministrationReceipt {
  return {
    movementId: command.movementId,
    operationId: command.operationId,
    productId: command.productId,
    locationId: command.locationId,
    type,
    physicalDelta: change.physicalDelta,
    valueDeltaCents: change.valueDeltaCents,
    physicalQuantity: change.inventoryAfter.physicalQuantity,
    reservedQuantity: change.inventoryAfter.reservedQuantity,
    reviewQuantity: change.inventoryAfter.reviewQuantity,
    availableQuantity: change.inventoryAfter.availableQuantity,
    availableCostQuantity: change.costAfter.availableQuantity,
    availableCostValueCents: change.costAfter.availableValueCents,
    actorId: command.actorId,
    effectiveAt: command.effectiveAt,
    reason: command.reason,
    category: command.kind === 'write-off' ? command.category : null,
    declaredUnitCostCents:
      command.kind === 'count-adjustment' ? command.declaredUnitCostCents : null,
  };
}

type ExistingMovement = Prisma.InventoryMovementGetPayload<{ include: { costMovement: true } }>;
function findExisting(
  client: Prisma.TransactionClient | PrismaService,
  operationId: string,
): Promise<ExistingMovement | null> {
  return client.inventoryMovement.findUnique({
    where: { operationId },
    include: { costMovement: true },
  });
}

function replay(
  existing: ExistingMovement,
  command: PreparedInventoryAdministrationCommand,
): InventoryAdministrationResult {
  const cost = existing.costMovement;
  const isWriteOff = existing.type === InventoryMovementType.WRITE_OFF;
  const sameKind =
    command.kind === 'write-off'
      ? isWriteOff &&
        existing.physicalDelta === -command.quantity &&
        existing.administrativeCategory === CATEGORY_TO_PRISMA[command.category]
      : !isWriteOff &&
        existing.resultingPhysicalQuantity === command.observedPhysicalQuantity &&
        existing.expectedPositionVersion === command.expectedPositionVersion &&
        safeNullableNumber(cost?.declaredUnitCostCents) === command.declaredUnitCostCents;
  if (
    !sameKind ||
    cost === null ||
    existing.productId !== command.productId ||
    existing.locationId !== command.locationId ||
    existing.actorId !== command.actorId ||
    existing.reason !== command.reason ||
    existing.operationId === null
  )
    return { ok: false, reason: 'idempotency-conflict' };

  const type =
    existing.type === InventoryMovementType.WRITE_OFF
      ? 'write-off'
      : existing.type === InventoryMovementType.ADJUSTMENT_IN
        ? 'adjustment-in'
        : 'adjustment-out';
  return {
    ok: true,
    movement: {
      movementId: existing.id,
      operationId: existing.operationId,
      productId: existing.productId,
      locationId: existing.locationId,
      type,
      physicalDelta: existing.physicalDelta,
      valueDeltaCents: safeNumber(cost.valueDeltaCents),
      physicalQuantity: existing.resultingPhysicalQuantity,
      reservedQuantity: existing.resultingReservedQuantity,
      reviewQuantity: existing.resultingReviewQuantity,
      availableQuantity:
        existing.resultingPhysicalQuantity -
        existing.resultingReservedQuantity -
        existing.resultingReviewQuantity,
      availableCostQuantity: cost.resultingAvailableQuantity,
      availableCostValueCents: safeNumber(cost.resultingAvailableValueCents),
      actorId: existing.actorId,
      effectiveAt: existing.effectiveAt,
      reason: existing.reason,
      category: command.kind === 'write-off' ? command.category : null,
      declaredUnitCostCents: safeNullableNumber(cost.declaredUnitCostCents),
    },
    replayed: true,
  };
}

function safeNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Cost exceeds JSON safe integer range.');
  return number;
}
function safeNullableNumber(value: bigint | null | undefined): number | null {
  return value == null ? null : safeNumber(value);
}
