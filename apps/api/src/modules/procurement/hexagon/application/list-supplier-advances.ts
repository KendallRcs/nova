import type { ProcurementPaymentMethod } from '../domain/supplier-advance';

export type SupplierAdvanceStatusFilter = 'pending' | 'resolved';

export interface SupplierAdvanceListItem {
  readonly id: string;
  readonly supplierId: string;
  readonly supplierName: string;
  readonly originalAmountCents: number;
  readonly currentBalanceCents: number;
  readonly method: ProcurementPaymentMethod;
  readonly purpose: string | null;
  readonly status: SupplierAdvanceStatusFilter;
  readonly version: number;
  readonly registeredBy: string;
  readonly effectiveAt: Date;
}

export interface SupplierAdvanceDirectory {
  list(filter: {
    supplierId?: string;
    status?: SupplierAdvanceStatusFilter;
  }): Promise<readonly SupplierAdvanceListItem[]>;
}

export class ListSupplierAdvances {
  constructor(private readonly directory: SupplierAdvanceDirectory) {}

  execute(filter: {
    supplierId?: string;
    status?: SupplierAdvanceStatusFilter;
  }): Promise<readonly SupplierAdvanceListItem[]> {
    return this.directory.list(filter);
  }
}
