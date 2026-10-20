import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  InventoryAdministrativeCategory,
  InventoryMovementType,
  LocationType,
  Prisma,
} from '../../../../../generated/prisma/client';
import type {
  InventoryMovementCategory,
  InventoryMovementKind,
  InventoryMovementRecord,
  InventoryMovementSource,
} from '../../../hexagon/application/inventory-movement-history';

@Injectable()
export class PrismaInventoryMovementSource implements InventoryMovementSource {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    input: Parameters<InventoryMovementSource['list']>[0],
  ): ReturnType<InventoryMovementSource['list']> {
    const rows = await this.prisma.inventoryMovement.findMany({
      where: {
        ...(input.productId === undefined ? {} : { productId: input.productId }),
        ...(input.locationId === undefined ? {} : { locationId: input.locationId }),
        ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
        ...(input.type === undefined ? {} : { type: toPrismaType(input.type) }),
      },
      orderBy: [{ effectiveAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.afterMovementId === undefined
        ? {}
        : { cursor: { id: input.afterMovementId }, skip: 1 }),
      include: {
        product: { select: { code: true, name: true } },
        location: { select: { code: true, name: true, type: true } },
        actor: { select: { usernameNormalized: true } },
        saleLine: { select: { saleId: true } },
        returnLine: { select: { returnId: true, saleLine: { select: { saleId: true } } } },
        cancellationLine: {
          select: { cancellationId: true, saleLine: { select: { saleId: true } } },
        },
        deliveryLine: { select: { deliveryId: true, saleLine: { select: { saleId: true } } } },
        purchaseLine: { select: { purchaseId: true } },
      },
    });
    const hasNextPage = rows.length > input.limit;
    const pageRows = rows.slice(0, input.limit);
    return {
      items: pageRows.map(toRecord),
      nextMovementId: hasNextPage ? (pageRows.at(-1)?.id ?? null) : null,
    };
  }
}

type MovementRow = Prisma.InventoryMovementGetPayload<{
  include: {
    product: { select: { code: true; name: true } };
    location: { select: { code: true; name: true; type: true } };
    actor: { select: { usernameNormalized: true } };
    saleLine: { select: { saleId: true } };
    returnLine: { select: { returnId: true; saleLine: { select: { saleId: true } } } };
    cancellationLine: {
      select: { cancellationId: true; saleLine: { select: { saleId: true } } };
    };
    deliveryLine: {
      select: { deliveryId: true; saleLine: { select: { saleId: true } } };
    };
    purchaseLine: { select: { purchaseId: true } };
  };
}>;

function toRecord(row: MovementRow): InventoryMovementRecord {
  return {
    id: row.id,
    product: { id: row.productId, currentCode: row.product.code, currentName: row.product.name },
    location: {
      id: row.locationId,
      code: row.location.code,
      name: row.location.name,
      type: row.location.type === LocationType.STORE ? 'store' : 'warehouse',
    },
    type: fromPrismaType(row.type),
    physicalDelta: row.physicalDelta,
    reservedDelta: row.reservedDelta,
    reviewDelta: row.reviewDelta,
    previous: {
      physicalQuantity: row.previousPhysicalQuantity,
      reservedQuantity: row.previousReservedQuantity,
      reviewQuantity: row.previousReviewQuantity,
    },
    resulting: {
      physicalQuantity: row.resultingPhysicalQuantity,
      reservedQuantity: row.resultingReservedQuantity,
      reviewQuantity: row.resultingReviewQuantity,
    },
    actor: { id: row.actorId, username: row.actor.usernameNormalized },
    effectiveAt: row.effectiveAt,
    reason: row.reason,
    administrativeCategory:
      row.administrativeCategory === null ? null : fromPrismaCategory(row.administrativeCategory),
    references: {
      operationId: row.operationId,
      transferId: row.transferId,
      saleId:
        row.saleLine?.saleId ??
        row.returnLine?.saleLine.saleId ??
        row.cancellationLine?.saleLine.saleId ??
        row.deliveryLine?.saleLine.saleId ??
        null,
      saleLineId: row.saleLineId,
      returnId: row.returnLine?.returnId ?? null,
      returnLineId: row.returnLineId,
      cancellationId: row.cancellationLine?.cancellationId ?? null,
      cancellationLineId: row.cancellationLineId,
      deliveryId: row.deliveryLine?.deliveryId ?? null,
      deliveryLineId: row.deliveryLineId,
      purchaseId: row.purchaseLine?.purchaseId ?? null,
      purchaseLineId: row.purchaseLineId,
      initialImportId: row.initialImportId,
    },
  };
}

function toPrismaType(type: InventoryMovementKind): InventoryMovementType {
  const value = TYPE_TO_PRISMA[type];
  return value;
}

function fromPrismaType(type: InventoryMovementType): InventoryMovementKind {
  return PRISMA_TO_TYPE[type];
}

const TYPE_TO_PRISMA: Record<InventoryMovementKind, InventoryMovementType> = {
  opening: InventoryMovementType.OPENING,
  'purchase-in': InventoryMovementType.PURCHASE_IN,
  reservation: InventoryMovementType.RESERVATION,
  release: InventoryMovementType.RELEASE,
  delivery: InventoryMovementType.DELIVERY,
  'return-review': InventoryMovementType.RETURN_REVIEW,
  'return-available': InventoryMovementType.RETURN_AVAILABLE,
  'transfer-out': InventoryMovementType.TRANSFER_OUT,
  'transfer-in': InventoryMovementType.TRANSFER_IN,
  'write-off': InventoryMovementType.WRITE_OFF,
  'adjustment-in': InventoryMovementType.ADJUSTMENT_IN,
  'adjustment-out': InventoryMovementType.ADJUSTMENT_OUT,
};

const PRISMA_TO_TYPE: Record<InventoryMovementType, InventoryMovementKind> = Object.fromEntries(
  Object.entries(TYPE_TO_PRISMA).map(([key, value]) => [value, key]),
) as Record<InventoryMovementType, InventoryMovementKind>;

function fromPrismaCategory(category: InventoryAdministrativeCategory): InventoryMovementCategory {
  if (category === InventoryAdministrativeCategory.DAMAGED) return 'damaged';
  if (category === InventoryAdministrativeCategory.LOST) return 'lost';
  if (category === InventoryAdministrativeCategory.DEFECTIVE) return 'defective';
  return 'other';
}
