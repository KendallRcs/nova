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
          permissionCodes: [
            'returns:approve',
            'payments:correct',
            'sales:adjust-confirmed',
            'sales:finalize-with-balance',
            'sales:cancel',
          ],
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

  it('adjusts the agreed total without allowing it below the amount already paid', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue(
      ok({
        adjustmentId: IDS.result,
        operationId: IDS.operation,
        saleId: IDS.sale,
        saleVersion: 3,
        previousTotalCents: 10000,
        currentTotalCents: 9000,
        differenceCents: -1000,
        reason: 'Nuevo acuerdo',
        changedBy: IDS.admin,
        effectiveAt: '2026-10-21T18:00:00.000Z',
        replayed: false,
      }),
    );
    renderWithQueryClient(<SaleAdministration sale={saleFixture()} />);

    await user.click(await screen.findByRole('button', { name: /Ajustar total acordado/ }));
    const total = screen.getByLabelText('Nuevo total acordado');
    await user.clear(total);
    await user.type(total, '30');
    expect(
      screen.getByText(/no puede ser menor que los S\/\s*40\.00 ya cobrados/),
    ).toBeInTheDocument();
    await user.clear(total);
    await user.type(total, '90');
    await user.type(screen.getByLabelText('Razón obligatoria'), 'Nuevo acuerdo');
    await user.click(screen.getByRole('button', { name: 'Confirmar nuevo total' }));

    expect(await screen.findByText(/Nuevo total de S\/\s*90\.00 registrado/)).toBeInTheDocument();
    const calls = JSON.stringify(api.post.mock.calls);
    expect(calls).toContain('/api/v1/sales/{saleId}/total-adjustments');
    expect(calls).toContain('"newTotalCents":9000');
  });

  it('cancels a sale with explicit product treatment and a manual refund', async () => {
    const user = userEvent.setup();
    const sale = saleFixture();
    const line = sale.lines[0];
    if (line === undefined) throw new Error('Fixture line is required.');
    line.deliveryQuantity = 1;
    line.reservationQuantity = 1;
    line.activeReservationQuantity = 1;
    api.post.mockResolvedValue(
      ok({
        cancellationId: IDS.result,
        operationId: IDS.operation,
        saleId: IDS.sale,
        saleVersion: 3,
        refundAmountCents: 2000,
        refundMethod: 'cash',
        paidCents: 2000,
        releasedQuantity: 1,
        returnedQuantity: 1,
        notReturnedQuantity: 0,
        cancelledBy: IDS.admin,
        effectiveAt: '2026-10-21T18:00:00.000Z',
        replayed: false,
      }),
    );
    renderWithQueryClient(<SaleAdministration sale={sale} />);

    await user.click(await screen.findByRole('button', { name: /Cancelar venta/ }));
    await user.clear(screen.getByLabelText('Unidades que regresan de Muñeca de colección'));
    await user.type(screen.getByLabelText('Unidades que regresan de Muñeca de colección'), '1');
    await user.selectOptions(
      await screen.findByLabelText('Ubicación de cancelación de Muñeca de colección'),
      IDS.location,
    );
    await user.clear(screen.getByLabelText('Reembolso real'));
    await user.type(screen.getByLabelText('Reembolso real'), '20');
    await user.type(screen.getByLabelText('Razón obligatoria'), 'El cliente desistió');
    await user.click(screen.getByRole('button', { name: 'Cancelar venta definitivamente' }));

    expect(
      await screen.findByText(/Venta cancelada y S\/\s*20\.00 reembolsados/),
    ).toBeInTheDocument();
    const calls = JSON.stringify(api.post.mock.calls);
    expect(calls).toContain('/api/v1/sales/{saleId}/cancellations');
    expect(calls).toContain('"refundAmountCents":2000,"refundMethod":"cash"');
    expect(calls).toContain('"returnedQuantity":1,"notReturnedQuantity":0');
    expect(calls).not.toContain('"releasedQuantity"');
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
