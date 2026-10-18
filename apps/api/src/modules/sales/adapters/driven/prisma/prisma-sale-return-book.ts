import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  CashMovementDirection,
  CostMovementType,
  CostingPolicy,
  InventoryMovementType,
  PaymentMethod,
  Prisma,
  RecordStatus,
  ReturnCondition,
} from '../../../../../generated/prisma/client';
import { InventoryPosition } from '../../../../inventory/hexagon/domain/inventory-position';
import { ProductCostPosition } from '../../../../inventory/hexagon/domain/product-cost-position';
import type {
  PreparedSaleReturn,
  SaleReturnBook,
  SaleReturnReceipt,
  SaleReturnResult,
} from '../../../hexagon/application/sale-return-book';
import { safeSaleNumber, toSaleDomain } from './prisma-sale-draft.repository';

@Injectable()
export class PrismaSaleReturnBook implements SaleReturnBook {
  constructor(private readonly prisma: PrismaService) {}

  async approve(command: PreparedSaleReturn): Promise<SaleReturnResult> {
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
          include: saleInclude,
        });
        if (row === null) reject({ ok: false, reason: 'sale-not-found' });
        if (row.version !== command.expectedVersion)
          reject({ ok: false, reason: 'version-conflict' });

        const returningLocationIds = command.lines.flatMap((line) =>
          line.productReturns && line.returnLocationId !== null ? [line.returnLocationId] : [],
        );
        if (returningLocationIds.length > 0) {
          const locations = await transaction.location.findMany({
            where: { id: { in: [...new Set(returningLocationIds)] }, status: RecordStatus.ACTIVE },
            select: { id: true },
          });
          const active = new Set(locations.map(({ id }) => id));
          const missing = returningLocationIds.find((id) => !active.has(id));
          if (missing !== undefined) {
            reject({ ok: false, reason: 'location-not-found', referenceId: missing });
          }
        }

        const sale = toSaleDomain(row);
        const returnId = uuidv7();
        const lineIds = new Map(command.lines.map((line) => [line.saleLineId, uuidv7()]));
        const approved = sale.approveReturn({
          saleReturn: {
            id: returnId,
            reason: command.reason,
            refundMethod: command.refundMethod,
            approvedBy: command.actorId,
            effectiveAt: command.effectiveAt,
            lines: command.lines.map((line) => ({
              id: requiredMapValue(lineIds, line.saleLineId),
              ...line,
            })),
          },
          canApprove: true,
          now: command.effectiveAt,
        });
        if (!approved.ok) reject(approved);
        const values = sale.toPrimitives();
        const saleReturn = values.returns.at(-1);
        if (saleReturn === undefined) throw new Error('Sale return was not recorded.');

        const created = await transaction.saleReturn.create({
          data: {
            id: returnId,
            saleId: command.saleId,
            operationId: command.operationId,
            requestFingerprint: fingerprint,
            reason: saleReturn.reason,
            commercialReductionCents: BigInt(saleReturn.commercialReductionCents),
            refundAmountCents: BigInt(saleReturn.refundAmountCents),
            resultingCurrentTotalCents: BigInt(approved.currentTotalCents),
            resultingPaidCents: BigInt(approved.paidCents),
            resultingBalanceCents: BigInt(approved.balanceCents),
            approvedBy: command.actorId,
            effectiveAt: command.effectiveAt,
            resultingSaleVersion: values.version,
            lines: {
              create: saleReturn.lines.map((line) => ({
                id: line.id,
                saleLineId: line.saleLineId,
                quantity: line.quantity,
                commercialReductionCents: BigInt(line.commercialReductionCents),
                productReturns: line.productReturns,
                returnLocationId: line.returnLocationId,
                condition:
                  line.condition === null
                    ? null
                    : line.condition === 'available'
                      ? ReturnCondition.AVAILABLE
                      : ReturnCondition.REVIEW,
                attributedCostCents: BigInt(line.attributedCostCents),
              })),
            },
            ...(saleReturn.refundAmountCents === 0 || saleReturn.refundMethod === null
              ? {}
              : {
                  refund: {
                    create: {
                      id: uuidv7(),
                      amountCents: BigInt(saleReturn.refundAmountCents),
                      method: toPrismaPaymentMethod(saleReturn.refundMethod),
                      registeredBy: command.actorId,
                      effectiveAt: command.effectiveAt,
                      cashMovement: {
                        create: {
                          id: uuidv7(),
                          idempotencyKey: command.operationId,
                          direction: CashMovementDirection.OUTFLOW,
                          amountCents: BigInt(saleReturn.refundAmountCents),
                          method: toPrismaPaymentMethod(saleReturn.refundMethod),
                          registeredBy: command.actorId,
                          effectiveAt: command.effectiveAt,
                          reason: `Reembolso de devolución ${returnId}`,
                        },
                      },
                    },
                  },
                }),
          },
          include: { lines: true, refund: true },
        });

        const sourceLines = new Map(row.lines.map((line) => [line.id, line]));
        for (const line of saleReturn.lines
          .filter(({ productReturns }) => productReturns)
          .sort((left, right) =>
            physicalReturnLockKey(sourceLines, left).localeCompare(
              physicalReturnLockKey(sourceLines, right),
            ),
          )) {
          const source = sourceLines.get(line.saleLineId);
          if (source === undefined || line.returnLocationId === null || line.condition === null) {
            throw new Error('Validated return line is incomplete.');
          }
          await receivePhysicalReturn(transaction, {
            returnLineId: line.id,
            productId: source.productId,
            locationId: line.returnLocationId,
            quantity: line.quantity,
            costCents: line.attributedCostCents,
            condition: line.condition,
            actorId: command.actorId,
            reason: saleReturn.reason,
            effectiveAt: command.effectiveAt,
          });
        }

        await transaction.sale.update({
          where: { id: command.saleId },
          data: {
            currentTotalCents: BigInt(values.currentTotalCents),
            version: values.version,
            updatedAt: command.effectiveAt,
          },
        });
        return { ok: true, replayed: false, saleReturn: receipt(created) };
      });
    } catch (error) {
      if (error instanceof ReturnRejected) return error.result;
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

function physicalReturnLockKey(
  sourceLines: ReadonlyMap<string, { productId: string }>,
  line: { saleLineId: string; returnLocationId: string | null },
): string {
  const productId = sourceLines.get(line.saleLineId)?.productId;
  if (productId === undefined || line.returnLocationId === null) {
    throw new Error('Validated return line is incomplete.');
  }
  return `${productId}:${line.returnLocationId}`;
}

async function receivePhysicalReturn(
  transaction: Prisma.TransactionClient,
  input: {
    returnLineId: string;
    productId: string;
    locationId: string;
    quantity: number;
    costCents: number;
    condition: 'available' | 'review';
    actorId: string;
    reason: string;
    effectiveAt: Date;
  },
): Promise<void> {
  await transaction.inventoryPosition.upsert({
    where: { productId_locationId: { productId: input.productId, locationId: input.locationId } },
    create: {
      id: uuidv7(),
      productId: input.productId,
      locationId: input.locationId,
      createdAt: input.effectiveAt,
      updatedAt: input.effectiveAt,
    },
    update: {},
  });
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "inventory_positions" WHERE "product_id" = ${input.productId}::uuid AND "location_id" = ${input.locationId}::uuid FOR UPDATE`,
  );
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "product_cost_positions" WHERE "product_id" = ${input.productId}::uuid FOR UPDATE`,
  );
  const [positionRow, costRow] = await Promise.all([
    transaction.inventoryPosition.findUniqueOrThrow({
      where: { productId_locationId: { productId: input.productId, locationId: input.locationId } },
    }),
    transaction.productCostPosition.findUnique({ where: { productId: input.productId } }),
  ]);
  if (costRow === null) reject({ ok: false, reason: 'cost-unavailable' });
  const position = InventoryPosition.restore({ ...positionRow });
  const cost = ProductCostPosition.restore({
    ...costRow,
    availableValueCents: safeSaleNumber(costRow.availableValueCents),
    reservedValueCents: safeSaleNumber(costRow.reservedValueCents),
    reviewValueCents: safeSaleNumber(costRow.reviewValueCents),
    policy: 'moving-average-v1',
  });
  const inventoryChange = position.receiveReturn(
    input.quantity,
    input.condition,
    input.effectiveAt,
  );
  const costChange = cost.receiveHistoricalReturn(
    input.quantity,
    input.costCents,
    input.condition,
    input.effectiveAt,
  );
  if (!inventoryChange.ok || !costChange.ok) throw new Error('Invalid validated physical return.');
  const after = inventoryChange.after;
  const costAfter = costChange.after;
  await transaction.inventoryPosition.update({
    where: { id: after.id },
    data: {
      physicalQuantity: after.physicalQuantity,
      reservedQuantity: after.reservedQuantity,
      reviewQuantity: after.reviewQuantity,
      version: after.version,
      updatedAt: input.effectiveAt,
    },
  });
  await transaction.productCostPosition.update({
    where: { id: costAfter.id },
    data: {
      availableQuantity: costAfter.availableQuantity,
      availableValueCents: BigInt(costAfter.availableValueCents),
      reservedQuantity: costAfter.reservedQuantity,
      reservedValueCents: BigInt(costAfter.reservedValueCents),
      reviewQuantity: costAfter.reviewQuantity,
      reviewValueCents: BigInt(costAfter.reviewValueCents),
      version: costAfter.version,
      updatedAt: input.effectiveAt,
    },
  });
  const movementId = uuidv7();
  await transaction.inventoryMovement.create({
    data: {
      id: movementId,
      productId: input.productId,
      locationId: input.locationId,
      type:
        input.condition === 'available'
          ? InventoryMovementType.RETURN_AVAILABLE
          : InventoryMovementType.RETURN_REVIEW,
      physicalDelta: input.quantity,
      reservedDelta: 0,
      reviewDelta: input.condition === 'review' ? input.quantity : 0,
      previousPhysicalQuantity: inventoryChange.before.physicalQuantity,
      resultingPhysicalQuantity: inventoryChange.after.physicalQuantity,
      previousReservedQuantity: inventoryChange.before.reservedQuantity,
      resultingReservedQuantity: inventoryChange.after.reservedQuantity,
      previousReviewQuantity: inventoryChange.before.reviewQuantity,
      resultingReviewQuantity: inventoryChange.after.reviewQuantity,
      actorId: input.actorId,
      effectiveAt: input.effectiveAt,
      reason: input.reason,
      returnLineId: input.returnLineId,
      costMovement: {
        create: {
          id: uuidv7(),
          productId: input.productId,
          type:
            input.condition === 'available'
              ? CostMovementType.RETURN_AVAILABLE
              : CostMovementType.RETURN_REVIEW,
          quantityDelta: input.quantity,
          valueDeltaCents: BigInt(input.costCents),
          previousAvailableQuantity: costChange.before.availableQuantity,
          resultingAvailableQuantity: costChange.after.availableQuantity,
          previousAvailableValueCents: BigInt(costChange.before.availableValueCents),
          resultingAvailableValueCents: BigInt(costChange.after.availableValueCents),
          previousReservedQuantity: costChange.before.reservedQuantity,
          resultingReservedQuantity: costChange.after.reservedQuantity,
          previousReservedValueCents: BigInt(costChange.before.reservedValueCents),
          resultingReservedValueCents: BigInt(costChange.after.reservedValueCents),
          previousReviewQuantity: costChange.before.reviewQuantity,
          resultingReviewQuantity: costChange.after.reviewQuantity,
          previousReviewValueCents: BigInt(costChange.before.reviewValueCents),
          resultingReviewValueCents: BigInt(costChange.after.reviewValueCents),
          policy: CostingPolicy.MOVING_AVERAGE_V1,
          actorId: input.actorId,
          effectiveAt: input.effectiveAt,
          reason: input.reason,
        },
      },
    },
  });
}

const saleInclude = {
  lines: true,
  payments: { include: { corrections: true } },
  totalAdjustments: true,
  closure: true,
  returns: { include: { lines: true, refund: true } },
} satisfies Prisma.SaleInclude;

type ExistingReturn = Prisma.SaleReturnGetPayload<{ include: { lines: true; refund: true } }>;
function findByOperation(client: Prisma.TransactionClient | PrismaService, operationId: string) {
  return client.saleReturn.findUnique({
    where: { operationId },
    include: { lines: true, refund: true },
  });
}
function replay(
  row: ExistingReturn,
  command: PreparedSaleReturn,
  fingerprint: string,
): SaleReturnResult {
  if (row.saleId !== command.saleId || row.requestFingerprint !== fingerprint) {
    return { ok: false, reason: 'idempotency-conflict' };
  }
  return { ok: true, replayed: true, saleReturn: receipt(row) };
}
function receipt(row: ExistingReturn): SaleReturnReceipt {
  return {
    returnId: row.id,
    operationId: row.operationId,
    saleId: row.saleId,
    saleVersion: row.resultingSaleVersion,
    commercialReductionCents: safeSaleNumber(row.commercialReductionCents),
    refundAmountCents: safeSaleNumber(row.refundAmountCents),
    refundMethod: row.refund === null ? null : fromPrismaPaymentMethod(row.refund.method),
    currentTotalCents: safeSaleNumber(row.resultingCurrentTotalCents),
    paidCents: safeSaleNumber(row.resultingPaidCents),
    balanceCents: safeSaleNumber(row.resultingBalanceCents),
    approvedBy: row.approvedBy,
    effectiveAt: row.effectiveAt,
  };
}
function commandFingerprint(command: PreparedSaleReturn): string {
  return JSON.stringify({
    saleId: command.saleId,
    expectedVersion: command.expectedVersion,
    actorId: command.actorId,
    reason: command.reason,
    refundMethod: command.refundMethod,
    lines: command.lines,
  });
}
async function lockSale(transaction: Prisma.TransactionClient, saleId: string): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "sales" WHERE "id" = ${saleId}::uuid FOR UPDATE`,
  );
}
type Rejection = Exclude<SaleReturnResult, { ok: true }>;
class ReturnRejected extends Error {
  constructor(readonly result: Rejection) {
    super(result.reason);
  }
}
function reject(result: Rejection): never {
  throw new ReturnRejected(result);
}
function requiredMapValue(map: ReadonlyMap<string, string>, key: string): string {
  const value = map.get(key);
  if (value === undefined) throw new Error('Missing generated return line id.');
  return value;
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
