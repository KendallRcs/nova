import type { Supplier } from '../domain/supplier';

export interface SupplierRepository {
  save(supplier: Supplier): Promise<void>;
  search(query: string | undefined, limit: number): Promise<readonly Supplier[]>;
}
