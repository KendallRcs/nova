export type SaleLifecycle = 'draft' | 'confirmed' | 'finalized' | 'cancelled';

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
  version: number;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
        | 'product-not-found'
        | 'price-approval-required'
        | 'price-exception-reason-required';
      readonly productId?: string;
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
      version: 1,
      confirmedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(properties: SaleProperties): Sale {
    return new Sale({ ...properties, lines: properties.lines.map((line) => ({ ...line })) });
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
      confirmedAt: input.now,
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
    now: Date;
  }): ConfirmSaleResult {
    if (this.properties.lifecycle !== 'draft') return { ok: false, reason: 'sale-not-draft' };
    if (this.properties.lines.length === 0) return { ok: false, reason: 'empty-sale' };
    if (this.properties.currentTotalCents > 0 && input.customerId === null) {
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
      version: this.properties.version + 1,
      updatedAt: input.now,
    };
    return { ok: true };
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
    return { ...this.properties, lines: this.properties.lines.map((line) => ({ ...line })) };
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
