import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  CashMovementDirection,
  PaymentMethod,
  Prisma,
  RecordStatus,
  SupplierAdvanceStatus,
} from '../../../../../generated/prisma/client';
import type {
  PreparedSupplierAdvance,
  SupplierAdvanceBook,
  SupplierAdvanceReceipt,
  SupplierAdvanceResult,
} from '../../../hexagon/application/supplier-advance-book';

@Injectable()
export class PrismaSupplierAdvanceBook implements SupplierAdvanceBook {
  constructor(private readonly prisma: PrismaService) {}

  async register(command: PreparedSupplierAdvance): Promise<SupplierAdvanceResult> {
    const fingerprint = commandFingerprint(command);
    const existing = await findExisting(this.prisma, command.operationId);
    if (existing !== null) return replay(existing, command, fingerprint);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const repeated = await findExisting(transaction, command.operationId);
        if (repeated !== null) return replay(repeated, command, fingerprint);
        const supplier = await transaction.supplier.findFirst({
          where: { id: command.supplierId, status: RecordStatus.ACTIVE },
          select: { id: true },
        });
        if (supplier === null) reject({ ok: false, reason: 'supplier-not-found' });
        const advance = await transaction.supplierAdvance.create({
          data: {
            id: command.advanceId,
            operationId: command.operationId,
            requestFingerprint: fingerprint,
            supplierId: command.supplierId,
            originalAmountCents: BigInt(command.amountCents),
            currentBalanceCents: BigInt(command.amountCents),
            method: toPrismaMethod(command.method),
            purpose: command.purpose,
            registeredBy: command.actorId,
            effectiveAt: command.effectiveAt,
            createdAt: command.effectiveAt,
            cashMovement: {
              create: {
                id: command.cashMovementId,
                idempotencyKey: command.operationId,
                direction: CashMovementDirection.OUTFLOW,
                amountCents: BigInt(command.amountCents),
                method: toPrismaMethod(command.method),
                registeredBy: command.actorId,
                effectiveAt: command.effectiveAt,
                reason: `Anticipo a proveedor ${command.supplierId}`,
              },
            },
          },
        });
        return { ok: true, replayed: false, advance: receipt(advance) };
      });
    } catch (error) {
      if (error instanceof AdvanceRejected) return error.result;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const repeated = await findExisting(this.prisma, command.operationId);
        return repeated === null
          ? { ok: false, reason: 'concurrency-conflict' }
          : replay(repeated, command, fingerprint);
      }
      throw error;
    }
  }
}

type Rejection = Exclude<SupplierAdvanceResult, { ok: true }>;
class AdvanceRejected extends Error {
  constructor(readonly result: Rejection) {
    super(result.reason);
  }
}
function reject(result: Rejection): never {
  throw new AdvanceRejected(result);
}

type AdvanceRow = Prisma.SupplierAdvanceGetPayload<Record<string, never>>;
function findExisting(client: Prisma.TransactionClient | PrismaService, operationId: string) {
  return client.supplierAdvance.findUnique({ where: { operationId } });
}
function replay(
  row: AdvanceRow,
  command: PreparedSupplierAdvance,
  fingerprint: string,
): SupplierAdvanceResult {
  if (row.supplierId !== command.supplierId || row.requestFingerprint !== fingerprint) {
    return { ok: false, reason: 'idempotency-conflict' };
  }
  return { ok: true, replayed: true, advance: receipt(row) };
}
function receipt(row: AdvanceRow): SupplierAdvanceReceipt {
  return {
    id: row.id,
    operationId: row.operationId,
    supplierId: row.supplierId,
    originalAmountCents: safeNumber(row.originalAmountCents),
    currentBalanceCents: safeNumber(row.currentBalanceCents),
    method: fromPrismaMethod(row.method),
    purpose: row.purpose,
    status: row.status === SupplierAdvanceStatus.PENDING ? 'pending' : 'resolved',
    version: row.version,
    registeredBy: row.registeredBy,
    effectiveAt: row.effectiveAt,
  };
}
function commandFingerprint(command: PreparedSupplierAdvance): string {
  return JSON.stringify({
    supplierId: command.supplierId,
    amountCents: command.amountCents,
    method: command.method,
    purpose: command.purpose,
    actorId: command.actorId,
  });
}
function toPrismaMethod(method: PreparedSupplierAdvance['method']): PaymentMethod {
  return method === 'cash'
    ? PaymentMethod.CASH
    : method === 'yape'
      ? PaymentMethod.YAPE
      : method === 'plin'
        ? PaymentMethod.PLIN
        : PaymentMethod.POS;
}
function fromPrismaMethod(method: PaymentMethod): SupplierAdvanceReceipt['method'] {
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
