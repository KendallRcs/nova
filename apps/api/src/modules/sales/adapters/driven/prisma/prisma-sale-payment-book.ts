import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  CashMovementDirection,
  PaymentMethod,
  Prisma,
} from '../../../../../generated/prisma/client';
import type {
  PreparedSalePayment,
  SalePaymentBook,
  SalePaymentReceipt,
  SalePaymentResult,
} from '../../../hexagon/application/sale-payment-book';
import { safeSaleNumber, toSaleDomain } from './prisma-sale-draft.repository';

@Injectable()
export class PrismaSalePaymentBook implements SalePaymentBook {
  constructor(private readonly prisma: PrismaService) {}

  async record(command: PreparedSalePayment): Promise<SalePaymentResult> {
    const fingerprint = commandFingerprint(command);
    const existing = await findByOperation(this.prisma, command.operationId);
    if (existing !== null) return replay(existing, command, fingerprint);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockSale(transaction, command.saleId);
        const repeated = await findByOperation(transaction, command.operationId);
        if (repeated !== null) return replay(repeated, command, fingerprint);
        const row = await transaction.sale.findUnique({
          where: { id: command.saleId },
          include: {
            lines: true,
            payments: { include: { corrections: true } },
            totalAdjustments: true,
            closure: true,
            returns: { include: { lines: true, refund: true } },
            cancellation: { include: { lines: true, refund: true } },
          },
        });
        if (row === null) reject({ ok: false, reason: 'sale-not-found' });
        if (row.version !== command.expectedVersion) {
          reject({ ok: false, reason: 'version-conflict' });
        }

        const sale = toSaleDomain(row);
        const paymentId = uuidv7();
        const balanceBeforeCents = sale.balanceCents();
        const registered = sale.registerPayment({
          payment: {
            id: paymentId,
            amountCents: command.amountCents,
            method: command.method,
            registeredBy: command.actorId,
            effectiveAt: command.effectiveAt,
          },
          actorId: command.actorId,
          canRegisterAny: command.canRegisterAny,
          now: command.effectiveAt,
        });
        if (!registered.ok) reject(registered);
        const values = sale.toPrimitives();
        await transaction.payment.create({
          data: {
            id: paymentId,
            saleId: command.saleId,
            operationId: command.operationId,
            requestFingerprint: fingerprint,
            amountCents: BigInt(command.amountCents),
            method: toPrismaPaymentMethod(command.method),
            balanceBeforeCents: BigInt(balanceBeforeCents),
            balanceAfterCents: BigInt(registered.balanceCents),
            paidAfterCents: BigInt(registered.paidCents),
            resultingSaleVersion: values.version,
            registeredBy: command.actorId,
            effectiveAt: command.effectiveAt,
            cashMovement: {
              create: {
                id: uuidv7(),
                idempotencyKey: command.operationId,
                direction: CashMovementDirection.INFLOW,
                amountCents: BigInt(command.amountCents),
                method: toPrismaPaymentMethod(command.method),
                registeredBy: command.actorId,
                effectiveAt: command.effectiveAt,
                reason: `Cobro de venta ${command.saleId}`,
              },
            },
          },
        });
        await transaction.sale.update({
          where: { id: command.saleId },
          data: { version: values.version, updatedAt: command.effectiveAt },
        });
        return {
          ok: true,
          replayed: false,
          payment: {
            paymentId,
            operationId: command.operationId,
            saleId: command.saleId,
            saleVersion: values.version,
            amountCents: command.amountCents,
            method: command.method,
            registeredBy: command.actorId,
            effectiveAt: command.effectiveAt,
            paidCents: registered.paidCents,
            balanceCents: registered.balanceCents,
            paymentSituation: registered.paymentSituation,
          },
        };
      });
    } catch (error) {
      if (error instanceof PaymentRejected) return error.result;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const repeated = await findByOperation(this.prisma, command.operationId);
        return repeated === null
          ? { ok: false, reason: 'concurrency-conflict' }
          : replay(repeated, command, fingerprint);
      }
      throw error;
    }
  }
}

type Rejection = Exclude<SalePaymentResult, { ok: true }>;
class PaymentRejected extends Error {
  constructor(readonly result: Rejection) {
    super(result.reason);
  }
}
function reject(result: Rejection): never {
  throw new PaymentRejected(result);
}

type ExistingPayment = Prisma.PaymentGetPayload<Record<string, never>>;
function findByOperation(client: Prisma.TransactionClient | PrismaService, operationId: string) {
  return client.payment.findUnique({ where: { operationId } });
}
function replay(
  payment: ExistingPayment,
  command: PreparedSalePayment,
  fingerprint: string,
): SalePaymentResult {
  if (payment.saleId !== command.saleId || payment.requestFingerprint !== fingerprint) {
    return { ok: false, reason: 'idempotency-conflict' };
  }
  return { ok: true, replayed: true, payment: receiptFromRow(payment) };
}
function receiptFromRow(payment: ExistingPayment): SalePaymentReceipt {
  const balanceCents = safeSaleNumber(payment.balanceAfterCents);
  return {
    paymentId: payment.id,
    operationId: payment.operationId,
    saleId: payment.saleId,
    saleVersion: payment.resultingSaleVersion,
    amountCents: safeSaleNumber(payment.amountCents),
    method: fromPrismaPaymentMethod(payment.method),
    registeredBy: payment.registeredBy,
    effectiveAt: payment.effectiveAt,
    paidCents: safeSaleNumber(payment.paidAfterCents),
    balanceCents,
    paymentSituation: balanceCents === 0 ? 'paid' : 'partial',
  };
}
function commandFingerprint(command: PreparedSalePayment): string {
  return JSON.stringify({
    saleId: command.saleId,
    expectedVersion: command.expectedVersion,
    actorId: command.actorId,
    amountCents: command.amountCents,
    method: command.method,
  });
}
function toPrismaPaymentMethod(method: 'cash' | 'yape' | 'plin' | 'pos'): PaymentMethod {
  return method === 'cash'
    ? PaymentMethod.CASH
    : method === 'yape'
      ? PaymentMethod.YAPE
      : method === 'plin'
        ? PaymentMethod.PLIN
        : PaymentMethod.POS;
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
async function lockSale(transaction: Prisma.TransactionClient, saleId: string): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "sales" WHERE "id" = ${saleId}::uuid FOR UPDATE`,
  );
}
