import { describe, expect, it } from 'vitest';

import { InvalidSupplierNameError, Supplier } from './supplier';

describe('Supplier', () => {
  it('normalizes a reusable occasional supplier identity', () => {
    const supplier = Supplier.register({
      id: '0199ef04-1b00-7000-8000-000000000070',
      name: '  Distribuidora   Norte ',
      kind: 'occasional',
      phone: ' 999 111 222 ',
      now: new Date('2026-10-18T20:00:00.000Z'),
    });
    expect(supplier.toPrimitives()).toMatchObject({
      name: 'Distribuidora Norte',
      nameNormalized: 'distribuidora norte',
      kind: 'occasional',
      phone: '999 111 222',
      status: 'active',
      version: 1,
    });
  });

  it('rejects an empty name', () => {
    expect(() =>
      Supplier.register({
        id: '0199ef04-1b00-7000-8000-000000000070',
        name: '   ',
        kind: 'registered',
        now: new Date(),
      }),
    ).toThrow(InvalidSupplierNameError);
  });
});
