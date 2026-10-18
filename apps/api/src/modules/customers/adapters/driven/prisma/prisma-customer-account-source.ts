import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { PaymentMethod, Prisma, SaleLifecycleStatus } from '../../../../../generated/prisma/client';
import type {
  CustomerAccountRecord,
  CustomerAccountSource,
} from '../../../hexagon/application/customer-account';

@Injectable()
export class PrismaCustomerAccountSource implements CustomerAccountSource {
  constructor(private readonly prisma: PrismaService) {}

  async findByCustomerId(customerId: string): Promise<CustomerAccountRecord | null> {
    const requested = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, mergedIntoCustomerId: true },
    });
    if (requested === null) return null;
    const canonicalId = requested.mergedIntoCustomerId ?? requested.id;
    const canonical = await this.prisma.customer.findUnique({
      where: { id: canonicalId },
      select: { id: true, name: true, phoneNormalized: true, dni: true, address: true },
    });
    if (canonical === null) return null;
    const identities = await this.prisma.customer.findMany({
      where: { OR: [{ id: canonicalId }, { mergedIntoCustomerId: canonicalId }] },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const identityIds = identities.map(({ id }) => id);
    const sales = await this.prisma.sale.findMany({
      where: {
        customerId: { in: identityIds },
        lifecycleStatus: { not: SaleLifecycleStatus.DRAFT },
      },
      include: {
        creator: { select: { usernameNormalized: true } },
        payments: {
          include: {
            registrar: { select: { usernameNormalized: true } },
            corrections: { select: { amountCents: true } },
          },
          orderBy: [{ effectiveAt: 'asc' }, { id: 'asc' }],
        },
        returns: { select: { refundAmountCents: true } },
        cancellation: { select: { refundAmountCents: true } },
        closure: { select: { forgivenAmountCents: true } },
        lines: { select: { quantity: true, deliveryQuantity: true } },
      },
      orderBy: [{ confirmedAt: 'desc' }, { id: 'desc' }],
    });
    return {
      customer: {
        id: canonical.id,
        name: canonical.name,
        phone: canonical.phoneNormalized,
        dni: canonical.dni,
        address: canonical.address,
        mergedCustomerIds: identityIds.filter((id) => id !== canonical.id),
      },
      sales: sales.map(toSaleRecord),
    };
  }
}

type SaleRow = Prisma.SaleGetPayload<{
  include: {
    creator: { select: { usernameNormalized: true } };
    payments: {
      include: {
        registrar: { select: { usernameNormalized: true } };
        corrections: { select: { amountCents: true } };
      };
    };
    returns: { select: { refundAmountCents: true } };
    cancellation: { select: { refundAmountCents: true } };
    closure: { select: { forgivenAmountCents: true } };
    lines: { select: { quantity: true; deliveryQuantity: true } };
  };
}>;

function toSaleRecord(row: SaleRow): CustomerAccountRecord['sales'][number] {
  if (row.confirmedAt === null) throw new Error('A non-draft sale must have a confirmation date.');
  const payments = row.payments.map((payment) => {
    const amountCents = safeNumber(payment.amountCents);
    const correctedCents = payment.corrections.reduce(
      (sum, correction) => sum + safeNumber(correction.amountCents),
      0,
    );
    return {
      id: payment.id,
      amountCents,
      correctedCents,
      netAmountCents: amountCents - correctedCents,
      method: fromPrismaPaymentMethod(payment.method),
      registeredBy: payment.registeredBy,
      registrarUsername: payment.registrar.usernameNormalized,
      effectiveAt: payment.effectiveAt,
    };
  });
  return {
    id: row.id,
    createdBy: row.createdBy,
    creatorUsername: row.creator.usernameNormalized,
    lifecycle: fromPrismaLifecycle(row.lifecycleStatus),
    originalTotalCents: safeNumber(row.originalTotalCents),
    currentTotalCents: safeNumber(row.currentTotalCents),
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    paymentAmountsCents: payments.map(({ netAmountCents }) => netAmountCents),
    refundAmountsCents: row.returns
      .map(({ refundAmountCents }) => safeNumber(refundAmountCents))
      .concat(row.cancellation === null ? [] : [safeNumber(row.cancellation.refundAmountCents)]),
    forgivenAmountCents: row.closure === null ? 0 : safeNumber(row.closure.forgivenAmountCents),
    lines: row.lines.map(({ quantity, deliveryQuantity }) => ({
      quantity,
      deliveredQuantity: deliveryQuantity,
    })),
    payments,
    confirmedAt: row.confirmedAt,
    finalizedAt: row.finalizedAt,
    cancelledAt: row.cancelledAt,
  };
}

function safeNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error('Customer account monetary value is outside the safe range.');
  }
  return number;
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

function fromPrismaLifecycle(
  lifecycle: SaleLifecycleStatus,
): 'confirmed' | 'finalized' | 'cancelled' {
  if (lifecycle === SaleLifecycleStatus.DRAFT) {
    throw new Error('Customer accounts cannot expose draft sales.');
  }
  return lifecycle === SaleLifecycleStatus.CONFIRMED
    ? 'confirmed'
    : lifecycle === SaleLifecycleStatus.FINALIZED
      ? 'finalized'
      : 'cancelled';
}
