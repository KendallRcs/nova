import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SaleLifecycleStatus,
} from '../../../../../generated/prisma/client';
import type {
  SaleActivityRecord,
  SaleActivitySource,
} from '../../../hexagon/application/sale-activity';
import type { SaleLifecycle } from '../../../hexagon/domain/sale';
import type { SaleDetailRecord, SaleDetailSource } from '../../../hexagon/application/sale-detail';
import { safeSaleNumber, safeSignedSaleNumber } from './prisma-sale-draft.repository';

@Injectable()
export class PrismaSaleActivitySource implements SaleActivitySource, SaleDetailSource {
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
        payments: {
          select: { amountCents: true, corrections: { select: { amountCents: true } } },
        },
        closure: { select: { forgivenAmountCents: true } },
        lines: { select: { quantity: true, deliveryQuantity: true } },
      },
    });
    return rows.map(toRecord);
  }

  async findById(saleId: string): Promise<SaleDetailRecord | null> {
    const row = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        creator: { select: { usernameNormalized: true } },
        customer: {
          include: {
            mergedInto: { select: { id: true, name: true, phoneNormalized: true } },
          },
        },
        lines: {
          include: {
            location: { select: { code: true, name: true } },
            inventoryReservations: { select: { activeQuantity: true } },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
        payments: {
          include: {
            registrar: { select: { usernameNormalized: true } },
            corrections: {
              include: { actor: { select: { usernameNormalized: true } } },
              orderBy: [{ effectiveAt: 'asc' }, { id: 'asc' }],
            },
          },
          orderBy: [{ effectiveAt: 'asc' }, { id: 'asc' }],
        },
        totalAdjustments: {
          include: { actor: { select: { usernameNormalized: true } } },
          orderBy: [{ effectiveAt: 'asc' }, { id: 'asc' }],
        },
        closure: { include: { actor: { select: { usernameNormalized: true } } } },
      },
    });
    return row === null ? null : toDetailRecord(row);
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

type DetailRow = Prisma.SaleGetPayload<{
  include: {
    creator: { select: { usernameNormalized: true } };
    customer: {
      include: { mergedInto: { select: { id: true; name: true; phoneNormalized: true } } };
    };
    lines: {
      include: {
        location: { select: { code: true; name: true } };
        inventoryReservations: { select: { activeQuantity: true } };
      };
    };
    payments: {
      include: {
        registrar: { select: { usernameNormalized: true } };
        corrections: { include: { actor: { select: { usernameNormalized: true } } } };
      };
    };
    totalAdjustments: { include: { actor: { select: { usernameNormalized: true } } } };
    closure: { include: { actor: { select: { usernameNormalized: true } } } };
  };
}>;

function toDetailRecord(row: DetailRow): SaleDetailRecord {
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
    paymentAgreementNote: row.paymentAgreementNote,
    paymentAmountsCents: row.payments.map(
      ({ amountCents, corrections }) =>
        safeSaleNumber(amountCents) -
        corrections.reduce((sum, correction) => sum + safeSaleNumber(correction.amountCents), 0),
    ),
    forgivenAmountCents: row.closure === null ? 0 : safeSaleNumber(row.closure.forgivenAmountCents),
    lines: row.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      locationId: line.locationId,
      locationCode: line.location.code,
      locationName: line.location.name,
      quantity: line.quantity,
      deliveryQuantity: line.deliveryQuantity,
      reservationQuantity: line.reservationQuantity,
      activeReservationQuantity: line.inventoryReservations.reduce(
        (sum, reservation) => sum + reservation.activeQuantity,
        0,
      ),
      agreedUnitPriceCents: safeSaleNumber(line.agreedUnitPriceCents),
      originalSubtotalCents: safeSaleNumber(line.originalSubtotalCents),
      snapshot:
        line.snapshotCode === null ||
        line.snapshotName === null ||
        line.snapshotMinimumPriceCents === null
          ? null
          : {
              code: line.snapshotCode,
              name: line.snapshotName,
              minimumPriceCents: safeSaleNumber(line.snapshotMinimumPriceCents),
              suggestedPriceCents:
                line.snapshotSuggestedPriceCents === null
                  ? null
                  : safeSaleNumber(line.snapshotSuggestedPriceCents),
              maximumPriceCents:
                line.snapshotMaximumPriceCents === null
                  ? null
                  : safeSaleNumber(line.snapshotMaximumPriceCents),
            },
      priceExceptionReason: line.priceExceptionReason,
      priceApprovedBy: line.priceApprovedBy,
      allocatedCostCents:
        line.allocatedCostCents === null ? null : safeSaleNumber(line.allocatedCostCents),
    })),
    payments: row.payments.map((payment) => ({
      id: payment.id,
      amountCents: safeSaleNumber(payment.amountCents),
      correctedCents: payment.corrections.reduce(
        (sum, correction) => sum + safeSaleNumber(correction.amountCents),
        0,
      ),
      netAmountCents:
        safeSaleNumber(payment.amountCents) -
        payment.corrections.reduce(
          (sum, correction) => sum + safeSaleNumber(correction.amountCents),
          0,
        ),
      method: fromPrismaPaymentMethod(payment.method),
      status:
        payment.status === PaymentStatus.CONFIRMED
          ? 'confirmed'
          : payment.status === PaymentStatus.PARTIALLY_CORRECTED
            ? 'partially-corrected'
            : 'corrected',
      registeredBy: payment.registeredBy,
      registrarUsername: payment.registrar.usernameNormalized,
      effectiveAt: payment.effectiveAt,
      corrections: payment.corrections.map((correction) => ({
        id: correction.id,
        amountCents: safeSaleNumber(correction.amountCents),
        reason: correction.reason,
        correctedBy: correction.correctedBy,
        actorUsername: correction.actor.usernameNormalized,
        effectiveAt: correction.effectiveAt,
      })),
    })),
    totalAdjustments: row.totalAdjustments.map((adjustment) => ({
      id: adjustment.id,
      previousTotalCents: safeSaleNumber(adjustment.previousTotalCents),
      newTotalCents: safeSaleNumber(adjustment.newTotalCents),
      differenceCents: safeSignedSaleNumber(adjustment.differenceCents),
      reason: adjustment.reason,
      changedBy: adjustment.changedBy,
      actorUsername: adjustment.actor.usernameNormalized,
      effectiveAt: adjustment.effectiveAt,
    })),
    closure:
      row.closure === null
        ? null
        : {
            id: row.closure.id,
            type: row.closure.type === 'COMPLETE' ? 'complete' : 'incomplete',
            forgivenAmountCents: safeSaleNumber(row.closure.forgivenAmountCents),
            reason: row.closure.reason,
            closedBy: row.closure.closedBy,
            actorUsername: row.closure.actor.usernameNormalized,
            effectiveAt: row.closure.effectiveAt,
          },
    version: row.version,
    confirmedAt: row.confirmedAt,
    finalizedAt: row.finalizedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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

type ActivityRow = Prisma.SaleGetPayload<{
  include: {
    creator: { select: { usernameNormalized: true } };
    customer: {
      include: { mergedInto: { select: { id: true; name: true; phoneNormalized: true } } };
    };
    payments: {
      select: { amountCents: true; corrections: { select: { amountCents: true } } };
    };
    closure: { select: { forgivenAmountCents: true } };
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
    paymentAmountsCents: row.payments.map(
      ({ amountCents, corrections }) =>
        safeSaleNumber(amountCents) -
        corrections.reduce((sum, correction) => sum + safeSaleNumber(correction.amountCents), 0),
    ),
    forgivenAmountCents: row.closure === null ? 0 : safeSaleNumber(row.closure.forgivenAmountCents),
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
