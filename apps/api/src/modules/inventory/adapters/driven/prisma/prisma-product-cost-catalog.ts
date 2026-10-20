import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { CostingPolicy, Prisma, RecordStatus } from '../../../../../generated/prisma/client';
import type {
  ProductCostCatalog,
  ProductCostRecord,
} from '../../../hexagon/application/product-cost-catalog';

@Injectable()
export class PrismaProductCostCatalog implements ProductCostCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async list(query?: string): Promise<readonly ProductCostRecord[]> {
    const normalizedQuery = normalizeQuery(query);
    const rows = await this.prisma.product.findMany({
      ...(normalizedQuery === null
        ? {}
        : {
            where: {
              OR: [
                { codeNormalized: { contains: normalizedQuery } },
                { searchName: { contains: normalizedQuery } },
              ],
            },
          }),
      orderBy: [{ searchName: 'asc' }, { id: 'asc' }],
      include: {
        costPosition: true,
        purchaseLines: {
          orderBy: [{ purchase: { effectiveAt: 'desc' } }, { id: 'desc' }],
          take: 1,
          select: {
            unitCostCents: true,
            purchase: { select: { effectiveAt: true } },
          },
        },
      },
    });
    return rows.map(toRecord);
  }
}

type CostRow = Prisma.ProductGetPayload<{
  include: {
    costPosition: true;
    purchaseLines: {
      orderBy: [{ purchase: { effectiveAt: 'desc' } }, { id: 'desc' }];
      take: 1;
      select: {
        unitCostCents: true;
        purchase: { select: { effectiveAt: true } };
      };
    };
  };
}>;

function toRecord(row: CostRow): ProductCostRecord {
  const position = row.costPosition;
  const latestPurchase = row.purchaseLines[0];
  return {
    productId: row.id,
    code: row.code,
    name: row.name,
    isActive: row.status === RecordStatus.ACTIVE,
    minimumPriceCents: safeNumber(row.minimumPriceCents),
    suggestedPriceCents:
      row.suggestedPriceCents === null ? null : safeNumber(row.suggestedPriceCents),
    maximumPriceCents: row.maximumPriceCents === null ? null : safeNumber(row.maximumPriceCents),
    availableQuantity: position?.availableQuantity ?? 0,
    availableValueCents: safeNumber(position?.availableValueCents ?? 0n),
    reservedQuantity: position?.reservedQuantity ?? 0,
    reservedValueCents: safeNumber(position?.reservedValueCents ?? 0n),
    reviewQuantity: position?.reviewQuantity ?? 0,
    reviewValueCents: safeNumber(position?.reviewValueCents ?? 0n),
    lastPurchaseUnitCostCents:
      latestPurchase === undefined ? null : safeNumber(latestPurchase.unitCostCents),
    lastPurchasedAt: latestPurchase?.purchase.effectiveAt ?? null,
    policy: position?.policy === CostingPolicy.MOVING_AVERAGE_V1 ? 'moving-average-v1' : null,
    version: position?.version ?? null,
  };
}

function normalizeQuery(value: string | undefined): string | null {
  const normalized = value?.trim().normalize('NFKC').toLocaleLowerCase('es-PE');
  return normalized === undefined || normalized.length === 0 ? null : normalized;
}

function safeNumber(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Amount exceeds JSON safe integer range.');
  return result;
}
