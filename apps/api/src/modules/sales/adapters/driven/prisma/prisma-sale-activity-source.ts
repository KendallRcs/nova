import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { Prisma, SaleLifecycleStatus } from '../../../../../generated/prisma/client';
import type {
  SaleActivityRecord,
  SaleActivitySource,
} from '../../../hexagon/application/sale-activity';
import type { SaleLifecycle } from '../../../hexagon/domain/sale';
import { safeSaleNumber } from './prisma-sale-draft.repository';

@Injectable()
export class PrismaSaleActivitySource implements SaleActivitySource {
  constructor(private readonly prisma: PrismaService) {}

  async find(input: Parameters<SaleActivitySource['find']>[0]): Promise<SaleActivityRecord[]> {
    const canonicalCustomerId = await this.canonicalCustomerId(input.customerId);
    const where: Prisma.SaleWhereInput = {
      ...(input.createdBy === undefined ? {} : { createdBy: input.createdBy }),
      ...(input.lifecycle === undefined
        ? {}
        : { lifecycleStatus: toPrismaLifecycle(input.lifecycle) }),
      ...(input.customerId === undefined
        ? {}
        : canonicalCustomerId === null
          ? { id: { equals: '00000000-0000-0000-0000-000000000000' } }
          : {
              OR: [
                { customerId: canonicalCustomerId },
                { customer: { is: { mergedIntoCustomerId: canonicalCustomerId } } },
              ],
            }),
    };
    const rows = await this.prisma.sale.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: {
        creator: { select: { usernameNormalized: true } },
        customer: {
          include: {
            mergedInto: { select: { id: true, name: true, phoneNormalized: true } },
          },
        },
        payments: { select: { amountCents: true } },
        lines: { select: { quantity: true, deliveryQuantity: true } },
      },
    });
    return rows.map(toRecord);
  }

  private async canonicalCustomerId(customerId: string | undefined): Promise<string | null> {
    if (customerId === undefined) return null;
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, mergedIntoCustomerId: true },
    });
    return customer === null ? null : (customer.mergedIntoCustomerId ?? customer.id);
  }
}

type ActivityRow = Prisma.SaleGetPayload<{
  include: {
    creator: { select: { usernameNormalized: true } };
    customer: {
      include: { mergedInto: { select: { id: true; name: true; phoneNormalized: true } } };
    };
    payments: { select: { amountCents: true } };
    lines: { select: { quantity: true; deliveryQuantity: true } };
  };
}>;

function toRecord(row: ActivityRow): SaleActivityRecord {
  const canonicalCustomer = row.customer?.mergedInto ?? row.customer;
  return {
    id: row.id,
    createdBy: row.createdBy,
    creatorUsername: row.creator.usernameNormalized,
    customer:
      row.customer === null || canonicalCustomer === null
        ? null
        : {
            historicalId: row.customer.id,
            canonicalId: canonicalCustomer.id,
            name: canonicalCustomer.name,
            phone: canonicalCustomer.phoneNormalized,
          },
    lifecycle: fromPrismaLifecycle(row.lifecycleStatus),
    originalTotalCents: safeSaleNumber(row.originalTotalCents),
    currentTotalCents: safeSaleNumber(row.currentTotalCents),
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    paymentAmountsCents: row.payments.map(({ amountCents }) => safeSaleNumber(amountCents)),
    lines: row.lines.map(({ quantity, deliveryQuantity }) => ({
      quantity,
      deliveredQuantity: deliveryQuantity,
    })),
    version: row.version,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPrismaLifecycle(lifecycle: SaleLifecycle): SaleLifecycleStatus {
  return lifecycle === 'draft'
    ? SaleLifecycleStatus.DRAFT
    : lifecycle === 'confirmed'
      ? SaleLifecycleStatus.CONFIRMED
      : lifecycle === 'finalized'
        ? SaleLifecycleStatus.FINALIZED
        : SaleLifecycleStatus.CANCELLED;
}

function fromPrismaLifecycle(lifecycle: SaleLifecycleStatus): SaleLifecycle {
  return lifecycle === SaleLifecycleStatus.DRAFT
    ? 'draft'
    : lifecycle === SaleLifecycleStatus.CONFIRMED
      ? 'confirmed'
      : lifecycle === SaleLifecycleStatus.FINALIZED
        ? 'finalized'
        : 'cancelled';
}
