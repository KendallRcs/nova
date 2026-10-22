import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQueryClient } from '@/test/render';
import type { SaleActivity, SaleDetail } from './sales-api';
import { SaleDetailScreen } from './sale-detail-screen';
import { SalesScreen } from './sales-screen';

const api = vi.hoisted(() => ({ get: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn(), search: '' }));
vi.mock('@/shared/api/client', () => ({ apiClient: { GET: api.get } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

describe('sales tracking', () => {
  beforeEach(() => {
    api.get.mockReset();
    navigation.search = '';
  });

  it('shows payment, delivery, overdue state and responsible account', async () => {
    api.get.mockResolvedValueOnce(
      ok({ items: [saleFixture()], pageInfo: { nextCursor: null, hasNextPage: false } }),
    );
    renderWithQueryClient(<SalesScreen />);
    expect(await screen.findByText('Cliente frecuente')).toBeInTheDocument();
    expect(screen.getByText('Pago parcial')).toBeInTheDocument();
    expect(screen.getByText('Entrega parcial')).toBeInTheDocument();
    expect(screen.getByText('Pago atrasado')).toBeInTheDocument();
    expect(screen.getByText(/por empleada/)).toBeInTheDocument();
  });

  it('keeps operational filters in the URL', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce(
      ok({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } }),
    );
    renderWithQueryClient(<SalesScreen />);
    await user.selectOptions(screen.getByLabelText('Situación de pago'), 'overdue');
    expect(navigation.replace).toHaveBeenCalledWith('/sales?deuda=overdue');
  });

  it('renders products, balances and payments as one sale history', async () => {
    api.get.mockResolvedValueOnce(ok(detailFixture()));
    renderWithQueryClient(<SaleDetailScreen saleId={saleFixture().id} />);
    expect(await screen.findByRole('heading', { name: 'Cliente frecuente' })).toBeInTheDocument();
    expect(screen.getByText('Muñeca de colección')).toBeInTheDocument();
    expect(screen.getByText(/Pago de S\/\s*40\.00/)).toBeInTheDocument();
    expect(screen.getByText('Yape · registrado por empleada.')).toBeInTheDocument();
    expect(screen.getByText('1 unidad entregada')).toBeInTheDocument();
    expect(screen.getByText(/Pago corregido por S\/\s*10\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Devolución por S\/\s*50\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Total ajustado a S\/\s*90\.00/)).toBeInTheDocument();
    expect(screen.getByText('Venta cancelada')).toBeInTheDocument();
  });
});

function saleFixture(): SaleActivity {
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
  };
}

function detailFixture(): SaleDetail {
  return {
    ...saleFixture(),
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
    payments: [
      {
        id: '01900000-0000-7000-8000-000000000701',
        amountCents: 4000,
        correctedCents: 1000,
        netAmountCents: 3000,
        method: 'yape',
        status: 'confirmed',
        registeredBy: '01900000-0000-7000-8000-000000000001',
        registrarUsername: 'empleada',
        effectiveAt: '2026-10-02T15:00:00.000Z',
        corrections: [
          {
            id: '01900000-0000-7000-8000-000000000702',
            amountCents: 1000,
            reason: 'Monto duplicado',
            effectiveAt: '2026-10-02T16:00:00.000Z',
          } as never,
        ],
      },
    ],
    totalAdjustments: [
      {
        id: '01900000-0000-7000-8000-000000000703',
        newTotalCents: 9000,
        differenceCents: -1000,
        reason: 'Nuevo acuerdo',
        effectiveAt: '2026-10-02T17:00:00.000Z',
      } as never,
    ],
    returns: [
      {
        id: '01900000-0000-7000-8000-000000000901',
        reason: 'El cliente cambió de opinión',
        commercialReductionCents: 5000,
        refundAmountCents: 0,
        effectiveAt: '2026-10-04T15:00:00.000Z',
        lines: [],
      } as never,
    ],
    deliveries: [
      {
        id: '01900000-0000-7000-8000-000000000801',
        actorUsername: 'empleada',
        effectiveAt: '2026-10-03T15:00:00.000Z',
        lines: [{ quantity: 1 }],
      } as never,
    ],
    cancellation: {
      id: '01900000-0000-7000-8000-000000000902',
      reason: 'El cliente desistió',
      refundAmountCents: 2000,
      effectiveAt: '2026-10-05T15:00:00.000Z',
      lines: [],
    } as never,
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
