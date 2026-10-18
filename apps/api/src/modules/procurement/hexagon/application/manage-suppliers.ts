import type { ProcurementClock, ProcurementIdGenerator } from './procurement.dependencies';
import type { SupplierRepository } from './supplier.repository';
import { Supplier, type SupplierKind } from '../domain/supplier';

export interface SupplierView {
  id: string;
  name: string;
  kind: SupplierKind;
  phone: string | null;
  document: string | null;
  description: string | null;
  status: 'active' | 'inactive';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class RegisterSupplier {
  constructor(
    private readonly suppliers: SupplierRepository,
    private readonly ids: ProcurementIdGenerator,
    private readonly clock: ProcurementClock,
  ) {}

  async execute(command: {
    name: string;
    kind: SupplierKind;
    phone?: string | null;
    document?: string | null;
    description?: string | null;
  }): Promise<SupplierView> {
    const supplier = Supplier.register({
      ...command,
      id: this.ids.generate(),
      now: this.clock.now(),
    });
    await this.suppliers.save(supplier);
    return view(supplier);
  }
}

export class SearchSuppliers {
  constructor(private readonly suppliers: SupplierRepository) {}

  async execute(query?: string): Promise<readonly SupplierView[]> {
    const normalized = query?.trim();
    return (await this.suppliers.search(normalized === '' ? undefined : normalized, 50)).map(view);
  }
}

function view(supplier: Supplier): SupplierView {
  const values = supplier.toPrimitives();
  return {
    id: values.id,
    name: values.name,
    kind: values.kind,
    phone: values.phone,
    document: values.document,
    description: values.description,
    status: values.status,
    version: values.version,
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  };
}
