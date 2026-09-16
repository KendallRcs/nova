import type { Sale } from '../domain/sale';

export interface SaleDraftRepository {
  findById(id: string): Promise<Sale | null>;
  create(sale: Sale): Promise<void>;
  update(sale: Sale, expectedVersion: number): Promise<boolean>;
}

export type SaleDraftReferencesResult =
  | { readonly ok: true; readonly canonicalCustomerId: string | null }
  | {
      readonly ok: false;
      readonly reason: 'customer-not-found' | 'product-not-found' | 'location-not-found';
      readonly referenceId: string;
    };

export interface SaleDraftReferences {
  validate(input: {
    customerId: string | null;
    lines: readonly { productId: string; locationId: string }[];
  }): Promise<SaleDraftReferencesResult>;
}
