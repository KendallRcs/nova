import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQueryClient } from '@/test/render';
import { InventoryScreen } from './inventory-screen';
import { productFixture } from './inventory.test-fixtures';

const api = vi.hoisted(() => ({ get: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  search: '',
}));

vi.mock('@/shared/api/client', () => ({ apiClient: { GET: api.get } }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

describe('InventoryScreen', () => {
  beforeEach(() => {
    navigation.search = '';
    api.get.mockReset();
  });

  it('shows products with their authorized price and available stock', async () => {
    mockJsonResponse({
      items: [productFixture()],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });

    renderWithQueryClient(<InventoryScreen />);

    expect(screen.getByLabelText('Cargando productos')).toBeInTheDocument();
    expect(await screen.findByText('Muñeca de colección')).toBeInTheDocument();
    expect(screen.getByText(/S\/\s*65\.00/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.queryByText(/costo/i)).toHaveTextContent(
      'Los costos y márgenes permanecen protegidos.',
    );
  });

  it('stores a trimmed search in the URL', async () => {
    const user = userEvent.setup();
    mockJsonResponse({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } });
    renderWithQueryClient(<InventoryScreen />);

    const input = screen.getByRole('searchbox', { name: 'Código o nombre del producto' });
    await user.type(input, '  muñeca especial  ');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(navigation.replace).toHaveBeenCalledWith('/inventory?q=mu%C3%B1eca%20especial');
  });

  it('explains when a search has no results and can clear it', async () => {
    const user = userEvent.setup();
    navigation.search = 'q=robot';
    mockJsonResponse({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } });
    renderWithQueryClient(<InventoryScreen />);

    expect(await screen.findByText('No encontramos productos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver todos los productos' }));
    expect(navigation.replace).toHaveBeenCalledWith('/inventory');
  });

  it('shows a recoverable message when the catalog request fails', async () => {
    mockJsonResponse(
      {
        title: 'Servicio no disponible',
        detail: 'El catálogo no está disponible temporalmente.',
        status: 503,
      },
      503,
    );
    renderWithQueryClient(<InventoryScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El catálogo no está disponible temporalmente.',
    );
    expect(screen.getByRole('button', { name: 'Intentar nuevamente' })).toBeEnabled();
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
