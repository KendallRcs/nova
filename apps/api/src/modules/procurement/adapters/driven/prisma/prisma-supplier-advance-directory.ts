import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { PaymentMethod, SupplierAdvanceStatus } from '../../../../../generated/prisma/client';
import type {
  SupplierAdvanceDirectory,
  SupplierAdvanceListItem,
} from '../../../hexagon/application/list-supplier-advances';

@Injectable()
export class PrismaSupplierAdvanceDirectory implements SupplierAdvanceDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    filter: Parameters<SupplierAdvanceDirectory['list']>[0],
  ): Promise<readonly SupplierAdvanceListItem[]> {
    const rows = await this.prisma.supplierAdvance.findMany({
      where: {
        ...(filter.supplierId === undefined ? {} : { supplierId: filter.supplierId }),
        ...(filter.status === undefined
          ? {}
          : {
              status:
                filter.status === 'pending'
                  ? SupplierAdvanceStatus.PENDING
                  : SupplierAdvanceStatus.RESOLVED,
            }),
      },
      include: { supplier: { select: { name: true } } },
      orderBy: [{ effectiveAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      supplierId: row.supplierId,
      supplierName: row.supplier.name,
      originalAmountCents: safeNumber(row.originalAmountCents),
      currentBalanceCents: safeNumber(row.currentBalanceCents),
      method: fromPrismaMethod(row.method),
      purpose: row.purpose,
      status: row.status === SupplierAdvanceStatus.PENDING ? 'pending' : 'resolved',
      version: row.version,
      registeredBy: row.registeredBy,
      effectiveAt: row.effectiveAt,
    }));
  }
}

function fromPrismaMethod(method: PaymentMethod): SupplierAdvanceListItem['method'] {
  return method === PaymentMethod.CASH
    ? 'cash'
    : method === PaymentMethod.YAPE
      ? 'yape'
      : method === PaymentMethod.PLIN
        ? 'plin'
        : 'pos';
}

function safeNumber(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Amount exceeds JSON safe integer range.');
  return result;
}
