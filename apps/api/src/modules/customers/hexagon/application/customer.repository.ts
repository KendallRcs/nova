import type { Customer } from '../domain/customer';

export class CustomerPhoneAlreadyExistsError extends Error {
  constructor(readonly customerId?: string) {
    super('Ya existe un cliente con ese teléfono.');
    this.name = 'CustomerPhoneAlreadyExistsError';
  }
}

export interface CustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findCanonicalByPhone(phoneNormalized: string): Promise<Customer | null>;
  search(query: string | undefined, limit: number): Promise<Customer[]>;
  save(customer: Customer): Promise<void>;
  update(customer: Customer, expectedVersion: number): Promise<boolean>;
}
