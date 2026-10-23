import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQueryClient } from '@/test/render';
import { ProcurementScreen } from './procurement-screen';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/shared/api/client', () => ({ apiClient: { GET: api.get, POST: api.post } }));

describe('procurement management', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.get.mockImplementation((path: string) => {
      if (path === '/api/v1/auth/me') {
        return Promise.resolve(
          ok({
            userId: IDS.user,
            username: 'admin',
            permissionCodes: ['purchases:manage'],
            requiresPasswordChange: false,
          }),
        );
      }
      if (path === '/api/v1/suppliers') return Promise.resolve(ok({ items: [supplier()] }));
      if (path === '/api/v1/supplier-advances') {
        return Promise.resolve(ok({ items: [advance()] }));
      }
      return Promise.resolve(
        ok({ items: [purchase()], pageInfo: { nextCursor: null, hasNextPage: false } }),
      );
    });
  });

  it('shows purchase history and registers a supplier advance idempotently', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue(
      ok({
        ...advance(),
        operationId: IDS.operation,
        replayed: false,
      }),
    );
    renderWithQueryClient(<ProcurementScreen />);

    expect(await screen.findByText(/250\.00/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Registrar anticipo' }));
    await user.type(screen.getByLabelText('Monto entregado'), '80');
    await user.click(screen.getByRole('button', { name: 'Confirmar anticipo' }));

    expect(api.post).toHaveBeenCalled();
    const calls = JSON.stringify(api.post.mock.calls);
    expect(calls).toContain('/api/v1/supplier-advances');
    expect(calls).toContain('"amountCents":8000');
    expect(calls).toMatch(
      /Idempotency-Key.*[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/,
    );
  });

  it('records a supplier refund using the observed advance version', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue(
      ok({
        id: IDS.resolution,
        operationId: IDS.operation,
        advanceId: IDS.advance,
        type: 'refund',
        amountCents: 6000,
        method: 'yape',
        reason: null,
        currentBalanceCents: 0,
        status: 'resolved',
        advanceVersion: 4,
        registeredBy: IDS.user,
        effectiveAt: '2026-10-21T15:00:00.000Z',
        replayed: false,
      }),
    );
    renderWithQueryClient(<ProcurementScreen />);

    await user.click(await screen.findByRole('button', { name: 'Anticipos' }));
    await user.click(await screen.findByRole('button', { name: 'Resolver' }));
    await user.click(screen.getByRole('button', { name: 'Registrar devolución' }));

    const calls = JSON.stringify(api.post.mock.calls);
    expect(calls).toContain(`/api/v1/supplier-advances/{advanceId}/refunds`);
    expect(calls).toContain('"expectedVersion":3');
    expect(calls).toContain('"amountCents":6000');
  });
});

const IDS = {
  user: '01900000-0000-7000-8000-000000000001',
  supplier: '01900000-0000-7000-8000-000000000801',
  advance: '01900000-0000-7000-8000-000000000802',
  purchase: '01900000-0000-7000-8000-000000000803',
  operation: '01900000-0000-7000-8000-000000000804',
  resolution: '01900000-0000-7000-8000-000000000805',
} as const;

function supplier() {
  return {
    id: IDS.supplier,
    name: 'Proveedor Central',
    kind: 'registered',
    phone: '999888777',
    document: '20123456789',
    description: null,
    status: 'active',
    version: 1,
    createdAt: '2026-10-01T14:00:00.000Z',
    updatedAt: '2026-10-01T14:00:00.000Z',
  };
}

function advance() {
  return {
    id: IDS.advance,
    supplierId: IDS.supplier,
    supplierName: 'Proveedor Central',
    originalAmountCents: 10000,
    currentBalanceCents: 6000,
    method: 'yape',
    purpose: 'Separar nueva colección',
    status: 'pending',
    version: 3,
    registeredBy: IDS.user,
    effectiveAt: '2026-10-10T14:00:00.000Z',
  };
}

function purchase() {
  return {
    id: IDS.purchase,
    supplier: { id: IDS.supplier, name: 'Proveedor Central', kind: 'registered' },
    totalCents: 25000,
    advanceAppliedCents: 5000,
    newlyPaidCents: 20000,
    paymentMethod: 'cash',
    lineCount: 2,
    totalQuantity: 5,
    confirmedBy: IDS.user,
    confirmerUsername: 'admin',
    effectiveAt: '2026-10-20T14:00:00.000Z',
  };
}

function ok(data: unknown) {
  return {
    data,
    error: undefined,
    response: new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  };
}
