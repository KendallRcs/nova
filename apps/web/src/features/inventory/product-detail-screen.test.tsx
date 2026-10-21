import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQueryClient } from '@/test/render';
import { productFixture, stockFixture } from './inventory.test-fixtures';
import { ProductDetailScreen } from './product-detail-screen';

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/shared/api/client', () => ({ apiClient: { GET: api.get } }));

describe('ProductDetailScreen', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('shows commercial data and separates stock by location', async () => {
    const product = productFixture({
      stock: [
        stockFixture(),
        stockFixture({
          locationId: '01900000-0000-7000-8000-000000000302',
          locationCode: 'ALM',
          locationName: 'Almacén',
          physicalQuantity: 12,
          reservedQuantity: 2,
          reviewQuantity: 0,
          availableQuantity: 10,
        }),
      ],
    });
    mockJsonResponse(product);

    renderWithQueryClient(<ProductDetailScreen productId={product.id} />);

    expect(await screen.findByRole('heading', { name: product.name })).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    const store = screen.getByRole('heading', { name: 'Tienda' }).closest('article');
    const warehouse = screen.getByRole('heading', { name: 'Almacén' }).closest('article');
    expect(store).not.toBeNull();
    expect(warehouse).not.toBeNull();
    if (store === null || warehouse === null)
      throw new Error('Las ubicaciones deben ser visibles.');
    expect(within(store).getByText('5')).toBeInTheDocument();
    expect(within(warehouse).getByText('10')).toBeInTheDocument();
    expect(screen.getByText(/S\/\s*55\.00/)).toBeInTheDocument();
    expect(screen.getByText(/S\/\s*65\.00/)).toBeInTheDocument();
    expect(screen.getByText(/S\/\s*80\.00/)).toBeInTheDocument();
  });

  it('distinguishes a missing product from a connection failure', async () => {
    mockJsonResponse({ status: 404, code: 'PRODUCT_NOT_FOUND' }, 404);
    renderWithQueryClient(<ProductDetailScreen productId="01900000-0000-7000-8000-000000000099" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Este producto no existe');
    expect(screen.queryByRole('button', { name: 'Intentar nuevamente' })).not.toBeInTheDocument();
  });
});

function mockJsonResponse(body: unknown, status = 200) {
  api.get.mockResolvedValueOnce({
    data: status < 400 ? body : undefined,
    error: status >= 400 ? body : undefined,
    response: new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  });
}
