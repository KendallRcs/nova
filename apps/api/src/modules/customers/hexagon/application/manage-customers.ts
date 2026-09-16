import { Customer, normalizeCustomerPhone } from '../domain/customer';
import type { CustomerClock, CustomerIdGenerator } from './customer.dependencies';
import { CustomerPhoneAlreadyExistsError, type CustomerRepository } from './customer.repository';
import { toCustomerView, type CustomerView } from './customer.view';

export interface CustomerDataCommand {
  name: string;
  phone: string;
  dni?: string | null;
  address?: string | null;
}

export class RegisterCustomer {
  constructor(
    private readonly repository: CustomerRepository,
    private readonly ids: CustomerIdGenerator,
    private readonly clock: CustomerClock,
  ) {}
  async execute(command: CustomerDataCommand): Promise<CustomerView> {
    const phone = normalizeCustomerPhone(command.phone);
    const existing = await this.repository.findCanonicalByPhone(phone);
    if (existing !== null) throw new CustomerPhoneAlreadyExistsError(existing.toPrimitives().id);
    const customer = Customer.register({
      ...command,
      id: this.ids.generate(),
      now: this.clock.now(),
    });
    await this.repository.save(customer);
    return toCustomerView(customer);
  }
}

export type UpdateCustomerResult =
  | { readonly ok: true; readonly customer: CustomerView }
  | {
      readonly ok: false;
      readonly reason: 'customer-not-found' | 'customer-merged' | 'version-conflict';
    };

export class UpdateCustomer {
  constructor(
    private readonly repository: CustomerRepository,
    private readonly clock: CustomerClock,
  ) {}
  async execute(
    command: CustomerDataCommand & { id: string; expectedVersion: number },
  ): Promise<UpdateCustomerResult> {
    const customer = await this.repository.findById(command.id);
    if (customer === null) return { ok: false, reason: 'customer-not-found' };
    if (customer.toPrimitives().status !== 'active')
      return { ok: false, reason: 'customer-merged' };
    const phone = normalizeCustomerPhone(command.phone);
    const owner = await this.repository.findCanonicalByPhone(phone);
    if (owner !== null && owner.toPrimitives().id !== command.id)
      throw new CustomerPhoneAlreadyExistsError(owner.toPrimitives().id);
    customer.update({ ...command, now: this.clock.now() });
    return (await this.repository.update(customer, command.expectedVersion))
      ? { ok: true, customer: toCustomerView(customer) }
      : { ok: false, reason: 'version-conflict' };
  }
}

export class SearchCustomers {
  constructor(private readonly repository: CustomerRepository) {}
  async execute(query?: string): Promise<readonly CustomerView[]> {
    const normalizedQuery = query?.trim();
    return (
      await this.repository.search(
        normalizedQuery === undefined || normalizedQuery.length === 0 ? undefined : normalizedQuery,
        50,
      )
    ).map(toCustomerView);
  }
}
