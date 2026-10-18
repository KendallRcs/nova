import type { SaleClock } from './sale.dependencies';
import { limaCivilDate, type SaleActivityRecord } from './sale-activity';
import type { PaymentMethod } from '../domain/sale';
import { deriveSaleTracking, type SaleTracking } from '../domain/sale-tracking';

export interface SaleDetailRecord extends Omit<SaleActivityRecord, 'lines'> {
  readonly paymentAgreementNote: string | null;
  readonly finalizedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly lines: readonly {
    readonly id: string;
    readonly productId: string;
    readonly locationId: string;
    readonly locationCode: string;
    readonly locationName: string;
    readonly quantity: number;
    readonly deliveryQuantity: number;
    readonly reservationQuantity: number;
    readonly activeReservationQuantity: number;
    readonly agreedUnitPriceCents: number;
    readonly originalSubtotalCents: number;
    readonly snapshot: {
      readonly code: string;
      readonly name: string;
      readonly minimumPriceCents: number;
      readonly suggestedPriceCents: number | null;
      readonly maximumPriceCents: number | null;
    } | null;
    readonly priceExceptionReason: string | null;
    readonly priceApprovedBy: string | null;
    readonly allocatedCostCents: number | null;
  }[];
  readonly totalAdjustments: readonly {
    readonly id: string;
    readonly previousTotalCents: number;
    readonly newTotalCents: number;
    readonly differenceCents: number;
    readonly reason: string;
    readonly changedBy: string;
    readonly actorUsername: string;
    readonly effectiveAt: Date;
  }[];
  readonly closure: {
    readonly id: string;
    readonly type: 'complete' | 'incomplete';
    readonly forgivenAmountCents: number;
    readonly reason: string | null;
    readonly closedBy: string;
    readonly actorUsername: string;
    readonly effectiveAt: Date;
  } | null;
  readonly returns: readonly {
    readonly id: string;
    readonly reason: string;
    readonly commercialReductionCents: number;
    readonly refundAmountCents: number;
    readonly refundMethod: PaymentMethod | null;
    readonly approvedBy: string;
    readonly effectiveAt: Date;
    readonly lines: readonly {
      readonly id: string;
      readonly saleLineId: string;
      readonly quantity: number;
      readonly commercialReductionCents: number;
      readonly productReturns: boolean;
      readonly returnLocationId: string | null;
      readonly condition: 'available' | 'review' | null;
      readonly attributedCostCents: number | null;
    }[];
  }[];
  readonly deliveries: readonly {
    readonly id: string;
    readonly deliveredBy: string;
    readonly actorUsername: string;
    readonly effectiveAt: Date;
    readonly lines: readonly {
      readonly id: string;
      readonly saleLineId: string;
      readonly locationId: string;
      readonly quantity: number;
      readonly consumedCostCents: number | null;
    }[];
  }[];
  readonly cancellation: {
    readonly id: string;
    readonly reason: string;
    readonly refundAmountCents: number;
    readonly refundMethod: PaymentMethod | null;
    readonly cancelledBy: string;
    readonly actorUsername: string;
    readonly effectiveAt: Date;
    readonly lines: readonly {
      readonly id: string;
      readonly saleLineId: string;
      readonly releasedQuantity: number;
      readonly returnedQuantity: number;
      readonly notReturnedQuantity: number;
      readonly returnLocationId: string | null;
      readonly condition: 'available' | 'review' | null;
      readonly releasedCostCents: number | null;
      readonly attributedReturnedCostCents: number | null;
    }[];
  } | null;
  readonly payments: readonly {
    readonly id: string;
    readonly amountCents: number;
    readonly correctedCents: number;
    readonly netAmountCents: number;
    readonly method: PaymentMethod;
    readonly status: 'confirmed' | 'partially-corrected' | 'corrected';
    readonly registeredBy: string;
    readonly registrarUsername: string;
    readonly effectiveAt: Date;
    readonly corrections: readonly {
      readonly id: string;
      readonly amountCents: number;
      readonly reason: string;
      readonly correctedBy: string;
      readonly actorUsername: string;
      readonly effectiveAt: Date;
    }[];
  }[];
}

export interface SaleDetailSource {
  findById(saleId: string): Promise<SaleDetailRecord | null>;
}

export type SaleDetail = Omit<SaleDetailRecord, 'paymentAmountsCents' | 'refundAmountsCents'> &
  SaleTracking & {
    readonly lines: readonly (SaleDetailRecord['lines'][number] & {
      readonly allocatedCostCents: number | null;
    })[];
  };

export type GetSaleDetailResult =
  | { readonly ok: true; readonly sale: SaleDetail }
  | { readonly ok: false; readonly reason: 'sale-not-found' | 'not-owner' };

export class GetSaleDetail {
  constructor(
    private readonly source: SaleDetailSource,
    private readonly clock: SaleClock,
  ) {}

  async execute(input: {
    saleId: string;
    actorId: string;
    canReadAny: boolean;
    canReadCost: boolean;
  }): Promise<GetSaleDetailResult> {
    const record = await this.source.findById(input.saleId);
    if (record === null) return { ok: false, reason: 'sale-not-found' };
    if (record.createdBy !== input.actorId && !input.canReadAny) {
      return { ok: false, reason: 'not-owner' };
    }
    const tracking = deriveSaleTracking({
      lifecycle: record.lifecycle,
      currentTotalCents: record.currentTotalCents,
      paymentAmountsCents: record.paymentAmountsCents,
      refundAmountsCents: record.refundAmountsCents,
      forgivenAmountCents: record.forgivenAmountCents,
      lineQuantities: record.lines.map((line) => ({
        quantity: line.quantity,
        deliveredQuantity: line.deliveryQuantity,
      })),
      dueDate: record.dueDate,
      todayInLima: limaCivilDate(this.clock.now()),
    });
    const {
      paymentAmountsCents: _paymentAmountsCents,
      refundAmountsCents: _refundAmountsCents,
      ...detail
    } = record;
    void _paymentAmountsCents;
    void _refundAmountsCents;
    return {
      ok: true,
      sale: {
        ...detail,
        ...tracking,
        lines: record.lines.map((line) => ({
          ...line,
          allocatedCostCents: input.canReadCost ? line.allocatedCostCents : null,
        })),
        returns: record.returns.map((saleReturn) => ({
          ...saleReturn,
          lines: saleReturn.lines.map((line) => ({
            ...line,
            attributedCostCents: input.canReadCost ? line.attributedCostCents : null,
          })),
        })),
        deliveries: record.deliveries.map((delivery) => ({
          ...delivery,
          lines: delivery.lines.map((line) => ({
            ...line,
            consumedCostCents: input.canReadCost ? line.consumedCostCents : null,
          })),
        })),
        cancellation:
          record.cancellation === null
            ? null
            : {
                ...record.cancellation,
                lines: record.cancellation.lines.map((line) => ({
                  ...line,
                  releasedCostCents: input.canReadCost ? line.releasedCostCents : null,
                  attributedReturnedCostCents: input.canReadCost
                    ? line.attributedReturnedCostCents
                    : null,
                })),
              },
      },
    };
  }
}
