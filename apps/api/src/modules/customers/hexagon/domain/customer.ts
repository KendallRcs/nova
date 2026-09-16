export type CustomerStatus = 'active' | 'merged';

export class InvalidCustomerNameError extends Error {
  constructor() {
    super('El nombre del cliente es obligatorio.');
    this.name = 'InvalidCustomerNameError';
  }
}
export class InvalidCustomerPhoneError extends Error {
  constructor() {
    super('El teléfono debe ser un celular peruano válido o un número internacional E.164.');
    this.name = 'InvalidCustomerPhoneError';
  }
}
export class InvalidCustomerDniError extends Error {
  constructor() {
    super('El DNI debe contener exactamente 8 dígitos.');
    this.name = 'InvalidCustomerDniError';
  }
}

export interface CustomerProperties {
  id: string;
  name: string;
  nameNormalized: string;
  phoneNormalized: string;
  dni: string | null;
  address: string | null;
  status: CustomerStatus;
  mergedIntoCustomerId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerIdentity {
  name: string;
  nameNormalized: string;
  phoneNormalized: string;
  dni: string | null;
  address: string | null;
}

export type ResolveCustomerMergeResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'same-customer' | 'primary-not-active' | 'duplicate-not-active';
    };

export class Customer {
  private constructor(private properties: CustomerProperties) {}

  static register(input: {
    id: string;
    name: string;
    phone: string;
    dni?: string | null;
    address?: string | null;
    now: Date;
  }): Customer {
    const identity = normalizeCustomerIdentity(input);
    return new Customer({
      id: input.id,
      ...identity,
      status: 'active',
      mergedIntoCustomerId: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(properties: CustomerProperties): Customer {
    return new Customer({ ...properties });
  }

  update(input: {
    name: string;
    phone: string;
    dni?: string | null;
    address?: string | null;
    now: Date;
  }): void {
    if (this.properties.status !== 'active')
      throw new Error('A merged customer cannot be updated.');
    const identity = normalizeCustomerIdentity(input);
    this.properties = {
      ...this.properties,
      ...identity,
      version: this.properties.version + 1,
      updatedAt: input.now,
    };
  }

  static resolveMerge(input: {
    primary: Customer;
    duplicate: Customer;
    identity: CustomerIdentity;
    now: Date;
  }): ResolveCustomerMergeResult {
    const primary = input.primary.properties;
    const duplicate = input.duplicate.properties;
    if (primary.id === duplicate.id) return { ok: false, reason: 'same-customer' };
    if (primary.status !== 'active') return { ok: false, reason: 'primary-not-active' };
    if (duplicate.status !== 'active') return { ok: false, reason: 'duplicate-not-active' };
    input.duplicate.properties = {
      ...duplicate,
      status: 'merged',
      mergedIntoCustomerId: primary.id,
      version: duplicate.version + 1,
      updatedAt: input.now,
    };
    input.primary.properties = {
      ...primary,
      ...input.identity,
      version: primary.version + 1,
      updatedAt: input.now,
    };
    return { ok: true };
  }

  toPrimitives(): CustomerProperties {
    return { ...this.properties };
  }
}

export function normalizeCustomerName(value: string): string {
  return normalizeCustomerDisplayName(value).normalize('NFKC').toLocaleLowerCase('es-PE');
}

export function normalizeCustomerPhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('9')) return `+51${digits}`;
  if (digits.length === 11 && digits.startsWith('519')) return `+${digits}`;
  if (
    (trimmed.startsWith('+') || trimmed.startsWith('00')) &&
    digits.length >= 8 &&
    digits.length <= 15 &&
    !digits.startsWith('0')
  ) {
    return `+${digits}`;
  }
  throw new InvalidCustomerPhoneError();
}

export function normalizeCustomerIdentity(input: {
  name: string;
  phone: string;
  dni?: string | null;
  address?: string | null;
}): CustomerIdentity {
  const name = normalizeCustomerDisplayName(input.name);
  if (name.length === 0) throw new InvalidCustomerNameError();
  return {
    name,
    nameNormalized: normalizeCustomerName(name),
    phoneNormalized: normalizeCustomerPhone(input.phone),
    dni: normalizeDni(input.dni),
    address: normalizeOptionalText(input.address),
  };
}

function normalizeCustomerDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
function normalizeDni(value: string | null | undefined): string | null {
  const dni = normalizeOptionalText(value);
  if (dni === null) return null;
  if (!/^\d{8}$/.test(dni)) throw new InvalidCustomerDniError();
  return dni;
}
function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length === 0 ? null : normalized;
}
