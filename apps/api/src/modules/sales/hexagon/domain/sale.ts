export type SaleLifecycle = 'draft' | 'confirmed' | 'finalized' | 'cancelled';
export type PaymentMethod = 'cash' | 'yape' | 'plin' | 'pos';
export type PaymentSituation = 'unpaid' | 'partial' | 'paid';

export interface SaleDraftLineInput {
  productId: string;
  locationId: string;
  quantity: number;
  deliveryQuantity: number;
  reservationQuantity: number;
  agreedUnitPriceCents: number;
}

export interface SaleLineProperties extends SaleDraftLineInput {
  id: string;
  originalSubtotalCents: number;
  snapshot: SaleProductSnapshot | null;
  priceExceptionReason: string | null;
  priceApprovedBy: string | null;
  allocatedCostCents: number | null;
  costingPolicy: 'moving-average-v1' | null;
}

export interface SaleProductSnapshot {
  code: string;
  name: string;
  minimumPriceCents: number;
  suggestedPriceCents: number | null;
  maximumPriceCents: number | null;
}

export interface SaleProperties {
  id: string;
  createdBy: string;
  customerId: string | null;
  lifecycle: SaleLifecycle;
  originalTotalCents: number;
  currentTotalCents: number;
  dueDate: string | null;
  paymentAgreementNote: string | null;
  lines: readonly SaleLineProperties[];
  payments: readonly SalePaymentProperties[];
  totalAdjustments: readonly SaleTotalAdjustmentProperties[];
  closure: SaleClosureProperties | null;
  returns: readonly SaleReturnProperties[];
  version: number;
  confirmedAt: Date | null;
  finalizedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SalePaymentProperties {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  correctedCents: number;
  registeredBy: string;
  effectiveAt: Date;
}

export interface SaleTotalAdjustmentProperties {
  id: string;
  previousTotalCents: number;
  newTotalCents: number;
  differenceCents: number;
  reason: string;
  changedBy: string;
  effectiveAt: Date;
}

export interface SaleClosureProperties {
  id: string;
  type: 'complete' | 'incomplete';
  forgivenAmountCents: number;
  reason: string | null;
  closedBy: string;
  effectiveAt: Date;
}

export interface SaleReturnLineProperties {
  id: string;
  saleLineId: string;
  quantity: number;
  commercialReductionCents: number;
  productReturns: boolean;
  returnLocationId: string | null;
  condition: 'available' | 'review' | null;
  attributedCostCents: number;
}

export interface SaleReturnProperties {
  id: string;
  reason: string;
  commercialReductionCents: number;
  refundAmountCents: number;
  refundMethod: PaymentMethod | null;
  approvedBy: string;
  effectiveAt: Date;
  lines: readonly SaleReturnLineProperties[];
}

export type ComposeSaleDraftResult =
  | { readonly ok: true; readonly sale: Sale }
  | {
      readonly ok: false;
      readonly reason:
        | 'duplicate-product'
        | 'invalid-quantity'
        | 'invalid-fulfillment'
        | 'invalid-price'
        | 'invalid-total'
        | 'invalid-due-date'
        | 'sale-not-draft';
      readonly productId?: string;
    };

export type ConfirmSaleResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | 'sale-not-draft'
        | 'empty-sale'
        | 'customer-required'
        | 'invalid-payment'
        | 'payment-exceeds-balance'
        | 'product-not-found'
        | 'price-approval-required'
        | 'price-exception-reason-required';
      readonly productId?: string;
    };

export type RegisterSalePaymentResult =
  | {
      readonly ok: true;
      readonly paidCents: number;
      readonly balanceCents: number;
      readonly paymentSituation: 'partial' | 'paid';
    }
  | {
      readonly ok: false;
      readonly reason:
        'sale-not-payable' | 'not-owner' | 'invalid-payment' | 'payment-exceeds-balance';
      readonly balanceCents?: number;
    };

export type AdjustSaleTotalResult =
  | {
      readonly ok: true;
      readonly previousTotalCents: number;
      readonly currentTotalCents: number;
      readonly differenceCents: number;
      readonly paidCents: number;
      readonly balanceCents: number;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'sale-not-adjustable'
        | 'not-authorized'
        | 'invalid-total'
        | 'reason-required'
        | 'total-below-paid'
        | 'customer-required';
      readonly paidCents?: number;
    };

export type FinalizeSaleResult =
  | {
      readonly ok: true;
      readonly closureType: 'complete' | 'incomplete';
      readonly forgivenAmountCents: number;
    }
  | {
      readonly ok: false;
      readonly reason: 'sale-not-finalizable' | 'not-authorized' | 'reason-required';
    };

export type CorrectSalePaymentResult =
  | {
      readonly ok: true;
      readonly correctedCents: number;
      readonly remainingCorrectableCents: number;
      readonly paidCents: number;
      readonly balanceCents: number;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'sale-not-correctable'
        | 'not-authorized'
        | 'payment-not-found'
        | 'invalid-correction'
        | 'reason-required'
        | 'correction-exceeds-payment'
        | 'customer-required';
      readonly correctableCents?: number;
    };

export type ApproveSaleReturnResult =
  | {
      readonly ok: true;
      readonly commercialReductionCents: number;
      readonly refundAmountCents: number;
      readonly currentTotalCents: number;
      readonly paidCents: number;
      readonly balanceCents: number;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'sale-not-returnable'
        | 'not-authorized'
        | 'reason-required'
        | 'empty-return'
        | 'duplicate-line'
        | 'sale-line-not-found'
        | 'invalid-quantity'
        | 'quantity-exceeds-delivered'
        | 'invalid-return-treatment'
        | 'cost-unavailable'
        | 'refund-method-required';
      readonly saleLineId?: string;
      readonly returnableQuantity?: number;
    };

export class Sale {
  private constructor(private properties: SaleProperties) {}

  static createDraft(input: {
    id: string;
    createdBy: string;
    customerId?: string | null;
    dueDate?: string | null;
    paymentAgreementNote?: string | null;
    lines: readonly (SaleDraftLineInput & { id: string })[];
    now: Date;
  }): ComposeSaleDraftResult {
    return compose({
      id: input.id,
      createdBy: input.createdBy,
      customerId: input.customerId ?? null,
      lifecycle: 'draft',
      dueDate: input.dueDate ?? null,
      paymentAgreementNote: input.paymentAgreementNote ?? null,
      lines: input.lines,
      payments: [],
      totalAdjustments: [],
      closure: null,
      returns: [],
      version: 1,
      confirmedAt: null,
      finalizedAt: null,
      cancelledAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(properties: SaleProperties): Sale {
    return new Sale({
      ...properties,
      lines: properties.lines.map((line) => ({ ...line })),
      payments: properties.payments.map((payment) => ({ ...payment })),
      totalAdjustments: properties.totalAdjustments.map((adjustment) => ({ ...adjustment })),
      closure: properties.closure === null ? null : { ...properties.closure },
      returns: properties.returns.map((saleReturn) => ({
        ...saleReturn,
        lines: saleReturn.lines.map((line) => ({ ...line })),
      })),
    });
  }

  reviseDraft(input: {
    customerId?: string | null;
    dueDate?: string | null;
    paymentAgreementNote?: string | null;
    lines: readonly (SaleDraftLineInput & { id: string })[];
    now: Date;
  }): ComposeSaleDraftResult {
    if (this.properties.lifecycle !== 'draft') return { ok: false, reason: 'sale-not-draft' };
    const revised = compose({
      ...this.properties,
      customerId: input.customerId ?? null,
      dueDate: input.dueDate ?? null,
      paymentAgreementNote: input.paymentAgreementNote ?? null,
      lines: input.lines,
      version: this.properties.version + 1,
      confirmedAt: this.properties.confirmedAt,
      updatedAt: input.now,
    });
    if (revised.ok) this.properties = revised.sale.toPrimitives();
    return revised.ok ? { ok: true, sale: this } : revised;
  }

  confirm(input: {
    customerId: string | null;
    productSnapshots: ReadonlyMap<string, SaleProductSnapshot>;
    priceExceptionReasons: ReadonlyMap<string, string>;
    confirmedBy: string;
    canApprovePriceException: boolean;
    initialPayment: Omit<SalePaymentProperties, 'correctedCents'> | null;
    now: Date;
  }): ConfirmSaleResult {
    if (this.properties.lifecycle !== 'draft') return { ok: false, reason: 'sale-not-draft' };
    if (this.properties.lines.length === 0) return { ok: false, reason: 'empty-sale' };
    const initialPaymentCents = input.initialPayment?.amountCents ?? 0;
    if (
      input.initialPayment !== null &&
      (!Number.isSafeInteger(initialPaymentCents) || initialPaymentCents <= 0)
    ) {
      return { ok: false, reason: 'invalid-payment' };
    }
    if (initialPaymentCents > this.properties.currentTotalCents) {
      return { ok: false, reason: 'payment-exceeds-balance' };
    }
    if (this.properties.currentTotalCents - initialPaymentCents > 0 && input.customerId === null) {
      return { ok: false, reason: 'customer-required' };
    }
    const confirmedLines: SaleLineProperties[] = [];
    for (const line of this.properties.lines) {
      const snapshot = input.productSnapshots.get(line.productId);
      if (snapshot === undefined) {
        return { ok: false, reason: 'product-not-found', productId: line.productId };
      }
      let reason: string | null = null;
      let approvedBy: string | null = null;
      if (line.agreedUnitPriceCents < snapshot.minimumPriceCents) {
        if (!input.canApprovePriceException) {
          return { ok: false, reason: 'price-approval-required', productId: line.productId };
        }
        reason = normalizeOptional(input.priceExceptionReasons.get(line.id) ?? null);
        if (reason === null) {
          return {
            ok: false,
            reason: 'price-exception-reason-required',
            productId: line.productId,
          };
        }
        approvedBy = input.confirmedBy;
      }
      confirmedLines.push({
        ...line,
        snapshot,
        priceExceptionReason: reason,
        priceApprovedBy: approvedBy,
      });
    }
    this.properties = {
      ...this.properties,
      customerId: input.customerId,
      lifecycle: 'confirmed',
      lines: confirmedLines,
      payments:
        input.initialPayment === null
          ? this.properties.payments
          : [...this.properties.payments, { ...input.initialPayment, correctedCents: 0 }],
      version: this.properties.version + 1,
      confirmedAt: input.now,
      updatedAt: input.now,
    };
    return { ok: true };
  }

  registerPayment(input: {
    payment: Omit<SalePaymentProperties, 'correctedCents'>;
    actorId: string;
    canRegisterAny: boolean;
    now: Date;
  }): RegisterSalePaymentResult {
    if (this.properties.lifecycle !== 'confirmed') {
      return { ok: false, reason: 'sale-not-payable' };
    }
    if (this.properties.createdBy !== input.actorId && !input.canRegisterAny) {
      return { ok: false, reason: 'not-owner' };
    }
    if (!Number.isSafeInteger(input.payment.amountCents) || input.payment.amountCents <= 0) {
      return { ok: false, reason: 'invalid-payment' };
    }
    const balanceBefore = this.balanceCents();
    if (input.payment.amountCents > balanceBefore) {
      return { ok: false, reason: 'payment-exceeds-balance', balanceCents: balanceBefore };
    }
    const payments = [...this.properties.payments, { ...input.payment, correctedCents: 0 }];
    const paidCents = payments.reduce(
      (sum, payment) => sum + payment.amountCents - payment.correctedCents,
      0,
    );
    const balanceCents = this.properties.currentTotalCents - paidCents;
    this.properties = {
      ...this.properties,
      payments,
      version: this.properties.version + 1,
      updatedAt: input.now,
    };
    return {
      ok: true,
      paidCents,
      balanceCents,
      paymentSituation: balanceCents === 0 ? 'paid' : 'partial',
    };
  }

  adjustTotal(input: {
    adjustment: Omit<SaleTotalAdjustmentProperties, 'previousTotalCents' | 'differenceCents'>;
    canAdjust: boolean;
    now: Date;
  }): AdjustSaleTotalResult {
    if (this.properties.lifecycle !== 'confirmed' || this.properties.closure !== null) {
      return { ok: false, reason: 'sale-not-adjustable' };
    }
    if (!input.canAdjust) return { ok: false, reason: 'not-authorized' };
    if (
      !Number.isSafeInteger(input.adjustment.newTotalCents) ||
      input.adjustment.newTotalCents < 0
    ) {
      return { ok: false, reason: 'invalid-total' };
    }
    const reason = normalizeOptional(input.adjustment.reason);
    if (reason === null) return { ok: false, reason: 'reason-required' };
    const paidCents = this.netPaidCents();
    if (input.adjustment.newTotalCents < paidCents) {
      return { ok: false, reason: 'total-below-paid', paidCents };
    }
    if (input.adjustment.newTotalCents > paidCents && this.properties.customerId === null) {
      return { ok: false, reason: 'customer-required' };
    }
    const previousTotalCents = this.properties.currentTotalCents;
    const differenceCents = input.adjustment.newTotalCents - previousTotalCents;
    const adjustment: SaleTotalAdjustmentProperties = {
      ...input.adjustment,
      reason,
      previousTotalCents,
      differenceCents,
    };
    this.properties = {
      ...this.properties,
      currentTotalCents: adjustment.newTotalCents,
      totalAdjustments: [...this.properties.totalAdjustments, adjustment],
      version: this.properties.version + 1,
      updatedAt: input.now,
    };
    return {
      ok: true,
      previousTotalCents,
      currentTotalCents: adjustment.newTotalCents,
      differenceCents,
      paidCents,
      balanceCents: adjustment.newTotalCents - paidCents,
    };
  }

  finalize(input: {
    closure: Omit<SaleClosureProperties, 'type' | 'forgivenAmountCents' | 'reason'> & {
      reason: string | null;
    };
    canFinalize: boolean;
    now: Date;
  }): FinalizeSaleResult {
    if (this.properties.lifecycle !== 'confirmed' || this.properties.closure !== null) {
      return { ok: false, reason: 'sale-not-finalizable' };
    }
    if (!input.canFinalize) return { ok: false, reason: 'not-authorized' };
    const balanceCents = this.balanceCents();
    const reason = normalizeOptional(input.closure.reason);
    if (balanceCents > 0 && reason === null) {
      return { ok: false, reason: 'reason-required' };
    }
    const closure: SaleClosureProperties = {
      ...input.closure,
      type: balanceCents === 0 ? 'complete' : 'incomplete',
      forgivenAmountCents: balanceCents,
      reason: balanceCents === 0 ? null : reason,
    };
    this.properties = {
      ...this.properties,
      lifecycle: 'finalized',
      closure,
      version: this.properties.version + 1,
      finalizedAt: input.now,
      updatedAt: input.now,
    };
    return {
      ok: true,
      closureType: closure.type,
      forgivenAmountCents: closure.forgivenAmountCents,
    };
  }

  correctPayment(input: {
    paymentId: string;
    amountCents: number;
    reason: string;
    canCorrect: boolean;
    now: Date;
  }): CorrectSalePaymentResult {
    if (this.properties.lifecycle !== 'confirmed') {
      return { ok: false, reason: 'sale-not-correctable' };
    }
    if (!input.canCorrect) return { ok: false, reason: 'not-authorized' };
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
      return { ok: false, reason: 'invalid-correction' };
    }
    if (normalizeOptional(input.reason) === null) {
      return { ok: false, reason: 'reason-required' };
    }
    const payment = this.properties.payments.find((candidate) => candidate.id === input.paymentId);
    if (payment === undefined) return { ok: false, reason: 'payment-not-found' };
    const correctableCents = payment.amountCents - payment.correctedCents;
    if (input.amountCents > correctableCents) {
      return { ok: false, reason: 'correction-exceeds-payment', correctableCents };
    }
    if (this.properties.customerId === null) {
      return { ok: false, reason: 'customer-required' };
    }
    const payments = this.properties.payments.map((candidate) =>
      candidate.id === input.paymentId
        ? { ...candidate, correctedCents: candidate.correctedCents + input.amountCents }
        : candidate,
    );
    this.properties = {
      ...this.properties,
      payments,
      version: this.properties.version + 1,
      updatedAt: input.now,
    };
    const paidCents = this.netPaidCents();
    return {
      ok: true,
      correctedCents: payment.correctedCents + input.amountCents,
      remainingCorrectableCents: correctableCents - input.amountCents,
      paidCents,
      balanceCents: this.balanceCents(),
    };
  }

  approveReturn(input: {
    saleReturn: {
      id: string;
      reason: string;
      refundMethod: PaymentMethod | null;
      approvedBy: string;
      effectiveAt: Date;
      lines: readonly {
        id: string;
        saleLineId: string;
        quantity: number;
        productReturns: boolean;
        returnLocationId: string | null;
        condition: 'available' | 'review' | null;
      }[];
    };
    canApprove: boolean;
    now: Date;
  }): ApproveSaleReturnResult {
    if (this.properties.lifecycle !== 'confirmed' && this.properties.lifecycle !== 'finalized') {
      return { ok: false, reason: 'sale-not-returnable' };
    }
    if (!input.canApprove) return { ok: false, reason: 'not-authorized' };
    const reason = normalizeOptional(input.saleReturn.reason);
    if (reason === null) return { ok: false, reason: 'reason-required' };
    if (input.saleReturn.lines.length === 0) return { ok: false, reason: 'empty-return' };
    const seen = new Set<string>();
    const lines: SaleReturnLineProperties[] = [];
    let commercialReductionCents = 0;
    for (const requested of input.saleReturn.lines) {
      if (seen.has(requested.saleLineId)) {
        return { ok: false, reason: 'duplicate-line', saleLineId: requested.saleLineId };
      }
      seen.add(requested.saleLineId);
      const saleLine = this.properties.lines.find(({ id }) => id === requested.saleLineId);
      if (saleLine === undefined) {
        return { ok: false, reason: 'sale-line-not-found', saleLineId: requested.saleLineId };
      }
      if (!Number.isSafeInteger(requested.quantity) || requested.quantity <= 0) {
        return { ok: false, reason: 'invalid-quantity', saleLineId: requested.saleLineId };
      }
      const previousLines = this.properties.returns.flatMap((saleReturn) => saleReturn.lines);
      const previouslyReturnedQuantity = previousLines
        .filter(({ saleLineId }) => saleLineId === requested.saleLineId)
        .reduce((sum, line) => sum + line.quantity, 0);
      const returnableQuantity = saleLine.deliveryQuantity - previouslyReturnedQuantity;
      if (requested.quantity > returnableQuantity) {
        return {
          ok: false,
          reason: 'quantity-exceeds-delivered',
          saleLineId: requested.saleLineId,
          returnableQuantity,
        };
      }
      if (
        (requested.productReturns &&
          (requested.returnLocationId === null || requested.condition === null)) ||
        (!requested.productReturns &&
          (requested.returnLocationId !== null || requested.condition !== null))
      ) {
        return { ok: false, reason: 'invalid-return-treatment', saleLineId: requested.saleLineId };
      }
      if (saleLine.allocatedCostCents === null) {
        return { ok: false, reason: 'cost-unavailable', saleLineId: requested.saleLineId };
      }
      const previouslyReturnedCost = previousLines
        .filter(({ saleLineId }) => saleLineId === requested.saleLineId)
        .reduce((sum, line) => sum + line.attributedCostCents, 0);
      const cumulativeCost = proportionalCents(
        saleLine.allocatedCostCents,
        previouslyReturnedQuantity + requested.quantity,
        saleLine.deliveryQuantity + saleLine.reservationQuantity,
      );
      const reduction = safeMoneyMultiply(saleLine.agreedUnitPriceCents, requested.quantity);
      commercialReductionCents = safeMoneyAdd(commercialReductionCents, reduction);
      lines.push({
        ...requested,
        commercialReductionCents: reduction,
        attributedCostCents: cumulativeCost - previouslyReturnedCost,
      });
    }
    if (commercialReductionCents > this.properties.currentTotalCents) {
      return { ok: false, reason: 'invalid-quantity' };
    }
    const currentTotalCents = this.properties.currentTotalCents - commercialReductionCents;
    const paidBeforeCents = this.netPaidCents();
    const refundAmountCents = Math.max(0, paidBeforeCents - currentTotalCents);
    if (refundAmountCents > 0 && input.saleReturn.refundMethod === null) {
      return { ok: false, reason: 'refund-method-required' };
    }
    const saleReturn: SaleReturnProperties = {
      id: input.saleReturn.id,
      reason,
      commercialReductionCents,
      refundAmountCents,
      refundMethod: refundAmountCents === 0 ? null : input.saleReturn.refundMethod,
      approvedBy: input.saleReturn.approvedBy,
      effectiveAt: input.saleReturn.effectiveAt,
      lines,
    };
    this.properties = {
      ...this.properties,
      currentTotalCents,
      returns: [...this.properties.returns, saleReturn],
      version: this.properties.version + 1,
      updatedAt: input.now,
    };
    const paidCents = this.netPaidCents();
    return {
      ok: true,
      commercialReductionCents,
      refundAmountCents,
      currentTotalCents,
      paidCents,
      balanceCents: this.balanceCents(),
    };
  }

  balanceCents(): number {
    return Math.max(
      0,
      this.properties.currentTotalCents -
        this.netPaidCents() -
        (this.properties.closure?.forgivenAmountCents ?? 0),
    );
  }

  netPaidCents(): number {
    const payments = this.properties.payments.reduce(
      (sum, payment) => sum + payment.amountCents - payment.correctedCents,
      0,
    );
    return (
      payments -
      this.properties.returns.reduce((sum, saleReturn) => sum + saleReturn.refundAmountCents, 0)
    );
  }

  attributeConfirmedCost(lineId: string, costCents: number): void {
    if (
      this.properties.lifecycle !== 'confirmed' ||
      !Number.isSafeInteger(costCents) ||
      costCents < 0
    ) {
      throw new Error('Cannot attribute an invalid sale cost.');
    }
    this.properties = {
      ...this.properties,
      lines: this.properties.lines.map((line) =>
        line.id === lineId
          ? { ...line, allocatedCostCents: costCents, costingPolicy: 'moving-average-v1' }
          : line,
      ),
    };
  }

  toPrimitives(): SaleProperties {
    return {
      ...this.properties,
      lines: this.properties.lines.map((line) => ({ ...line })),
      payments: this.properties.payments.map((payment) => ({ ...payment })),
      totalAdjustments: this.properties.totalAdjustments.map((adjustment) => ({ ...adjustment })),
      closure: this.properties.closure === null ? null : { ...this.properties.closure },
      returns: this.properties.returns.map((saleReturn) => ({
        ...saleReturn,
        lines: saleReturn.lines.map((line) => ({ ...line })),
      })),
    };
  }
}

function compose(
  input: Omit<SaleProperties, 'originalTotalCents' | 'currentTotalCents' | 'lines'> & {
    lines: readonly (SaleDraftLineInput & { id: string })[];
  },
): ComposeSaleDraftResult {
  if (input.dueDate !== null && !isCivilDate(input.dueDate)) {
    return { ok: false, reason: 'invalid-due-date' };
  }
  const seen = new Set<string>();
  const lines: SaleLineProperties[] = [];
  let total = 0;
  for (const line of input.lines) {
    if (seen.has(line.productId)) {
      return { ok: false, reason: 'duplicate-product', productId: line.productId };
    }
    seen.add(line.productId);
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity', productId: line.productId };
    }
    if (
      !Number.isSafeInteger(line.deliveryQuantity) ||
      !Number.isSafeInteger(line.reservationQuantity) ||
      line.deliveryQuantity < 0 ||
      line.reservationQuantity < 0 ||
      line.deliveryQuantity + line.reservationQuantity > line.quantity
    ) {
      return { ok: false, reason: 'invalid-fulfillment', productId: line.productId };
    }
    if (!Number.isSafeInteger(line.agreedUnitPriceCents) || line.agreedUnitPriceCents < 0) {
      return { ok: false, reason: 'invalid-price', productId: line.productId };
    }
    const subtotal = line.quantity * line.agreedUnitPriceCents;
    if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(total + subtotal)) {
      return { ok: false, reason: 'invalid-total', productId: line.productId };
    }
    total += subtotal;
    lines.push({
      ...line,
      originalSubtotalCents: subtotal,
      snapshot: null,
      priceExceptionReason: null,
      priceApprovedBy: null,
      allocatedCostCents: null,
      costingPolicy: null,
    });
  }
  const note = normalizeOptional(input.paymentAgreementNote);
  return {
    ok: true,
    sale: Sale.restore({
      ...input,
      paymentAgreementNote: note,
      lines,
      originalTotalCents: total,
      currentTotalCents: total,
    }),
  };
}

function normalizeOptional(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length === 0 ? null : normalized;
}

function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function proportionalCents(valueCents: number, quantity: number, totalQuantity: number): number {
  if (quantity === totalQuantity) return valueCents;
  const value = (BigInt(valueCents) * BigInt(quantity)) / BigInt(totalQuantity);
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Sale return cost exceeds safe range.');
  return result;
}

function safeMoneyMultiply(value: number, quantity: number): number {
  const result = value * quantity;
  if (!Number.isSafeInteger(result)) throw new Error('Sale return amount exceeds safe range.');
  return result;
}

function safeMoneyAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error('Sale return amount exceeds safe range.');
  return result;
}
