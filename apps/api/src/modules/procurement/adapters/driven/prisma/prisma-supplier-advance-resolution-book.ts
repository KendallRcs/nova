import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  CashMovementDirection,
  PaymentMethod,
  Prisma,
  SupplierAdvanceStatus,
} from '../../../../../generated/prisma/client';
import type {
  AdvanceResolutionReceipt,
  AdvanceResolutionResult,
  PreparedAdvanceResolution,
  SupplierAdvanceResolutionBook,
} from '../../../hexagon/application/supplier-advance-resolution-book';
import { SupplierAdvance } from '../../../hexagon/domain/supplier-advance';

@Injectable()
export class PrismaSupplierAdvanceResolutionBook implements SupplierAdvanceResolutionBook {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(command: PreparedAdvanceResolution): Promise<AdvanceResolutionResult> {
    const fingerprint = commandFingerprint(command);
    const existing = await findExisting(this.prisma, command.operationId);
    if (existing !== null) return replay(existing, command, fingerprint);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockAdvance(transaction, command.advanceId);
        const repeated = await findExisting(transaction, command.operationId);
        if (repeated !== null) return replay(repeated, command, fingerprint);
        const row = await transaction.supplierAdvance.findUnique({
          where: { id: command.advanceId },
        });
        if (row === null) reject({ ok: false, reason: 'advance-not-found' });
        if (row.version !== command.expectedVersion) {
          reject({ ok: false, reason: 'version-conflict' });
        }
        const advance = SupplierAdvance.restore({
          id: row.id,
          currentBalanceCents: safeNumber(row.currentBalanceCents),
          status: row.status === SupplierAdvanceStatus.PENDING ? 'pending' : 'resolved',
          version: row.version,
          updatedAt: row.updatedAt,
        });
        const result = advance.resolve(command.amountCents, command.effectiveAt);
        if (!result.ok) {
          reject({
            ok: false,
            reason: 'insufficient-balance',
            currentBalanceCents: safeNumber(row.currentBalanceCents),
          });
        }
        const balance = result.balance;
        const resolution =
          command.kind === 'refund'
            ? await transaction.advanceRefund.create({
                data: {
                  id: command.resolutionId,
                  operationId: command.operationId,
                  requestFingerprint: fingerprint,
                  advanceId: command.advanceId,
                  amountCents: BigInt(command.amountCents),
                  method: toPrismaMethod(command.method),
                  resultingBalanceCents: BigInt(balance.currentBalanceCents),
                  resultingAdvanceVersion: balance.version,
                  registeredBy: command.actorId,
                  effectiveAt: command.effectiveAt,
                  cashMovement: {
                    create: {
                      id: command.cashMovementId,
                      idempotencyKey: command.operationId,
                      direction: CashMovementDirection.INFLOW,
                      amountCents: BigInt(command.amountCents),
                      method: toPrismaMethod(command.method),
                      registeredBy: command.actorId,
                      effectiveAt: command.effectiveAt,
                      reason: `Devolución de anticipo ${command.advanceId}`,
                    },
                  },
                },
              })
            : await transaction.advanceLoss.create({
                data: {
                  id: command.resolutionId,
                  operationId: command.operationId,
                  requestFingerprint: fingerprint,
                  advanceId: command.advanceId,
                  amountCents: BigInt(command.amountCents),
                  reason: command.reason,
                  resultingBalanceCents: BigInt(balance.currentBalanceCents),
                  resultingAdvanceVersion: balance.version,
                  registeredBy: command.actorId,
                  effectiveAt: command.effectiveAt,
                },
              });
        await transaction.supplierAdvance.update({
          where: { id: command.advanceId },
          data: {
            currentBalanceCents: BigInt(balance.currentBalanceCents),
            status:
              balance.status === 'pending'
                ? SupplierAdvanceStatus.PENDING
                : SupplierAdvanceStatus.RESOLVED,
            version: balance.version,
            updatedAt: balance.updatedAt,
          },
        });
        return {
          ok: true,
          replayed: false,
          resolution: receipt(resolution, command.kind, balance.status),
        };
      });
    } catch (error) {
      if (error instanceof ResolutionRejected) return error.result;
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

type Rejection = Exclude<AdvanceResolutionResult, { ok: true }>;
class ResolutionRejected extends Error {
  constructor(readonly result: Rejection) {
    super(result.reason);
  }
}
function reject(result: Rejection): never {
  throw new ResolutionRejected(result);
}

type RefundRow = Prisma.AdvanceRefundGetPayload<Record<string, never>>;
type LossRow = Prisma.AdvanceLossGetPayload<Record<string, never>>;
type ExistingResolution = { kind: 'refund'; row: RefundRow } | { kind: 'loss'; row: LossRow };

async function findExisting(
  client: Prisma.TransactionClient | PrismaService,
  operationId: string,
): Promise<ExistingResolution | null> {
  const refund = await client.advanceRefund.findUnique({ where: { operationId } });
  if (refund !== null) return { kind: 'refund', row: refund };
  const loss = await client.advanceLoss.findUnique({ where: { operationId } });
  return loss === null ? null : { kind: 'loss', row: loss };
}

function replay(
  existing: ExistingResolution,
  command: PreparedAdvanceResolution,
  fingerprint: string,
): AdvanceResolutionResult {
  if (
    existing.kind !== command.kind ||
    existing.row.advanceId !== command.advanceId ||
    existing.row.requestFingerprint !== fingerprint
  ) {
    return { ok: false, reason: 'idempotency-conflict' };
  }
  const status = safeNumber(existing.row.resultingBalanceCents) === 0 ? 'resolved' : 'pending';
  return {
    ok: true,
    replayed: true,
    resolution: receipt(existing.row, existing.kind, status),
  };
}

function receipt(
  row: RefundRow | LossRow,
  kind: 'refund' | 'loss',
  status: 'pending' | 'resolved',
): AdvanceResolutionReceipt {
  return {
    id: row.id,
    operationId: row.operationId,
    advanceId: row.advanceId,
    type: kind,
    amountCents: safeNumber(row.amountCents),
    method: kind === 'refund' ? fromPrismaMethod((row as RefundRow).method) : null,
    reason: kind === 'loss' ? (row as LossRow).reason : null,
    currentBalanceCents: safeNumber(row.resultingBalanceCents),
    status,
    advanceVersion: row.resultingAdvanceVersion,
    registeredBy: row.registeredBy,
    effectiveAt: row.effectiveAt,
  };
}

function commandFingerprint(command: PreparedAdvanceResolution): string {
  return JSON.stringify(
    command.kind === 'refund'
      ? {
          kind: command.kind,
          advanceId: command.advanceId,
          expectedVersion: command.expectedVersion,
          amountCents: command.amountCents,
          method: command.method,
          actorId: command.actorId,
        }
      : {
          kind: command.kind,
          advanceId: command.advanceId,
          expectedVersion: command.expectedVersion,
          amountCents: command.amountCents,
          reason: command.reason,
          actorId: command.actorId,
        },
  );
}

function toPrismaMethod(method: 'cash' | 'yape' | 'plin' | 'pos'): PaymentMethod {
  return method === 'cash'
    ? PaymentMethod.CASH
    : method === 'yape'
      ? PaymentMethod.YAPE
      : method === 'plin'
        ? PaymentMethod.PLIN
        : PaymentMethod.POS;
}
function fromPrismaMethod(method: PaymentMethod): 'cash' | 'yape' | 'plin' | 'pos' {
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
async function lockAdvance(
  transaction: Prisma.TransactionClient,
  advanceId: string,
): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "supplier_advances" WHERE "id" = ${advanceId}::uuid FOR UPDATE`,
  );
}
