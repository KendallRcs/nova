import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { PaymentMethod, Prisma, SaleLifecycleStatus } from '../../../../../generated/prisma/client';
import type { SaleDraftRepository } from '../../../hexagon/application/sale-draft.repository';
import { Sale } from '../../../hexagon/domain/sale';

@Injectable()
export class PrismaSaleDraftRepository implements SaleDraftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Sale | null> {
    const row = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        lines: true,
        payments: { include: { corrections: true } },
        totalAdjustments: true,
        closure: true,
        returns: { include: { lines: true, refund: true } },
        cancellation: { include: { lines: true, refund: true } },
      },
    });
    return row === null ? null : toSaleDomain(row);
  }

  async create(sale: Sale): Promise<void> {
    const values = sale.toPrimitives();
    await this.prisma.sale.create({
      data: {
        id: values.id,
        createdBy: values.createdBy,
        customerId: values.customerId,
        lifecycleStatus: SaleLifecycleStatus.DRAFT,
        originalTotalCents: BigInt(values.originalTotalCents),
        currentTotalCents: BigInt(values.currentTotalCents),
        dueDate: toDate(values.dueDate),
        paymentAgreementNote: values.paymentAgreementNote,
        version: values.version,
        createdAt: values.createdAt,
        updatedAt: values.updatedAt,
        lines: { create: values.lines.map(toLineCreate) },
      },
    });
  }

  async update(sale: Sale, expectedVersion: number): Promise<boolean> {
    const values = sale.toPrimitives();
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.sale.updateMany({
        where: {
          id: values.id,
          lifecycleStatus: SaleLifecycleStatus.DRAFT,
          version: expectedVersion,
        },
        data: {
          customerId: values.customerId,
          originalTotalCents: BigInt(values.originalTotalCents),
          currentTotalCents: BigInt(values.currentTotalCents),
          dueDate: toDate(values.dueDate),
          paymentAgreementNote: values.paymentAgreementNote,
          version: values.version,
          updatedAt: values.updatedAt,
        },
      });
      if (updated.count !== 1) return false;
      await transaction.saleLine.deleteMany({ where: { saleId: values.id } });
      if (values.lines.length > 0) {
        await transaction.saleLine.createMany({
          data: values.lines.map((line) => ({ ...toLineCreate(line), saleId: values.id })),
        });
      }
      return true;
    });
  }
}

type SaleRow = Prisma.SaleGetPayload<{
  include: {
    lines: true;
    payments: { include: { corrections: true } };
    totalAdjustments: true;
    closure: true;
    returns: { include: { lines: true; refund: true } };
    cancellation: { include: { lines: true; refund: true } };
  };
}>;
export function toSaleDomain(row: SaleRow): Sale {
  return Sale.restore({
    id: row.id,
    createdBy: row.createdBy,
    customerId: row.customerId,
    lifecycle:
      row.lifecycleStatus === SaleLifecycleStatus.DRAFT
        ? 'draft'
        : row.lifecycleStatus === SaleLifecycleStatus.CONFIRMED
          ? 'confirmed'
          : row.lifecycleStatus === SaleLifecycleStatus.FINALIZED
            ? 'finalized'
            : 'cancelled',
    originalTotalCents: safeSaleNumber(row.originalTotalCents),
    currentTotalCents: safeSaleNumber(row.currentTotalCents),
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    paymentAgreementNote: row.paymentAgreementNote,
    lines: row.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      locationId: line.locationId,
      quantity: line.quantity,
      deliveryQuantity: line.deliveryQuantity,
      reservationQuantity: line.reservationQuantity,
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
      costingPolicy: line.costingPolicy === null ? null : 'moving-average-v1',
    })),
    payments: row.payments.map((payment) => ({
      id: payment.id,
      amountCents: safeSaleNumber(payment.amountCents),
      method:
        payment.method === PaymentMethod.CASH
          ? 'cash'
          : payment.method === PaymentMethod.YAPE
            ? 'yape'
            : payment.method === PaymentMethod.PLIN
              ? 'plin'
              : 'pos',
      correctedCents: payment.corrections.reduce(
        (sum, correction) => sum + safeSaleNumber(correction.amountCents),
        0,
      ),
      registeredBy: payment.registeredBy,
      effectiveAt: payment.effectiveAt,
    })),
    totalAdjustments: row.totalAdjustments.map((adjustment) => ({
      id: adjustment.id,
      previousTotalCents: safeSaleNumber(adjustment.previousTotalCents),
      newTotalCents: safeSaleNumber(adjustment.newTotalCents),
      differenceCents: safeSignedSaleNumber(adjustment.differenceCents),
      reason: adjustment.reason,
      changedBy: adjustment.changedBy,
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
            effectiveAt: row.closure.effectiveAt,
          },
    returns: row.returns.map((saleReturn) => ({
      id: saleReturn.id,
      reason: saleReturn.reason,
      commercialReductionCents: safeSaleNumber(saleReturn.commercialReductionCents),
      refundAmountCents: safeSaleNumber(saleReturn.refundAmountCents),
      refundMethod:
        saleReturn.refund === null ? null : fromPrismaPaymentMethod(saleReturn.refund.method),
      approvedBy: saleReturn.approvedBy,
      effectiveAt: saleReturn.effectiveAt,
      lines: saleReturn.lines.map((line) => ({
        id: line.id,
        saleLineId: line.saleLineId,
        quantity: line.quantity,
        commercialReductionCents: safeSaleNumber(line.commercialReductionCents),
        productReturns: line.productReturns,
        returnLocationId: line.returnLocationId,
        condition:
          line.condition === null ? null : line.condition === 'AVAILABLE' ? 'available' : 'review',
        attributedCostCents: safeSaleNumber(line.attributedCostCents),
      })),
    })),
    cancellation:
      row.cancellation === null
        ? null
        : {
            id: row.cancellation.id,
            reason: row.cancellation.reason,
            refundAmountCents: safeSaleNumber(row.cancellation.refundAmountCents),
            refundMethod:
              row.cancellation.refund === null
                ? null
                : fromPrismaPaymentMethod(row.cancellation.refund.method),
            cancelledBy: row.cancellation.cancelledBy,
            effectiveAt: row.cancellation.effectiveAt,
            lines: row.cancellation.lines.map((line) => ({
              id: line.id,
              saleLineId: line.saleLineId,
              releasedQuantity: line.releasedQuantity,
              returnedQuantity: line.returnedQuantity,
              notReturnedQuantity: line.notReturnedQuantity,
              returnLocationId: line.returnLocationId,
              condition:
                line.condition === null
                  ? null
                  : line.condition === 'AVAILABLE'
                    ? 'available'
                    : 'review',
              releasedCostCents: safeSaleNumber(line.releasedCostCents),
              attributedReturnedCostCents: safeSaleNumber(line.attributedReturnedCostCents),
            })),
          },
    version: row.version,
    confirmedAt: row.confirmedAt,
    finalizedAt: row.finalizedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toLineCreate(line: ReturnType<Sale['toPrimitives']>['lines'][number]) {
  return {
    id: line.id,
    productId: line.productId,
    locationId: line.locationId,
    quantity: line.quantity,
    deliveryQuantity: line.deliveryQuantity,
    reservationQuantity: line.reservationQuantity,
    agreedUnitPriceCents: BigInt(line.agreedUnitPriceCents),
    originalSubtotalCents: BigInt(line.originalSubtotalCents),
  };
}

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

export function safeSaleNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Sale money exceeds JSON safe integer range.');
  return number;
}

export function safeSignedSaleNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Sale money exceeds JSON safe integer range.');
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
