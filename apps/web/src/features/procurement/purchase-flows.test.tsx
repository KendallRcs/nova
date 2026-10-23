import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQueryClient } from '@/test/render';
import { PurchaseCreateScreen } from './purchase-create-screen';
import { PurchaseDetailScreen } from './purchase-detail-screen';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/shared/api/client', () => ({ apiClient: { GET: api.get, POST: api.post } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: navigation.push }) }));

describe('purchase registration and detail', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    navigation.push.mockReset();
    api.get.mockImplementation((path: string) => {
      if (path === '/api/v1/suppliers') return Promise.resolve(ok({ items: [supplier()] }));
      if (path === '/api/v1/inventory/locations') {
        return Promise.resolve(
          ok({ items: [{ id: IDS.location, name: 'Tienda', kind: 'store' }] }),
        );
      }
      if (path === '/api/v1/products') {
        return Promise.resolve(
          ok({ items: [product()], pageInfo: { nextCursor: null, hasNextPage: false } }),
        );
      }
      if (path === '/api/v1/supplier-advances') {
        return Promise.resolve(ok({ items: [advance()] }));
      }
      return Promise.resolve(ok(purchaseDetail()));
    });
  });

  it('confirms a purchase with costs, destination and a manually selected advance', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue(ok({ id: IDS.purchase }));
    renderWithQueryClient(<PurchaseCreateScreen />);

    await screen.findByRole('option', { name: 'Proveedor Central' });
    await user.selectOptions(screen.getByLabelText('Proveedor'), IDS.supplier);
    await user.type(screen.getByLabelText('Buscar por código o nombre'), 'muñeca');
    await user.click(await screen.findByRole('button', { name: /Muñeca clásica/ }));
    await user.type(screen.getByLabelText('Costo de Muñeca clásica'), '25');
    await user.type(screen.getByLabelText('Aplicar anticipo de Proveedor Central'), '10');
    await user.click(screen.getByRole('button', { name: 'Confirmar compra' }));

    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith(`/purchases/${IDS.purchase}`);
    });
    const request = JSON.stringify(api.post.mock.calls);
    expect(request).toContain('/api/v1/purchases');
    expect(request).toContain(`"destinationLocationId":"${IDS.location}"`);
    expect(request).toContain('"unitCostCents":2500');
    expect(request).toContain('"amountCents":1000');
    expect(request).toContain('"expectedVersion":3');
    expect(request).toMatch(
      /Idempotency-Key.*[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/,
    );
  });

  it('shows resulting average costs and the price review suggestion', async () => {
    renderWithQueryClient(<PurchaseDetailScreen purchaseId={IDS.purchase} />);

    expect(await screen.findByRole('heading', { name: 'Proveedor Central' })).toBeVisible();
    expect(screen.getByText('Revisar precios')).toBeVisible();
    expect(screen.getByText('Saldo restante S/ 30.00')).toBeVisible();
    expect(screen.getAllByText('S/ 25.00').length).toBeGreaterThan(0);
  });
});

const IDS = {
  supplier: '01900000-0000-7000-8000-000000000801',
  advance: '01900000-0000-7000-8000-000000000802',
  purchase: '01900000-0000-7000-8000-000000000803',
  location: '01900000-0000-7000-8000-000000000804',
  product: '01900000-0000-7000-8000-000000000805',
  line: '01900000-0000-7000-8000-000000000806',
  application: '01900000-0000-7000-8000-000000000807',
} as const;

function supplier() {
  return {
    id: IDS.supplier,
    name: 'Proveedor Central',
    kind: 'registered',
    phone: null,
    document: null,
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
    originalAmountCents: 5000,
    currentBalanceCents: 4000,
    method: 'yape',
    purpose: 'Separar colección',
    status: 'pending',
    version: 3,
    registeredBy: 'admin',
    effectiveAt: '2026-10-10T14:00:00.000Z',
  };
}

function product() {
  return {
    id: IDS.product,
    code: 'MUN-001',
    name: 'Muñeca clásica',
    description: null,
    category: null,
    tags: [],
    images: [],
    minimumPriceCents: 4000,
    suggestedPriceCents: 5000,
    maximumPriceCents: 6000,
    stock: [],
    isActive: true,
    createdAt: '2026-10-01T14:00:00.000Z',
    updatedAt: '2026-10-01T14:00:00.000Z',
  };
}

function purchaseDetail() {
  return {
    id: IDS.purchase,
    supplier: { id: IDS.supplier, name: 'Proveedor Central', kind: 'registered' },
    totalCents: 2500,
    advanceAppliedCents: 1000,
    newlyPaidCents: 1500,
    paymentMethod: 'cash',
    lineCount: 1,
    totalQuantity: 1,
    confirmedBy: 'admin-id',
    confirmerUsername: 'admin',
    effectiveAt: '2026-10-20T14:00:00.000Z',
    lines: [
      {
        id: IDS.line,
        productId: IDS.product,
        currentProductCode: 'MUN-001',
        currentProductName: 'Muñeca clásica',
        destinationLocationId: IDS.location,
        destinationLocationName: 'Tienda',
        quantity: 1,
        unitCostCents: 2500,
        subtotalCents: 2500,
        previousAverageUnitCostCents: 2000,
        resultingAverageUnitCostCents: 2500,
        priceReviewSuggested: true,
      },
    ],
    advanceApplications: [
      {
        id: IDS.application,
        advanceId: IDS.advance,
        amountCents: 1000,
        resultingBalanceCents: 3000,
      },
    ],
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
