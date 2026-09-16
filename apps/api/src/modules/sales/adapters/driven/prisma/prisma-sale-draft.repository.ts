import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { Prisma, SaleLifecycleStatus } from '../../../../../generated/prisma/client';
import type { SaleDraftRepository } from '../../../hexagon/application/sale-draft.repository';
import { Sale } from '../../../hexagon/domain/sale';

@Injectable()
export class PrismaSaleDraftRepository implements SaleDraftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Sale | null> {
    const row = await this.prisma.sale.findUnique({ where: { id }, include: { lines: true } });
    return row === null ? null : toDomain(row);
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

type SaleRow = Prisma.SaleGetPayload<{ include: { lines: true } }>;
function toDomain(row: SaleRow): Sale {
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
    originalTotalCents: safeNumber(row.originalTotalCents),
    currentTotalCents: safeNumber(row.currentTotalCents),
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    paymentAgreementNote: row.paymentAgreementNote,
    lines: row.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      locationId: line.locationId,
      quantity: line.quantity,
      deliveryQuantity: line.deliveryQuantity,
      reservationQuantity: line.reservationQuantity,
      agreedUnitPriceCents: safeNumber(line.agreedUnitPriceCents),
      originalSubtotalCents: safeNumber(line.originalSubtotalCents),
    })),
    version: row.version,
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

function safeNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Sale money exceeds JSON safe integer range.');
  return number;
}
