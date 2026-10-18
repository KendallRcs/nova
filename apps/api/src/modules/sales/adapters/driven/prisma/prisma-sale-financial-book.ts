import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  CashMovementDirection,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SaleClosureType,
  SaleLifecycleStatus,
} from '../../../../../generated/prisma/client';
import type {
  PaymentCorrectionBook,
  PaymentCorrectionReceipt,
  PaymentCorrectionResult,
  PreparedPaymentCorrection,
  PreparedSaleClosure,
  PreparedSaleTotalAdjustment,
  SaleClosureBook,
  SaleClosureReceipt,
  SaleClosureResult,
  SaleTotalAdjustmentBook,
  SaleTotalAdjustmentReceipt,
  SaleTotalAdjustmentResult,
} from '../../../hexagon/application/sale-financial-book';
import { safeSaleNumber, safeSignedSaleNumber, toSaleDomain } from './prisma-sale-draft.repository';

@Injectable()
export class PrismaSaleFinancialBook
  implements SaleTotalAdjustmentBook, SaleClosureBook, PaymentCorrectionBook
{
  constructor(private readonly prisma: PrismaService) {}

  async adjust(command: PreparedSaleTotalAdjustment): Promise<SaleTotalAdjustmentResult> {
    const fingerprint = fingerprintOf(command, ['newTotalCents', 'reason']);
    const existing = await adjustmentByOperation(this.prisma, command.operationId);
    if (existing !== null) return replayAdjustment(existing, command, fingerprint);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockSale(transaction, command.saleId);
        const repeated = await adjustmentByOperation(transaction, command.operationId);
        if (repeated !== null) return replayAdjustment(repeated, command, fingerprint);
        const row = await findSale(transaction, command.saleId);
        if (row === null) reject({ ok: false, reason: 'sale-not-found' });
        if (row.version !== command.expectedVersion)
          reject({ ok: false, reason: 'version-conflict' });
        const sale = toSaleDomain(row);
        const adjustmentId = uuidv7();
        const result = sale.adjustTotal({
          adjustment: {
            id: adjustmentId,
            newTotalCents: command.newTotalCents,
            reason: command.reason,
            changedBy: command.actorId,
            effectiveAt: command.effectiveAt,
          },
          canAdjust: true,
          now: command.effectiveAt,
        });
        if (!result.ok) reject(result);
        const values = sale.toPrimitives();
        const adjustment = values.totalAdjustments.at(-1);
        if (adjustment === undefined) throw new Error('Sale adjustment was not recorded.');
        const created = await transaction.saleTotalAdjustment.create({
          data: {
            id: adjustmentId,
            saleId: command.saleId,
            operationId: command.operationId,
            requestFingerprint: fingerprint,
            previousTotalCents: BigInt(adjustment.previousTotalCents),
            newTotalCents: BigInt(adjustment.newTotalCents),
            differenceCents: BigInt(adjustment.differenceCents),
            reason: adjustment.reason,
            changedBy: command.actorId,
            effectiveAt: command.effectiveAt,
            resultingSaleVersion: values.version,
          },
        });
        await transaction.sale.update({
          where: { id: command.saleId },
          data: {
            currentTotalCents: BigInt(values.currentTotalCents),
            version: values.version,
            updatedAt: command.effectiveAt,
          },
        });
        return { ok: true, replayed: false, adjustment: adjustmentReceipt(created) };
      });
    } catch (error) {
      return this.resolveFailure(
        error,
        () => adjustmentByOperation(this.prisma, command.operationId),
        (row) => replayAdjustment(row, command, fingerprint),
      );
    }
  }

  async close(command: PreparedSaleClosure): Promise<SaleClosureResult> {
    const fingerprint = fingerprintOf(command, ['reason']);
    const existing = await closureByOperation(this.prisma, command.operationId);
    if (existing !== null) return replayClosure(existing, command, fingerprint);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockSale(transaction, command.saleId);
        const repeated = await closureByOperation(transaction, command.operationId);
        if (repeated !== null) return replayClosure(repeated, command, fingerprint);
        const row = await findSale(transaction, command.saleId);
        if (row === null) reject({ ok: false, reason: 'sale-not-found' });
        if (row.version !== command.expectedVersion)
          reject({ ok: false, reason: 'version-conflict' });
        const sale = toSaleDomain(row);
        const closureId = uuidv7();
        const result = sale.finalize({
          closure: {
            id: closureId,
            reason: command.reason,
            closedBy: command.actorId,
            effectiveAt: command.effectiveAt,
          },
          canFinalize: true,
          now: command.effectiveAt,
        });
        if (!result.ok) reject(result);
        const values = sale.toPrimitives();
        if (values.closure === null) throw new Error('Sale closure was not recorded.');
        const created = await transaction.saleClosure.create({
          data: {
            id: closureId,
            saleId: command.saleId,
            operationId: command.operationId,
            requestFingerprint: fingerprint,
            type:
              values.closure.type === 'complete'
                ? SaleClosureType.COMPLETE
                : SaleClosureType.INCOMPLETE,
            forgivenAmountCents: BigInt(values.closure.forgivenAmountCents),
            reason: values.closure.reason,
            closedBy: command.actorId,
            effectiveAt: command.effectiveAt,
            resultingSaleVersion: values.version,
          },
        });
        await transaction.sale.update({
          where: { id: command.saleId },
          data: {
            lifecycleStatus: SaleLifecycleStatus.FINALIZED,
            finalizedAt: command.effectiveAt,
            version: values.version,
            updatedAt: command.effectiveAt,
          },
        });
        return { ok: true, replayed: false, closure: closureReceipt(created) };
      });
    } catch (error) {
      return this.resolveFailure(
        error,
        () => closureByOperation(this.prisma, command.operationId),
        (row) => replayClosure(row, command, fingerprint),
      );
    }
  }

  async correct(command: PreparedPaymentCorrection): Promise<PaymentCorrectionResult> {
    const fingerprint = fingerprintOf(command, ['paymentId', 'amountCents', 'reason']);
    const existing = await correctionByOperation(this.prisma, command.operationId);
    if (existing !== null) return replayCorrection(existing, command, fingerprint);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockSale(transaction, command.saleId);
        const repeated = await correctionByOperation(transaction, command.operationId);
        if (repeated !== null) return replayCorrection(repeated, command, fingerprint);
        const row = await findSale(transaction, command.saleId);
        if (row === null) reject({ ok: false, reason: 'sale-not-found' });
        if (row.version !== command.expectedVersion)
          reject({ ok: false, reason: 'version-conflict' });
        const sale = toSaleDomain(row);
        const result = sale.correctPayment({
          paymentId: command.paymentId,
          amountCents: command.amountCents,
          reason: command.reason,
          canCorrect: true,
          now: command.effectiveAt,
        });
        if (!result.ok) reject(result);
        const payment = row.payments.find(({ id }) => id === command.paymentId);
        if (payment === undefined) reject({ ok: false, reason: 'payment-not-found' });
        const values = sale.toPrimitives();
        const correctedPayment = values.payments.find(({ id }) => id === command.paymentId);
        if (correctedPayment === undefined) throw new Error('Corrected payment was not recorded.');
        const correctionId = uuidv7();
        const reason = normalize(command.reason);
        const created = await transaction.paymentCorrection.create({
          data: {
            id: correctionId,
            paymentId: command.paymentId,
            operationId: command.operationId,
            requestFingerprint: fingerprint,
            amountCents: BigInt(command.amountCents),
            reason,
            correctedBy: command.actorId,
            effectiveAt: command.effectiveAt,
            resultingSaleVersion: values.version,
            cashMovement: {
              create: {
                id: uuidv7(),
                idempotencyKey: command.operationId,
                direction: CashMovementDirection.OUTFLOW,
                amountCents: BigInt(command.amountCents),
                method: payment.method,
                registeredBy: command.actorId,
                effectiveAt: command.effectiveAt,
                reason: `Corrección de cobro ${command.paymentId}: ${reason}`,
              },
            },
          },
          include: { payment: true },
        });
        await transaction.payment.update({
          where: { id: command.paymentId },
          data: {
            status:
              correctedPayment.correctedCents === correctedPayment.amountCents
                ? PaymentStatus.CORRECTED
                : PaymentStatus.PARTIALLY_CORRECTED,
          },
        });
        await transaction.sale.update({
          where: { id: command.saleId },
          data: { version: values.version, updatedAt: command.effectiveAt },
        });
        return { ok: true, replayed: false, correction: correctionReceipt(created) };
      });
    } catch (error) {
      return this.resolveFailure(
        error,
        () => correctionByOperation(this.prisma, command.operationId),
        (row) => replayCorrection(row, command, fingerprint),
      );
    }
  }

  private async resolveFailure<T, R>(
    error: unknown,
    find: () => Promise<T | null>,
    replay: (row: T) => R,
  ): Promise<R> {
    if (error instanceof FinancialOperationRejected) return error.result as R;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const repeated = await find();
      return repeated === null
        ? ({ ok: false, reason: 'concurrency-conflict' } as R)
        : replay(repeated);
    }
    throw error;
  }
}

type FinancialFailure =
  | Exclude<SaleTotalAdjustmentResult, { ok: true }>
  | Exclude<SaleClosureResult, { ok: true }>
  | Exclude<PaymentCorrectionResult, { ok: true }>;
class FinancialOperationRejected extends Error {
  constructor(readonly result: FinancialFailure) {
    super(result.reason);
  }
}
function reject(result: FinancialFailure): never {
  throw new FinancialOperationRejected(result);
}

const commonSaleInclude = {
  lines: true,
  payments: { include: { corrections: true } },
  totalAdjustments: true,
  closure: true,
} satisfies Prisma.SaleInclude;
function findSale(client: Prisma.TransactionClient, saleId: string) {
  return client.sale.findUnique({ where: { id: saleId }, include: commonSaleInclude });
}
async function lockSale(transaction: Prisma.TransactionClient, saleId: string): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "sales" WHERE "id" = ${saleId}::uuid FOR UPDATE`,
  );
}

type ExistingAdjustment = Prisma.SaleTotalAdjustmentGetPayload<Record<string, never>>;
function adjustmentByOperation(
  client: Prisma.TransactionClient | PrismaService,
  operationId: string,
) {
  return client.saleTotalAdjustment.findUnique({ where: { operationId } });
}
function replayAdjustment(
  row: ExistingAdjustment,
  command: PreparedSaleTotalAdjustment,
  fingerprint: string,
): SaleTotalAdjustmentResult {
  if (row.saleId !== command.saleId || row.requestFingerprint !== fingerprint) {
    return { ok: false, reason: 'idempotency-conflict' };
  }
  return { ok: true, replayed: true, adjustment: adjustmentReceipt(row) };
}
function adjustmentReceipt(row: ExistingAdjustment): SaleTotalAdjustmentReceipt {
  return {
    adjustmentId: row.id,
    operationId: row.operationId,
    saleId: row.saleId,
    saleVersion: row.resultingSaleVersion,
    previousTotalCents: safeSaleNumber(row.previousTotalCents),
    currentTotalCents: safeSaleNumber(row.newTotalCents),
    differenceCents: safeSignedSaleNumber(row.differenceCents),
    reason: row.reason,
    changedBy: row.changedBy,
    effectiveAt: row.effectiveAt,
  };
}

type ExistingClosure = Prisma.SaleClosureGetPayload<Record<string, never>>;
function closureByOperation(client: Prisma.TransactionClient | PrismaService, operationId: string) {
  return client.saleClosure.findUnique({ where: { operationId } });
}
function replayClosure(
  row: ExistingClosure,
  command: PreparedSaleClosure,
  fingerprint: string,
): SaleClosureResult {
  if (row.saleId !== command.saleId || row.requestFingerprint !== fingerprint) {
    return { ok: false, reason: 'idempotency-conflict' };
  }
  return { ok: true, replayed: true, closure: closureReceipt(row) };
}
function closureReceipt(row: ExistingClosure): SaleClosureReceipt {
  return {
    closureId: row.id,
    operationId: row.operationId,
    saleId: row.saleId,
    saleVersion: row.resultingSaleVersion,
    type: row.type === SaleClosureType.COMPLETE ? 'complete' : 'incomplete',
    forgivenAmountCents: safeSaleNumber(row.forgivenAmountCents),
    reason: row.reason,
    closedBy: row.closedBy,
    effectiveAt: row.effectiveAt,
  };
}

type ExistingCorrection = Prisma.PaymentCorrectionGetPayload<{ include: { payment: true } }>;
function correctionByOperation(
  client: Prisma.TransactionClient | PrismaService,
  operationId: string,
) {
  return client.paymentCorrection.findUnique({
    where: { operationId },
    include: { payment: true },
  });
}
function replayCorrection(
  row: ExistingCorrection,
  command: PreparedPaymentCorrection,
  fingerprint: string,
): PaymentCorrectionResult {
  if (
    row.payment.saleId !== command.saleId ||
    row.paymentId !== command.paymentId ||
    row.requestFingerprint !== fingerprint
  ) {
    return { ok: false, reason: 'idempotency-conflict' };
  }
  return { ok: true, replayed: true, correction: correctionReceipt(row) };
}
function correctionReceipt(row: ExistingCorrection): PaymentCorrectionReceipt {
  return {
    correctionId: row.id,
    operationId: row.operationId,
    saleId: row.payment.saleId,
    paymentId: row.paymentId,
    saleVersion: row.resultingSaleVersion,
    amountCents: safeSaleNumber(row.amountCents),
    method: fromPrismaPaymentMethod(row.payment.method),
    reason: row.reason,
    correctedBy: row.correctedBy,
    effectiveAt: row.effectiveAt,
  };
}

function fingerprintOf(
  command: PreparedSaleTotalAdjustment | PreparedSaleClosure | PreparedPaymentCorrection,
  fields: readonly string[],
): string {
  const source = command as unknown as Record<string, unknown>;
  return JSON.stringify({
    saleId: command.saleId,
    expectedVersion: command.expectedVersion,
    actorId: command.actorId,
    ...Object.fromEntries(fields.map((field) => [field, source[field]])),
  });
}
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
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
