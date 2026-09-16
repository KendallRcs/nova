import { describe, expect, it } from 'vitest';

import { Customer, InvalidCustomerDniError, InvalidCustomerPhoneError } from './customer';

const now = new Date('2026-09-15T18:00:00.000Z');
describe('Customer', () => {
  it('normalizes equivalent Peruvian mobile numbers and optional data', () => {
    const customer = Customer.register({
      id: 'customer-1',
      name: '  María   Pérez ',
      phone: '987-654-321',
      dni: '',
      address: ' ',
      now,
    });
    expect(customer.toPrimitives()).toMatchObject({
      name: 'María Pérez',
      phoneNormalized: '+51987654321',
      dni: null,
      address: null,
      status: 'active',
      version: 1,
    });
  });

  it('accepts valid optional DNI and rejects invalid identity data', () => {
    expect(
      Customer.register({
        id: 'customer-1',
        name: 'Ana',
        phone: '+51 987 654 321',
        dni: '12345678',
        now,
      }).toPrimitives().dni,
    ).toBe('12345678');
    expect(() => Customer.register({ id: 'customer-2', name: 'Ana', phone: '123', now })).toThrow(
      InvalidCustomerPhoneError,
    );
    expect(() =>
      Customer.register({ id: 'customer-3', name: 'Ana', phone: '987654321', dni: '123', now }),
    ).toThrow(InvalidCustomerDniError);
  });

  it('increments its version when basic data changes', () => {
    const customer = Customer.register({ id: 'customer-1', name: 'Ana', phone: '987654321', now });
    customer.update({
      name: 'Ana Torres',
      phone: '986654321',
      address: 'Centro',
      now: new Date('2026-09-16T18:00:00.000Z'),
    });
    expect(customer.toPrimitives()).toMatchObject({
      name: 'Ana Torres',
      phoneNormalized: '+51986654321',
      address: 'Centro',
      version: 2,
    });
  });

  it('resolves a merge by updating the principal and retiring the duplicate', () => {
    const primary = Customer.register({ id: 'customer-1', name: 'Ana', phone: '987654321', now });
    const duplicate = Customer.register({
      id: 'customer-2',
      name: 'Anita',
      phone: '986654321',
      now,
    });
    const identity = {
      name: 'Ana Torres',
      nameNormalized: 'ana torres',
      phoneNormalized: '+51986654321',
      dni: '12345678',
      address: 'Centro',
    };
    expect(Customer.resolveMerge({ primary, duplicate, identity, now })).toEqual({ ok: true });
    expect(primary.toPrimitives()).toMatchObject({ ...identity, status: 'active', version: 2 });
    expect(duplicate.toPrimitives()).toMatchObject({
      status: 'merged',
      mergedIntoCustomerId: 'customer-1',
      version: 2,
    });
  });

  it('rejects merging a customer into itself', () => {
    const customer = Customer.register({ id: 'customer-1', name: 'Ana', phone: '987654321', now });
    expect(
      Customer.resolveMerge({
        primary: customer,
        duplicate: customer,
        identity: {
          name: 'Ana',
          nameNormalized: 'ana',
          phoneNormalized: '+51987654321',
          dni: null,
          address: null,
        },
        now,
      }),
    ).toEqual({ ok: false, reason: 'same-customer' });
  });
});
