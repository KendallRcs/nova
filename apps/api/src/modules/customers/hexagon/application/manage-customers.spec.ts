import { describe, expect, it } from 'vitest';

import { Customer } from '../domain/customer';
import type { CustomerRepository } from './customer.repository';
import { RegisterCustomer, UpdateCustomer } from './manage-customers';

class FakeCustomers implements CustomerRepository {
  values: Customer[] = [];
  findById(id: string) {
    return Promise.resolve(this.values.find((value) => value.toPrimitives().id === id) ?? null);
  }
  findCanonicalByPhone(phone: string) {
    return Promise.resolve(
      this.values.find((value) => value.toPrimitives().phoneNormalized === phone) ?? null,
    );
  }
  search() {
    return Promise.resolve(this.values);
  }
  save(customer: Customer) {
    this.values.push(customer);
    return Promise.resolve();
  }
  update(_customer: Customer, expectedVersion: number) {
    return Promise.resolve(expectedVersion === 1);
  }
}
const clock = { now: () => new Date('2026-09-15T18:00:00.000Z') };

describe('customer management', () => {
  it('registers a customer through a provider-free repository port', async () => {
    const repository = new FakeCustomers();
    await expect(
      new RegisterCustomer(repository, { generate: () => 'customer-1' }, clock).execute({
        name: 'Ana',
        phone: '987654321',
      }),
    ).resolves.toMatchObject({ id: 'customer-1', phone: '+51987654321', dni: null });
  });

  it('returns the existing customer identity when a normalized phone is duplicated', async () => {
    const repository = new FakeCustomers();
    const register = new RegisterCustomer(repository, { generate: () => 'customer-1' }, clock);
    await register.execute({ name: 'Ana', phone: '987654321' });
    await expect(
      register.execute({ name: 'Otra Ana', phone: '+51 987-654-321' }),
    ).rejects.toMatchObject({ customerId: 'customer-1' });
  });

  it('rejects an update based on a stale version', async () => {
    const repository = new FakeCustomers();
    repository.values.push(
      Customer.register({ id: 'customer-1', name: 'Ana', phone: '987654321', now: clock.now() }),
    );
    await expect(
      new UpdateCustomer(repository, clock).execute({
        id: 'customer-1',
        name: 'Ana',
        phone: '987654321',
        expectedVersion: 0,
      }),
    ).resolves.toEqual({ ok: false, reason: 'version-conflict' });
  });
});
