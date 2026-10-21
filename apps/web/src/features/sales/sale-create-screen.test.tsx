import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQueryClient } from '@/test/render';
import type { Product } from '@/features/inventory/inventory-api';
import { newOperationId } from './sale-create-api';
import { SaleCreateScreen } from './sale-create-screen';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/shared/api/client', () => ({
  apiClient: { GET: api.get, POST: api.post, PUT: api.put },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: navigation.push }) }));

describe('sale creation', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    navigation.push.mockReset();
    api.get.mockImplementation((path: string) => {
      if (path === '/api/v1/auth/me') {
        return Promise.resolve(
          ok({
            userId: '01900000-0000-7000-8000-000000000001',
            username: 'empleada',
            permissionCodes: ['sales:create'],
            requiresPasswordChange: false,
          }),
        );
      }
      if (path === '/api/v1/products') {
        return Promise.resolve(
          ok({ items: [productFixture()], pageInfo: { nextCursor: null, hasNextPage: false } }),
        );
      }
      return Promise.resolve(ok({ items: [] }));
    });
  });

  it('builds a multiline-ready sale and derives its live total', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SaleCreateScreen />);

    await user.type(screen.getByLabelText('Buscar por código o nombre'), 'muñeca');
    await user.click(await screen.findByRole('button', { name: /Muñeca de colección/ }));

    expect(screen.getByText('MUN-001')).toBeInTheDocument();
    expect(screen.getByText('1 unidad · 3 disponibles')).toBeInTheDocument();
    expect(screen.getAllByText('S/ 50.00').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeEnabled();
  });

  it('requires a customer when the initial payment leaves a balance', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SaleCreateScreen />);
    await user.type(screen.getByLabelText('Buscar por código o nombre'), 'muñeca');
    await user.click(await screen.findByRole('button', { name: /Muñeca de colección/ }));
    await user.click(screen.getByRole('radio', { name: /Una parte/ }));
    await user.type(screen.getByLabelText('Monto que paga ahora'), '10');

    expect(
      screen.getByText('Selecciona un cliente porque quedará saldo pendiente.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled();
  });

  it('creates a draft and confirms a fully paid sale with an idempotency key', async () => {
    const user = userEvent.setup();
    api.post.mockImplementation((path: string) => {
      if (path === '/api/v1/sales') return Promise.resolve(ok(draftFixture()));
      return Promise.resolve(
        ok({
          saleId: draftFixture().id,
          operationId: newOperationId(1_700_000_000_000),
          version: 2,
          confirmedBy: '01900000-0000-7000-8000-000000000001',
          confirmedAt: '2026-10-21T18:00:00.000Z',
          totalCents: 5000,
          deliveredQuantity: 1,
          reservedQuantity: 0,
          allocatedCostCents: 2500,
          initialPaymentCents: 5000,
          balanceCents: 0,
          paymentSituation: 'paid',
          replayed: false,
        }),
      );
    });
    renderWithQueryClient(<SaleCreateScreen />);
    await user.type(screen.getByLabelText('Buscar por código o nombre'), 'muñeca');
    await user.click(await screen.findByRole('button', { name: /Muñeca de colección/ }));
    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }));

    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith(`/sales/${draftFixture().id}`);
    });
    expect(JSON.stringify(api.post.mock.calls)).toMatch(
      /Idempotency-Key.*[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/,
    );
  });

  it('generates UUID v7 operation identifiers without an extra dependency', () => {
    expect(newOperationId(1_700_000_000_000)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

function productFixture(): Product {
  return {
    id: '01900000-0000-7000-8000-000000000011',
    code: 'MUN-001',
    name: 'Muñeca de colección',
    description: null,
    category: { id: '01900000-0000-7000-8000-000000000101', name: 'Muñecas' },
    tags: [],
    images: [],
    minimumPriceCents: 4000,
    suggestedPriceCents: 5000,
    maximumPriceCents: 6000,
    stock: [
      {
        locationId: '01900000-0000-7000-8000-000000000301',
        locationCode: 'TDA',
        locationName: 'Tienda',
        physicalQuantity: 3,
        reservedQuantity: 0,
        reviewQuantity: 0,
        availableQuantity: 3,
        version: 1,
      },
    ],
    isActive: true,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  };
}

function draftFixture() {
  return {
    id: '01900000-0000-7000-8000-000000000451',
    createdBy: '01900000-0000-7000-8000-000000000001',
    customerId: null,
    lifecycle: 'draft',
    originalTotalCents: 5000,
    currentTotalCents: 5000,
    dueDate: null,
    paymentAgreementNote: null,
    lines: [
      {
        id: '01900000-0000-7000-8000-000000000601',
        productId: productFixture().id,
        locationId: productFixture().stock[0]?.locationId,
        quantity: 1,
        deliveryQuantity: 1,
        reservationQuantity: 0,
        pendingQuantity: 0,
        agreedUnitPriceCents: 5000,
        originalSubtotalCents: 5000,
      },
    ],
    version: 1,
    createdAt: '2026-10-21T17:59:00.000Z',
    updatedAt: '2026-10-21T17:59:00.000Z',
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
