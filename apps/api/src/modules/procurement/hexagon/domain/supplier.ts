export type SupplierKind = 'registered' | 'occasional';
export type SupplierStatus = 'active' | 'inactive';

export class InvalidSupplierNameError extends Error {
  constructor() {
    super('El nombre del proveedor es obligatorio.');
    this.name = 'InvalidSupplierNameError';
  }
}

export interface SupplierProperties {
  id: string;
  name: string;
  nameNormalized: string;
  kind: SupplierKind;
  phone: string | null;
  document: string | null;
  description: string | null;
  status: SupplierStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Supplier {
  private constructor(private readonly properties: SupplierProperties) {}

  static register(input: {
    id: string;
    name: string;
    kind: SupplierKind;
    phone?: string | null;
    document?: string | null;
    description?: string | null;
    now: Date;
  }): Supplier {
    const name = normalizeDisplayName(input.name);
    if (name.length === 0) throw new InvalidSupplierNameError();
    return new Supplier({
      id: input.id,
      name,
      nameNormalized: normalizeSupplierName(name),
      kind: input.kind,
      phone: optionalText(input.phone),
      document: optionalText(input.document),
      description: optionalText(input.description),
      status: 'active',
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(properties: SupplierProperties): Supplier {
    return new Supplier({ ...properties });
  }

  toPrimitives(): SupplierProperties {
    return { ...this.properties };
  }
}

export function normalizeSupplierName(value: string): string {
  return normalizeDisplayName(value).normalize('NFKC').toLocaleLowerCase('es-PE');
}

function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function optionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length === 0 ? null : normalized;
}
