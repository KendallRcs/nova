import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  InventoryMovementType,
  Prisma,
  RecordStatus,
} from '../../../../../generated/prisma/client';
import type {
  InventoryBalance,
  InventoryTransferBook,
  InventoryTransferReceipt,
  InventoryTransferResult,
  PreparedInventoryTransfer,
} from '../../../hexagon/application/inventory-transfer-book';
import { InventoryPosition } from '../../../hexagon/domain/inventory-position';

@Injectable()
export class PrismaInventoryTransferBook implements InventoryTransferBook {
  constructor(private readonly prisma: PrismaService) {}

  async transfer(command: PreparedInventoryTransfer): Promise<InventoryTransferResult> {
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
          if (product === null) return { ok: false, reason: 'product-not-found' };
          const locationIds = [command.originLocationId, command.destinationLocationId].sort();
          const locations = await transaction.location.findMany({
            where: { id: { in: locationIds }, status: RecordStatus.ACTIVE },
            select: { id: true },
          });
          if (locations.length !== 2) return { ok: false, reason: 'location-not-found' };

          for (const locationId of locationIds) {
            await transaction.inventoryPosition.upsert({
              where: {
                productId_locationId: { productId: command.productId, locationId },
              },
              create: {
                id: uuidv7(),
                productId: command.productId,
                locationId,
                createdAt: command.effectiveAt,
                updatedAt: command.effectiveAt,
              },
              update: {},
            });
          }

          const rows = await lockPositions(transaction, command.productId, locationIds);
          const originRow = rows.find(({ locationId }) => locationId === command.originLocationId);
          const destinationRow = rows.find(
            ({ locationId }) => locationId === command.destinationLocationId,
          );
          if (originRow === undefined || destinationRow === undefined) {
            return { ok: false, reason: 'concurrency-conflict' };
          }
          const origin = InventoryPosition.restore(originRow);
          const destination = InventoryPosition.restore(destinationRow);
          const changed = InventoryPosition.transferAvailable(
            origin,
            destination,
            command.quantity,
            command.effectiveAt,
          );
          if (!changed.ok) {
            throw new TransferRejected(
              changed.reason === 'insufficient-stock'
                ? {
                    ok: false,
                    reason: changed.reason,
                    ...(changed.availableQuantity === undefined
                      ? {}
                      : { availableQuantity: changed.availableQuantity }),
                  }
                : { ok: false, reason: 'concurrency-conflict' },
            );
          }

          const originAfter = changed.originAfter;
          const destinationAfter = changed.destinationAfter;
          await transaction.inventoryPosition.update({
            where: { id: originAfter.id },
            data: positionUpdate(originAfter),
          });
          await transaction.inventoryPosition.update({
            where: { id: destinationAfter.id },
            data: positionUpdate(destinationAfter),
          });
          await transaction.inventoryTransfer.create({
            data: {
              id: command.transferId,
              operationId: command.operationId,
              productId: command.productId,
              originLocationId: command.originLocationId,
              destinationLocationId: command.destinationLocationId,
              quantity: command.quantity,
              transferredBy: command.actorId,
              effectiveAt: command.effectiveAt,
              movements: {
                create: [
                  movementData(
                    changed.originBefore,
                    originAfter,
                    InventoryMovementType.TRANSFER_OUT,
                    command,
                  ),
                  movementData(
                    changed.destinationBefore,
                    destinationAfter,
                    InventoryMovementType.TRANSFER_IN,
                    command,
                  ),
                ],
              },
            },
          });
          return {
            ok: true,
            transfer: receipt(command, originAfter, destinationAfter),
            replayed: false,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof TransferRejected) return error.result;
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

type RejectedInventoryTransfer = Exclude<InventoryTransferResult, { ok: true }>;

class TransferRejected extends Error {
  constructor(readonly result: RejectedInventoryTransfer) {
    super(result.reason);
    this.name = 'TransferRejected';
  }
}

interface LockedPositionRow {
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

function lockPositions(
  transaction: Prisma.TransactionClient,
  productId: string,
  locationIds: readonly string[],
): Promise<LockedPositionRow[]> {
  return transaction.$queryRaw<LockedPositionRow[]>(Prisma.sql`
    SELECT
      "id", "product_id" AS "productId", "location_id" AS "locationId",
      "physical_quantity" AS "physicalQuantity",
      "reserved_quantity" AS "reservedQuantity",
      "review_quantity" AS "reviewQuantity", "version",
      "created_at" AS "createdAt", "updated_at" AS "updatedAt"
    FROM "inventory_positions"
    WHERE "product_id" = ${productId}::uuid
      AND "location_id" IN (${Prisma.join(locationIds)})
    ORDER BY "product_id", "location_id"
    FOR UPDATE
  `);
}

function positionUpdate(position: ReturnType<InventoryPosition['snapshot']>) {
  return {
    physicalQuantity: position.physicalQuantity,
    reservedQuantity: position.reservedQuantity,
    reviewQuantity: position.reviewQuantity,
    version: position.version,
    updatedAt: position.updatedAt,
  };
}

function movementData(
  before: ReturnType<InventoryPosition['snapshot']>,
  after: ReturnType<InventoryPosition['snapshot']>,
  type: InventoryMovementType,
  command: PreparedInventoryTransfer,
) {
  return {
    id: uuidv7(),
    productId: command.productId,
    locationId: after.locationId,
    type,
    physicalDelta: after.physicalQuantity - before.physicalQuantity,
    reservedDelta: after.reservedQuantity - before.reservedQuantity,
    reviewDelta: after.reviewQuantity - before.reviewQuantity,
    previousPhysicalQuantity: before.physicalQuantity,
    resultingPhysicalQuantity: after.physicalQuantity,
    previousReservedQuantity: before.reservedQuantity,
    resultingReservedQuantity: after.reservedQuantity,
    previousReviewQuantity: before.reviewQuantity,
    resultingReviewQuantity: after.reviewQuantity,
    actorId: command.actorId,
    effectiveAt: command.effectiveAt,
  };
}

type ExistingTransfer = Prisma.InventoryTransferGetPayload<{ include: { movements: true } }>;

function findExisting(
  client: Prisma.TransactionClient | PrismaService,
  operationId: string,
): Promise<ExistingTransfer | null> {
  return client.inventoryTransfer.findUnique({
    where: { operationId },
    include: { movements: true },
  });
}

function replay(
  existing: ExistingTransfer,
  command: PreparedInventoryTransfer,
): InventoryTransferResult {
  if (
    existing.productId !== command.productId ||
    existing.originLocationId !== command.originLocationId ||
    existing.destinationLocationId !== command.destinationLocationId ||
    existing.quantity !== command.quantity ||
    existing.transferredBy !== command.actorId
  ) {
    return { ok: false, reason: 'idempotency-conflict' };
  }
  const origin = existing.movements.find(
    (movement) => movement.type === InventoryMovementType.TRANSFER_OUT,
  );
  const destination = existing.movements.find(
    (movement) => movement.type === InventoryMovementType.TRANSFER_IN,
  );
  if (origin === undefined || destination === undefined) {
    throw new Error('A confirmed inventory transfer must have two movements.');
  }
  return {
    ok: true,
    transfer: {
      transferId: existing.id,
      operationId: existing.operationId,
      productId: existing.productId,
      originLocationId: existing.originLocationId,
      destinationLocationId: existing.destinationLocationId,
      quantity: existing.quantity,
      actorId: existing.transferredBy,
      effectiveAt: existing.effectiveAt,
      origin: movementBalance(origin),
      destination: movementBalance(destination),
    },
    replayed: true,
  };
}

function receipt(
  command: PreparedInventoryTransfer,
  origin: ReturnType<InventoryPosition['snapshot']>,
  destination: ReturnType<InventoryPosition['snapshot']>,
): InventoryTransferReceipt {
  return {
    ...command,
    origin: balance(origin),
    destination: balance(destination),
  };
}

function balance(position: ReturnType<InventoryPosition['snapshot']>): InventoryBalance {
  return {
    locationId: position.locationId,
    physicalQuantity: position.physicalQuantity,
    reservedQuantity: position.reservedQuantity,
    reviewQuantity: position.reviewQuantity,
    availableQuantity: position.availableQuantity,
  };
}

function movementBalance(movement: ExistingTransfer['movements'][number]): InventoryBalance {
  return {
    locationId: movement.locationId,
    physicalQuantity: movement.resultingPhysicalQuantity,
    reservedQuantity: movement.resultingReservedQuantity,
    reviewQuantity: movement.resultingReviewQuantity,
    availableQuantity:
      movement.resultingPhysicalQuantity -
      movement.resultingReservedQuantity -
      movement.resultingReviewQuantity,
  };
}
