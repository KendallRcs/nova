import { describe, expect, it, vi } from 'vitest';

import { RegisterSupplierAdvance } from './register-supplier-advance';
import { InvalidAdvanceAmountError } from '../domain/supplier-advance';

describe('RegisterSupplierAdvance', () => {
  it('prepares normalized data and delegates the atomic operation', async () => {
    const register = vi.fn().mockResolvedValue({ ok: false, reason: 'supplier-not-found' });
    const useCase = new RegisterSupplierAdvance(
      { register },
      { generate: vi.fn().mockReturnValueOnce('advance-id').mockReturnValueOnce('cash-id') },
      { now: () => new Date('2026-10-18T20:00:00.000Z') },
    );
    await expect(
      useCase.execute({
        operationId: 'operation-id',
        supplierId: 'supplier-id',
        amountCents: 2_500,
        method: 'yape',
        purpose: '  peluches   nuevos ',
        actorId: 'actor-id',
      }),
    ).resolves.toEqual({ ok: false, reason: 'supplier-not-found' });
    expect(register).toHaveBeenCalledWith({
      operationId: 'operation-id',
      advanceId: 'advance-id',
      cashMovementId: 'cash-id',
      supplierId: 'supplier-id',
      amountCents: 2_500,
      method: 'yape',
      purpose: 'peluches nuevos',
      actorId: 'actor-id',
      effectiveAt: new Date('2026-10-18T20:00:00.000Z'),
    });
  });

  it('rejects a non-positive amount before persistence', () => {
    const useCase = new RegisterSupplierAdvance(
      { register: vi.fn() },
      { generate: () => 'id' },
      { now: () => new Date() },
    );
    expect(() =>
      useCase.execute({
        operationId: 'operation-id',
        supplierId: 'supplier-id',
        amountCents: 0,
        method: 'cash',
        actorId: 'actor-id',
      }),
    ).toThrow(InvalidAdvanceAmountError);
  });
});
