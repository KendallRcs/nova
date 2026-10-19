import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  AccountStatus,
  CashMovementDirection,
  CostMovementType,
  OperatingExpenseStatus,
  Prisma,
  RecordStatus,
  SaleClosureType,
} from '../../../../../generated/prisma/client';
import type {
  AnalyticsPaymentMethod,
  AnalyticsSource,
  CashMovementCause,
  CashMovementFact,
  ProductPerformanceFact,
  ProductPerformanceFilter,
  ResultFacts,
  UserPerformanceFact,
} from '../../../hexagon/application/analytics.source';
import type { ReportingPeriod } from '../../../hexagon/domain/reporting-period';

@Injectable()
export class PrismaAnalyticsSource implements AnalyticsSource {
  constructor(private readonly prisma: PrismaService) {}

  async cashMovements(period: ReportingPeriod): Promise<readonly CashMovementFact[]> {
    const rows = await this.prisma.cashMovement.findMany({
      where: inPeriod(period),
      select: {
        direction: true,
        amountCents: true,
        method: true,
        paymentId: true,
        paymentCorrectionId: true,
        returnRefundId: true,
        saleCancellationRefundId: true,
        supplierAdvanceId: true,
        advanceRefundId: true,
        purchaseId: true,
        operatingExpenseId: true,
        expenseCancellationId: true,
      },
    });
    return rows.map((row) => ({
      direction:
        row.direction === CashMovementDirection.INFLOW ? ('inflow' as const) : ('outflow' as const),
      amountCents: safeNumber(row.amountCents),
      method: paymentMethod(row.method),
      cause: cashCause(row),
    }));
  }

  resultFacts(period: ReportingPeriod): Promise<ResultFacts> {
    return this.prisma.$transaction(
      async (transaction) => {
        const sales = await transaction.sale.findMany({
          where: { confirmedAt: range(period) },
          select: { originalTotalCents: true, lines: { select: { quantity: true } } },
        });
        const adjustments = await transaction.saleTotalAdjustment.findMany({
          where: { effectiveAt: range(period) },
          select: { differenceCents: true },
        });
        const returns = await transaction.saleReturn.findMany({
          where: { effectiveAt: range(period) },
          select: {
            commercialReductionCents: true,
            lines: {
              select: { quantity: true, productReturns: true, attributedCostCents: true },
            },
          },
        });
        const cancellations = await transaction.saleCancellation.findMany({
          where: { effectiveAt: range(period) },
          select: {
            refundAmountCents: true,
            lines: { select: { returnedQuantity: true, attributedReturnedCostCents: true } },
          },
        });
        const saleCosts = await transaction.costMovement.findMany({
          where: { effectiveAt: range(period), type: CostMovementType.SALE_ALLOCATION },
          select: { valueDeltaCents: true },
        });
        const expenses = await transaction.operatingExpense.findMany({
          where: { effectiveAt: range(period), status: OperatingExpenseStatus.CONFIRMED },
          select: { amountCents: true },
        });
        const writeOffs = await transaction.costMovement.findMany({
          where: { effectiveAt: range(period), type: CostMovementType.WRITE_OFF },
          select: { valueDeltaCents: true, quantityDelta: true },
        });
        const losses = await transaction.advanceLoss.findMany({
          where: { effectiveAt: range(period) },
          select: { amountCents: true },
        });
        const closures = await transaction.saleClosure.findMany({
          where: { effectiveAt: range(period), type: SaleClosureType.INCOMPLETE },
          select: { forgivenAmountCents: true },
        });
        const returnedCostCents = sum([
          ...returns.flatMap(({ lines }) =>
            lines
              .filter(({ productReturns }) => productReturns)
              .map(({ attributedCostCents }) => safeNumber(attributedCostCents)),
          ),
          ...cancellations.flatMap(({ lines }) =>
            lines.map(({ attributedReturnedCostCents }) => safeNumber(attributedReturnedCostCents)),
          ),
        ]);
        return {
          confirmedSalesCents: sum(
            sales.map(({ originalTotalCents }) => safeNumber(originalTotalCents)),
          ),
          saleAdjustmentsCents: signedSum(
            adjustments.map(({ differenceCents }) => signedNumber(differenceCents)),
          ),
          returnReductionsCents: sum(
            returns.map(({ commercialReductionCents }) => safeNumber(commercialReductionCents)),
          ),
          cancellationRefundsCents: sum(
            cancellations.map(({ refundAmountCents }) => safeNumber(refundAmountCents)),
          ),
          saleCostCents: sum(
            saleCosts.map(({ valueDeltaCents }) => -signedNumber(valueDeltaCents)),
          ),
          returnedCostCents,
          operatingExpensesCents: sum(expenses.map(({ amountCents }) => safeNumber(amountCents))),
          inventoryWriteOffLossCents: sum(
            writeOffs.map(({ valueDeltaCents }) => -signedNumber(valueDeltaCents)),
          ),
          supplierAdvanceLossCents: sum(losses.map(({ amountCents }) => safeNumber(amountCents))),
          forgivenBalanceCents: sum(
            closures.map(({ forgivenAmountCents }) => safeNumber(forgivenAmountCents)),
          ),
          soldUnits: sum(sales.flatMap(({ lines }) => lines.map(({ quantity }) => quantity))),
          returnedUnits: sum([
            ...returns.flatMap(({ lines }) => lines.map(({ quantity }) => quantity)),
            ...cancellations.flatMap(({ lines }) =>
              lines.map(({ returnedQuantity }) => returnedQuantity),
            ),
          ]),
          writtenOffUnits: sum(writeOffs.map(({ quantityDelta }) => -quantityDelta)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  userPerformance(period: ReportingPeriod): Promise<readonly UserPerformanceFact[]> {
    return this.prisma.$transaction(
      async (transaction) => {
        const users = await transaction.userAccount.findMany({
          select: { id: true, usernameNormalized: true, status: true },
          orderBy: [{ usernameNormalized: 'asc' }, { id: 'asc' }],
        });
        const sales = await transaction.sale.findMany({
          where: { confirmedAt: range(period) },
          select: { createdBy: true, originalTotalCents: true },
        });
        const payments = await transaction.payment.findMany({
          where: { effectiveAt: range(period) },
          select: { registeredBy: true, amountCents: true },
        });
        const returns = await transaction.saleReturn.findMany({
          where: { effectiveAt: range(period) },
          select: { approvedBy: true, commercialReductionCents: true },
        });
        const cancellations = await transaction.saleCancellation.findMany({
          where: { effectiveAt: range(period) },
          select: { cancelledBy: true, refundAmountCents: true },
        });
        const adjustments = await transaction.saleTotalAdjustment.findMany({
          where: { effectiveAt: range(period) },
          select: { changedBy: true, differenceCents: true },
        });
        const closures = await transaction.saleClosure.findMany({
          where: { effectiveAt: range(period) },
          select: { closedBy: true, forgivenAmountCents: true },
        });
        const corrections = await transaction.paymentCorrection.findMany({
          where: { effectiveAt: range(period) },
          select: { correctedBy: true, amountCents: true },
        });
        const result = new Map<string, MutableUserPerformance>();
        for (const user of users) {
          result.set(user.id, {
            userId: user.id,
            username: user.usernameNormalized,
            accountStatus: accountStatus(user.status),
            salesCount: 0,
            salesAmountCents: 0,
            paymentsCount: 0,
            paymentsAmountCents: 0,
            administrativeOperationsCount: 0,
            administrativeAmountCents: 0,
          });
        }
        for (const sale of sales)
          addCommercial(result, sale.createdBy, safeNumber(sale.originalTotalCents));
        for (const payment of payments)
          addPayment(result, payment.registeredBy, safeNumber(payment.amountCents));
        for (const item of returns)
          addAdministrative(result, item.approvedBy, safeNumber(item.commercialReductionCents));
        for (const item of cancellations)
          addAdministrative(result, item.cancelledBy, safeNumber(item.refundAmountCents));
        for (const item of adjustments)
          addAdministrative(result, item.changedBy, Math.abs(signedNumber(item.differenceCents)));
        for (const item of closures)
          addAdministrative(result, item.closedBy, safeNumber(item.forgivenAmountCents));
        for (const item of corrections)
          addAdministrative(result, item.correctedBy, safeNumber(item.amountCents));
        return [...result.values()];
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  productPerformance(
    period: ReportingPeriod,
    filter: ProductPerformanceFilter,
  ): Promise<readonly ProductPerformanceFact[]> {
    return this.prisma.$transaction(
      async (transaction) => {
        const productWhere = {
          ...(filter.categoryId === undefined ? {} : { categoryId: filter.categoryId }),
          ...(filter.productId === undefined ? {} : { id: filter.productId }),
        };
        const products = await transaction.product.findMany({
          where: productWhere,
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            category: { select: { id: true, name: true } },
            inventoryPositions: {
              select: {
                locationId: true,
                physicalQuantity: true,
                reservedQuantity: true,
                reviewQuantity: true,
                location: { select: { name: true, type: true } },
              },
              orderBy: [{ location: { type: 'asc' } }, { locationId: 'asc' }],
            },
          },
          orderBy: [{ codeNormalized: 'asc' }, { id: 'asc' }],
        });
        const productIds = products.map(({ id }) => id);
        if (productIds.length === 0) return [];
        const saleLines = await transaction.saleLine.findMany({
          where: { productId: { in: productIds }, sale: { confirmedAt: range(period) } },
          select: { productId: true, quantity: true, originalSubtotalCents: true },
        });
        const returnLines = await transaction.returnLine.findMany({
          where: {
            saleLine: { productId: { in: productIds } },
            saleReturn: { effectiveAt: range(period) },
          },
          select: {
            quantity: true,
            commercialReductionCents: true,
            attributedCostCents: true,
            productReturns: true,
            saleLine: { select: { productId: true } },
          },
        });
        const cancellationLines = await transaction.saleCancellationLine.findMany({
          where: {
            saleLine: { productId: { in: productIds } },
            cancellation: { effectiveAt: range(period) },
          },
          select: {
            returnedQuantity: true,
            attributedReturnedCostCents: true,
            saleLine: { select: { productId: true } },
          },
        });
        const saleCosts = await transaction.costMovement.findMany({
          where: {
            productId: { in: productIds },
            effectiveAt: range(period),
            type: CostMovementType.SALE_ALLOCATION,
          },
          select: { productId: true, valueDeltaCents: true },
        });
        const facts = new Map<string, MutableProductPerformance>();
        for (const product of products) {
          facts.set(product.id, {
            productId: product.id,
            code: product.code,
            name: product.name,
            categoryId: product.category.id,
            categoryName: product.category.name,
            productStatus: product.status === RecordStatus.ACTIVE ? 'active' : 'inactive',
            soldUnits: 0,
            returnedUnits: 0,
            grossSalesCents: 0,
            returnReductionsCents: 0,
            saleCostCents: 0,
            returnedCostCents: 0,
            stockByLocation: product.inventoryPositions.map((position) => ({
              locationId: position.locationId,
              locationName: position.location.name,
              locationType: position.location.type === 'STORE' ? 'store' : 'warehouse',
              physicalQuantity: position.physicalQuantity,
              reservedQuantity: position.reservedQuantity,
              reviewQuantity: position.reviewQuantity,
            })),
          });
        }
        for (const line of saleLines) {
          const fact = requiredProduct(facts, line.productId);
          fact.soldUnits += line.quantity;
          fact.grossSalesCents = checkedAdd(
            fact.grossSalesCents,
            safeNumber(line.originalSubtotalCents),
          );
        }
        for (const line of returnLines) {
          const fact = requiredProduct(facts, line.saleLine.productId);
          fact.returnedUnits += line.quantity;
          fact.returnReductionsCents = checkedAdd(
            fact.returnReductionsCents,
            safeNumber(line.commercialReductionCents),
          );
          if (line.productReturns)
            fact.returnedCostCents = checkedAdd(
              fact.returnedCostCents,
              safeNumber(line.attributedCostCents),
            );
        }
        for (const line of cancellationLines) {
          const fact = requiredProduct(facts, line.saleLine.productId);
          fact.returnedUnits += line.returnedQuantity;
          fact.returnedCostCents = checkedAdd(
            fact.returnedCostCents,
            safeNumber(line.attributedReturnedCostCents),
          );
        }
        for (const movement of saleCosts) {
          const fact = requiredProduct(facts, movement.productId);
          fact.saleCostCents = checkedAdd(
            fact.saleCostCents,
            -signedNumber(movement.valueDeltaCents),
          );
        }
        return [...facts.values()];
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}

interface CashRow {
  paymentId: string | null;
  paymentCorrectionId: string | null;
  returnRefundId: string | null;
  saleCancellationRefundId: string | null;
  supplierAdvanceId: string | null;
  advanceRefundId: string | null;
  purchaseId: string | null;
  operatingExpenseId: string | null;
  expenseCancellationId: string | null;
}
type MutableUserPerformance = {
  -readonly [Key in keyof UserPerformanceFact]: UserPerformanceFact[Key];
};
type MutableProductPerformance = {
  -readonly [Key in keyof ProductPerformanceFact]: ProductPerformanceFact[Key];
};

function range(period: ReportingPeriod) {
  return { gte: period.start, lt: period.end };
}
function inPeriod(period: ReportingPeriod) {
  return { effectiveAt: range(period) };
}
function cashCause(row: CashRow): CashMovementCause {
  if (row.paymentId !== null) return 'sale-payment';
  if (row.paymentCorrectionId !== null) return 'payment-correction';
  if (row.returnRefundId !== null) return 'sale-return-refund';
  if (row.saleCancellationRefundId !== null) return 'sale-cancellation-refund';
  if (row.supplierAdvanceId !== null) return 'supplier-advance';
  if (row.advanceRefundId !== null) return 'supplier-refund';
  if (row.purchaseId !== null) return 'purchase';
  if (row.operatingExpenseId !== null) return 'operating-expense';
  if (row.expenseCancellationId !== null) return 'expense-refund';
  throw new Error('Cash movement has no supported causal source.');
}
function paymentMethod(value: string): AnalyticsPaymentMethod {
  if (value === 'CASH') return 'cash';
  if (value === 'YAPE') return 'yape';
  if (value === 'PLIN') return 'plin';
  return 'pos';
}
function accountStatus(status: AccountStatus): UserPerformanceFact['accountStatus'] {
  if (status === AccountStatus.ACTIVE) return 'active';
  if (status === AccountStatus.INACTIVE) return 'inactive';
  return 'password-change-required';
}
function addCommercial(result: Map<string, MutableUserPerformance>, id: string, amount: number) {
  const item = requiredUser(result, id);
  item.salesCount += 1;
  item.salesAmountCents = checkedAdd(item.salesAmountCents, amount);
}
function addPayment(result: Map<string, MutableUserPerformance>, id: string, amount: number) {
  const item = requiredUser(result, id);
  item.paymentsCount += 1;
  item.paymentsAmountCents = checkedAdd(item.paymentsAmountCents, amount);
}
function addAdministrative(
  result: Map<string, MutableUserPerformance>,
  id: string,
  amount: number,
) {
  const item = requiredUser(result, id);
  item.administrativeOperationsCount += 1;
  item.administrativeAmountCents = checkedAdd(item.administrativeAmountCents, amount);
}
function requiredUser(result: Map<string, MutableUserPerformance>, id: string) {
  const item = result.get(id);
  if (item === undefined) throw new Error('Analytics references an unknown user account.');
  return item;
}
function requiredProduct(result: Map<string, MutableProductPerformance>, id: string) {
  const item = result.get(id);
  if (item === undefined) throw new Error('Analytics references an unknown product.');
  return item;
}
function safeNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0)
    throw new Error('Analytics monetary value is outside the safe range.');
  return number;
}
function signedNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new Error('Analytics monetary value is outside the safe range.');
  return number;
}
function checkedAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error('Analytics total exceeds the safe range.');
  return result;
}
function sum(values: readonly number[]): number {
  return values.reduce(checkedAdd, 0);
}
function signedSum(values: readonly number[]): number {
  return values.reduce(checkedAdd, 0);
}
