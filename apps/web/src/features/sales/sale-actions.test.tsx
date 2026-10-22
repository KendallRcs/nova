import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQueryClient } from '@/test/render';
import { SaleActions } from './sale-actions';
import type { SaleDetail } from './sales-api';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/shared/api/client', () => ({ apiClient: { GET: api.get, POST: api.post } }));

describe('sale pending actions', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.get.mockResolvedValue(
      ok({
        userId: '01900000-0000-7000-8000-000000000001',
        username: 'empleada',
        permissionCodes: ['payments:create-own', 'sales:deliver-own'],
        requiresPasswordChange: false,
      }),
    );
  });

  it('records the exact remaining balance with a reusable idempotency key', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue(
      ok({
        paymentId: '01900000-0000-7000-8000-000000000702',
        operationId: '01900000-0000-7000-8000-000000000802',
        saleId: saleFixture().id,
        saleVersion: 3,
        amountCents: 6000,
        method: 'cash',
        registeredBy: saleFixture().createdBy,
        effectiveAt: '2026-10-21T18:00:00.000Z',
        paidCents: 10000,
        balanceCents: 0,
        paymentSituation: 'paid',
        replayed: false,
      }),
    );
    renderWithQueryClient(<SaleActions sale={saleFixture()} />);

    await user.click(await screen.findByRole('button', { name: 'Usar saldo total' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar pago' }));

    expect(await screen.findByText(/Pago de S\/\s*60\.00 registrado/)).toBeInTheDocument();
    expect(JSON.stringify(api.post.mock.calls)).toMatch(
      /payments.*Idempotency-Key.*[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/,
    );
  });

  it('delivers all reserved units selected from the sale line', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue(
      ok({
        deliveryId: '01900000-0000-7000-8000-000000000703',
        operationId: '01900000-0000-7000-8000-000000000803',
        saleId: saleFixture().id,
        saleVersion: 3,
        deliveredQuantity: 1,
        remainingReservedQuantity: 0,
        deliveredBy: saleFixture().createdBy,
        effectiveAt: '2026-10-21T18:00:00.000Z',
        lines: [
          {
            saleLineId: saleFixture().lines[0]?.id,
            locationId: saleFixture().lines[0]?.locationId,
            quantity: 1,
            consumedCostCents: 2500,
          },
        ],
        replayed: false,
      }),
    );
    renderWithQueryClient(<SaleActions sale={saleFixture()} />);

    await user.click(await screen.findByRole('button', { name: 'Registrar entrega' }));
    await user.click(screen.getByRole('button', { name: 'Todo' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar entrega' }));

    expect(await screen.findByText('1 unidad entregada.')).toBeInTheDocument();
    await waitFor(() => {
      const calls = JSON.stringify(api.post.mock.calls);
      expect(calls).toContain('/api/v1/sales/{saleId}/deliveries');
      expect(calls).toContain('"expectedVersion":2');
      expect(calls).toContain('"saleLineId":"01900000-0000-7000-8000-000000000601","quantity":1');
    });
  });
});

function saleFixture(): SaleDetail {
  return {
    id: '01900000-0000-7000-8000-000000000451',
    createdBy: '01900000-0000-7000-8000-000000000001',
    creatorUsername: 'empleada',
    customer: {
      historicalId: '01900000-0000-7000-8000-000000000501',
      canonicalId: '01900000-0000-7000-8000-000000000501',
      name: 'Cliente frecuente',
      phone: '999888777',
    },
    lifecycle: 'confirmed',
    originalTotalCents: 10000,
    currentTotalCents: 10000,
    paidCents: 4000,
    balanceCents: 6000,
    paymentSituation: 'partial',
    deliverySituation: 'partial',
    overdue: true,
    dueDate: '2026-10-10',
    version: 2,
    confirmedAt: '2026-10-01T15:00:00.000Z',
    createdAt: '2026-10-01T14:30:00.000Z',
    updatedAt: '2026-10-02T15:00:00.000Z',
    paymentAgreementNote: 'Pagará el saldo durante el mes.',
    finalizedAt: null,
    cancelledAt: null,
    lines: [
      {
        id: '01900000-0000-7000-8000-000000000601',
        productId: '01900000-0000-7000-8000-000000000011',
        locationId: '01900000-0000-7000-8000-000000000301',
        locationCode: 'TDA',
        locationName: 'Tienda',
        quantity: 2,
        deliveryQuantity: 1,
        reservationQuantity: 1,
        activeReservationQuantity: 1,
        agreedUnitPriceCents: 5000,
        originalSubtotalCents: 10000,
        snapshot: { code: 'MUN-001', name: 'Muñeca de colección' } as never,
        priceExceptionReason: null,
        priceApprovedBy: null,
        allocatedCostCents: null,
      },
    ],
    payments: [],
    totalAdjustments: [],
    returns: [],
    deliveries: [],
    cancellation: null,
    closure: null,
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
