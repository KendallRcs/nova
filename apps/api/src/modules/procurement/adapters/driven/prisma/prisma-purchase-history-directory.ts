import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { PaymentMethod, Prisma, SupplierKind } from '../../../../../generated/prisma/client';
import type {
  PurchaseDetail,
  PurchaseHistoryDirectory,
  PurchaseHistoryItem,
  PurchaseHistoryPage,
} from '../../../hexagon/application/purchase-history';
import type { ProcurementPaymentMethod } from '../../../hexagon/domain/supplier-advance';

@Injectable()
export class PrismaPurchaseHistoryDirectory implements PurchaseHistoryDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: Parameters<PurchaseHistoryDirectory['list']>[0]): Promise<PurchaseHistoryPage> {
    const rows = await this.prisma.purchase.findMany({
      where: {
        ...(input.supplierId === undefined ? {} : { supplierId: input.supplierId }),
        ...(input.productId === undefined
          ? {}
          : { lines: { some: { productId: input.productId } } }),
      },
      orderBy: [{ effectiveAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.afterPurchaseId === undefined
        ? {}
        : { cursor: { id: input.afterPurchaseId }, skip: 1 }),
      include: {
        supplier: { select: { name: true, kind: true } },
        confirmer: { select: { usernameNormalized: true } },
        lines: { select: { quantity: true } },
      },
    });
    const hasNextPage = rows.length > input.limit;
    const pageRows = rows.slice(0, input.limit);
    return {
      items: pageRows.map(toHistoryItem),
      nextPurchaseId: hasNextPage ? (pageRows.at(-1)?.id ?? null) : null,
    };
  }

  async findById(purchaseId: string): Promise<PurchaseDetail | null> {
    const row = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        supplier: { select: { name: true, kind: true } },
        creator: { select: { usernameNormalized: true } },
        confirmer: { select: { usernameNormalized: true } },
        lines: {
          include: {
            product: { select: { code: true, name: true } },
            destinationLocation: { select: { code: true, name: true } },
          },
          orderBy: [{ id: 'asc' }],
        },
        advanceApplications: { orderBy: [{ effectiveAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (row === null) return null;
    const history = toHistoryItem(row);
    return {
      ...history,
      operationId: row.operationId,
      createdBy: row.createdBy,
      creatorUsername: row.creator.usernameNormalized,
      createdAt: row.createdAt,
      lines: row.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        currentProductCode: line.product.code,
        currentProductName: line.product.name,
        destinationLocationId: line.destinationLocationId,
        destinationLocationCode: line.destinationLocation.code,
        destinationLocationName: line.destinationLocation.name,
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
      advanceApplications: row.advanceApplications.map((application) => ({
        id: application.id,
        advanceId: application.advanceId,
        amountCents: safeNumber(application.amountCents),
        resultingBalanceCents: safeNumber(application.resultingBalanceCents),
        resultingAdvanceVersion: application.resultingAdvanceVersion,
      })),
    };
  }
}

type HistoryRow = Prisma.PurchaseGetPayload<{
  include: {
    supplier: { select: { name: true; kind: true } };
    confirmer: { select: { usernameNormalized: true } };
    lines: { select: { quantity: true } };
  };
}>;

function toHistoryItem(row: HistoryRow): PurchaseHistoryItem {
  return {
    id: row.id,
    supplier: {
      id: row.supplierId,
      name: row.supplier.name,
      kind: row.supplier.kind === SupplierKind.REGISTERED ? 'registered' : 'occasional',
    },
    totalCents: safeNumber(row.totalCents),
    advanceAppliedCents: safeNumber(row.advanceAppliedCents),
    newlyPaidCents: safeNumber(row.newlyPaidCents),
    paymentMethod: row.paymentMethod === null ? null : fromPrismaMethod(row.paymentMethod),
    lineCount: row.lines.length,
    totalQuantity: row.lines.reduce((sum, line) => sum + line.quantity, 0),
    confirmedBy: row.confirmedBy,
    confirmerUsername: row.confirmer.usernameNormalized,
    effectiveAt: row.effectiveAt,
  };
}

function fromPrismaMethod(method: PaymentMethod): ProcurementPaymentMethod {
  if (method === PaymentMethod.CASH) return 'cash';
  if (method === PaymentMethod.YAPE) return 'yape';
  if (method === PaymentMethod.PLIN) return 'plin';
  return 'pos';
}

function safeNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Purchase amount exceeds safe integer range.');
  return number;
}
