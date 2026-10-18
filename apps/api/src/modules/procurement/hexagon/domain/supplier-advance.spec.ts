import { describe, expect, it } from 'vitest';

import { SupplierAdvance } from './supplier-advance';

describe('SupplierAdvance', () => {
  it('resolves partially and closes only when its balance reaches zero', () => {
    const advance = SupplierAdvance.restore({
      id: 'advance-id',
      currentBalanceCents: 2_501,
      status: 'pending',
      version: 1,
      updatedAt: new Date('2026-10-18T20:00:00.000Z'),
    });
    expect(advance.resolve(1_000, new Date('2026-10-18T20:01:00.000Z'))).toMatchObject({
      ok: true,
      balance: { currentBalanceCents: 1_501, status: 'pending', version: 2 },
    });
    expect(advance.resolve(1_501, new Date('2026-10-18T20:02:00.000Z'))).toMatchObject({
      ok: true,
      balance: { currentBalanceCents: 0, status: 'resolved', version: 3 },
    });
  });

  it('does not allow consuming more than the current balance', () => {
    const advance = SupplierAdvance.restore({
      id: 'advance-id',
      currentBalanceCents: 500,
      status: 'pending',
      version: 1,
      updatedAt: new Date(),
    });
    expect(advance.resolve(501, new Date())).toEqual({
      ok: false,
      reason: 'insufficient-balance',
    });
  });
});
