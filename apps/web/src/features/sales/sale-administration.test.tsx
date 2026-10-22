import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQueryClient } from '@/test/render';
import { SaleAdministration } from './sale-administration';
import type { SaleDetail } from './sales-api';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/shared/api/client', () => ({ apiClient: { GET: api.get, POST: api.post } }));

describe('sale administration', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.get.mockImplementation((path: string) => {
      if (path === '/api/v1/inventory/locations') {
        return Promise.resolve(
          ok({ items: [{ id: IDS.location, code: 'TDA', name: 'Tienda', type: 'store' }] }),
        );
      }
      return Promise.resolve(
        ok({
          userId: IDS.admin,
          username: 'admin',
          permissionCodes: ['returns:approve', 'payments:correct', 'sales:finalize-with-balance'],
          requiresPasswordChange: false,
        }),
      );
    });
  });

  it('registers a return without refund when the remaining payment is below the new total', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue(
      ok({
        returnId: IDS.result,
        operationId: IDS.operation,
        saleId: IDS.sale,
        saleVersion: 3,
        commercialReductionCents: 5000,
        refundAmountCents: 0,
        refundMethod: null,
        currentTotalCents: 5000,
        paidCents: 4000,
        balanceCents: 1000,
        approvedBy: IDS.admin,
        effectiveAt: '2026-10-21T18:00:00.000Z',
        replayed: false,
      }),
    );
    renderWithQueryClient(<SaleAdministration sale={saleFixture()} />);

    await user.click(await screen.findByRole('button', { name: /Registrar devolución/ }));
    await user.type(screen.getByLabelText('Cantidad a devolver de Muñeca de colección'), '1');
    await user.type(screen.getByLabelText('Razón obligatoria'), 'El cliente cambió de opinión');
    expect(
      screen.getByText('Lo pagado no supera el nuevo total; no corresponde devolver dinero.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar devolución' }));

    expect(await screen.findByText('Devolución registrada sin reembolso.')).toBeInTheDocument();
    const calls = JSON.stringify(api.post.mock.calls);
    expect(calls).toContain('/api/v1/sales/{saleId}/returns');
    expect(calls).toContain('"refundMethod":null');
    expect(calls).toContain(`"saleLineId":"${IDS.line}","quantity":1,"productReturns":false`);
  });

  it('corrects part of a payment and retains its original method', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue(
      ok({
        correctionId: IDS.result,
        operationId: IDS.operation,
        saleId: IDS.sale,
        paymentId: IDS.payment,
        saleVersion: 3,
        amountCents: 1000,
        method: 'yape',
        reason: 'Monto duplicado',
        correctedBy: IDS.admin,
        effectiveAt: '2026-10-21T18:00:00.000Z',
        replayed: false,
      }),
    );
    renderWithQueryClient(<SaleAdministration sale={saleFixture()} />);

    await user.click(await screen.findByRole('button', { name: /Corregir un pago/ }));
    await user.type(screen.getByLabelText('Monto a corregir'), '10');
    await user.type(screen.getByLabelText('Razón obligatoria'), 'Monto duplicado');
    await user.click(screen.getByRole('button', { name: 'Confirmar corrección' }));

    expect(await screen.findByText(/Corrección de S\/\s*10\.00 registrada/)).toBeInTheDocument();
    const calls = JSON.stringify(api.post.mock.calls);
    expect(calls).toContain(`/payments/{paymentId}/corrections`);
    expect(calls).toContain('"amountCents":1000');
    expect(calls).not.toContain('"method"');
  });

  it('requires a reason and makes the forgiven balance explicit before closure', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue(
      ok({
        closureId: IDS.result,
        operationId: IDS.operation,
        saleId: IDS.sale,
        saleVersion: 3,
        type: 'incomplete',
        forgivenAmountCents: 6000,
        reason: 'Acuerdo con cliente',
        closedBy: IDS.admin,
        effectiveAt: '2026-10-21T18:00:00.000Z',
        replayed: false,
      }),
    );
    renderWithQueryClient(<SaleAdministration sale={saleFixture()} />);

    await user.click(await screen.findByRole('button', { name: /Finalizar venta/ }));
    expect(
      screen.getByText(/S\/\s*60\.00 quedará registrado como importe no cobrado/),
    ).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Finalizar sin cobrar saldo' });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('Razón obligatoria'), 'Acuerdo con cliente');
    expect(button).toBeEnabled();
    await user.click(button);

    expect(
      await screen.findByText(/Venta finalizada con S\/\s*60\.00 sin cobrar/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.stringify(api.post.mock.calls)).toContain('/api/v1/sales/{saleId}/closure');
    });
  });
});

const IDS = {
  admin: '01900000-0000-7000-8000-000000000001',
  sale: '01900000-0000-7000-8000-000000000451',
  customer: '01900000-0000-7000-8000-000000000501',
  line: '01900000-0000-7000-8000-000000000601',
  product: '01900000-0000-7000-8000-000000000011',
  location: '01900000-0000-7000-8000-000000000301',
  payment: '01900000-0000-7000-8000-000000000701',
  result: '01900000-0000-7000-8000-000000000702',
  operation: '01900000-0000-7000-8000-000000000802',
} as const;

function saleFixture(): SaleDetail {
  return {
    id: IDS.sale,
    createdBy: IDS.admin,
    creatorUsername: 'admin',
    customer: {
      historicalId: IDS.customer,
      canonicalId: IDS.customer,
      name: 'Cliente frecuente',
      phone: '999888777',
    },
    lifecycle: 'confirmed',
    originalTotalCents: 10000,
    currentTotalCents: 10000,
    paidCents: 4000,
    balanceCents: 6000,
    paymentSituation: 'partial',
    deliverySituation: 'complete',
    overdue: false,
    dueDate: null,
    version: 2,
    confirmedAt: '2026-10-01T15:00:00.000Z',
    createdAt: '2026-10-01T14:30:00.000Z',
    updatedAt: '2026-10-02T15:00:00.000Z',
    paymentAgreementNote: null,
    finalizedAt: null,
    cancelledAt: null,
    lines: [
      {
        id: IDS.line,
        productId: IDS.product,
        locationId: IDS.location,
        locationCode: 'TDA',
        locationName: 'Tienda',
        quantity: 2,
        deliveryQuantity: 2,
        reservationQuantity: 0,
        activeReservationQuantity: 0,
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
        id: IDS.payment,
        amountCents: 4000,
        correctedCents: 0,
        netAmountCents: 4000,
        method: 'yape',
        status: 'confirmed',
        registeredBy: IDS.admin,
        registrarUsername: 'admin',
        effectiveAt: '2026-10-01T15:00:00.000Z',
        corrections: [],
      },
    ],
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
