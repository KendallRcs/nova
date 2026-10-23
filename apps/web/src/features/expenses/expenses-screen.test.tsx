import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQueryClient } from '@/test/render';
import { ExpensesScreen } from './expenses-screen';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/shared/api/client', () => ({
  apiClient: { GET: api.get, POST: api.post, PUT: api.put, DELETE: api.delete },
}));

describe('operating expenses', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.get.mockImplementation((path: string) => {
      if (path === '/api/v1/auth/me')
        return Promise.resolve(
          ok({
            userId: IDS.user,
            username: 'admin',
            permissionCodes: ['expenses:manage'],
            requiresPasswordChange: false,
          }),
        );
      if (path === '/api/v1/expense-categories')
        return Promise.resolve(ok({ items: [category()] }));
      return Promise.resolve(ok({ items: [expense()] }));
    });
  });

  it('registers an idempotent expense and optionally uploads its private receipt', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue(ok(expense()));
    api.put.mockResolvedValue(ok({ hasReceipt: true, mediaType: 'application/pdf', bytes: 100 }));
    renderWithQueryClient(<ExpensesScreen />);

    expect((await screen.findAllByText('Movilidad')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Registrar gasto' }));
    await user.type(screen.getByLabelText('Monto'), '35.50');
    await user.upload(
      screen.getByLabelText(/Comprobante opcional/),
      new File(['pdf'], 'boleta.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar gasto' }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalled();
    });
    const request = JSON.stringify(api.post.mock.calls);
    expect(request).toContain('"amountCents":3550');
    expect(request).toContain(`"categoryId":"${IDS.category}"`);
    expect(request).toMatch(/Idempotency-Key.*-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-/);
    expect(JSON.stringify(api.put.mock.calls)).toContain('/receipt');
  });

  it('cancels a confirmed expense with a full cash refund', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue(ok({ ...expense(), status: 'cancelled' }));
    renderWithQueryClient(<ExpensesScreen />);

    await user.click(await screen.findByRole('button', { name: 'Anular' }));
    await user.type(screen.getByLabelText('Razón obligatoria'), 'Registro duplicado');
    await user.click(screen.getByLabelText('El dinero regresó completo'));
    await user.click(screen.getByRole('button', { name: 'Confirmar anulación' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
    const request = JSON.stringify(api.post.mock.calls);
    expect(request).toContain('/cancellations');
    expect(request).toContain('"refundReceived":true');
    expect(request).toContain('"refundMethod":"cash"');
  });
});

const IDS = {
  user: '01900000-0000-7000-8000-000000000001',
  category: '01900000-0000-7000-8000-000000000901',
  expense: '01900000-0000-7000-8000-000000000902',
  operation: '01900000-0000-7000-8000-000000000903',
} as const;
function category() {
  return {
    id: IDS.category,
    name: 'Movilidad',
    description: null,
    status: 'active',
    createdAt: '2026-10-01T14:00:00.000Z',
    updatedAt: '2026-10-01T14:00:00.000Z',
  };
}
function expense() {
  return {
    id: IDS.expense,
    operationId: IDS.operation,
    categoryId: IDS.category,
    categoryName: 'Movilidad',
    amountCents: 2000,
    method: 'cash',
    description: 'Taxi al almacén',
    hasReceipt: false,
    status: 'confirmed',
    registeredBy: IDS.user,
    effectiveAt: '2026-10-20T14:00:00.000Z',
    cancellation: null,
    replayed: false,
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
