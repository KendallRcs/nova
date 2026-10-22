import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQueryClient } from '@/test/render';
import { CustomerDetailScreen } from './customer-detail-screen';
import type { Customer } from './customers-api';
import { CustomersScreen } from './customers-screen';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn(), search: '' }));
const access = vi.hoisted(() => ({ permissions: ['customers:read', 'customers:write-basic'] }));
vi.mock('@/shared/api/client', () => ({
  apiClient: { GET: api.get, POST: api.post, PUT: api.put },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

describe('customer management', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    access.permissions = ['customers:read', 'customers:write-basic'];
    navigation.replace.mockReset();
    navigation.search = '';
    api.get.mockImplementation((path: string) =>
      Promise.resolve(
        ok(
          path === '/api/v1/auth/me'
            ? {
                userId: IDS.user,
                username: 'empleada',
                permissionCodes: access.permissions,
                requiresPasswordChange: false,
              }
            : { items: [customerFixture()] },
        ),
      ),
    );
  });

  it('searches customers using navigable URL state', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<CustomersScreen />);
    await user.type(await screen.findByLabelText('Nombre o teléfono del cliente'), 'María');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(navigation.replace).toHaveBeenCalledWith('/customers?q=Mar%C3%ADa');
  });

  it('registers a customer without requiring DNI or address', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue(ok(customerFixture()));
    renderWithQueryClient(<CustomersScreen />);
    await user.click(await screen.findByRole('button', { name: 'Registrar cliente' }));
    await user.type(screen.getByLabelText('Nombre'), 'María Torres');
    await user.type(screen.getByLabelText('Teléfono'), '999888777');
    await user.click(screen.getByRole('button', { name: 'Registrar cliente' }));
    expect(await screen.findByText('María Torres quedó guardado.')).toBeInTheDocument();
    const calls = JSON.stringify(api.post.mock.calls);
    expect(calls).toContain('/api/v1/customers');
    expect(calls).toContain('"dni":null,"address":null');
  });

  it('updates customer data with the observed version', async () => {
    const user = userEvent.setup();
    api.put.mockResolvedValue(ok({ ...customerFixture(), name: 'María T. Torres', version: 4 }));
    renderWithQueryClient(<CustomersScreen />);
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    const name = screen.getByLabelText('Nombre');
    await user.clear(name);
    await user.type(name, 'María T. Torres');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('María T. Torres quedó guardado.')).toBeInTheDocument();
    const calls = JSON.stringify(api.put.mock.calls);
    expect(calls).toContain(`/api/v1/customers/{customerId}`);
    expect(calls).toContain('"expectedVersion":3');
  });

  it('shows consolidated debt and payment history without costs', async () => {
    api.get.mockResolvedValue(ok(accountFixture()));
    renderWithQueryClient(<CustomerDetailScreen customerId={IDS.customer} />);
    expect(await screen.findByRole('heading', { name: 'María Torres' })).toBeInTheDocument();
    expect(screen.getAllByText(/S\/\s*60\.00/)).not.toHaveLength(0);
    expect(screen.getByText('Pago atrasado')).toBeInTheDocument();
    expect(screen.getByText('1 pago registrado')).toBeInTheDocument();
    expect(screen.queryByText(/costo/i)).not.toBeInTheDocument();
  });

  it('merges duplicate customers with resolved data and an idempotency key', async () => {
    const user = userEvent.setup();
    const primary = customerFixture();
    const duplicate = customerFixture({
      id: IDS.duplicate,
      name: 'María T. Pérez',
      phone: '988777666',
      dni: '74261835',
      version: 5,
    });
    access.permissions = ['customers:read', 'customers:write-basic', 'customers:merge'];
    api.get.mockImplementation((path: string) =>
      Promise.resolve(
        ok(
          path === '/api/v1/auth/me'
            ? {
                userId: IDS.user,
                username: 'admin',
                permissionCodes: access.permissions,
                requiresPasswordChange: false,
              }
            : { items: [primary, duplicate] },
        ),
      ),
    );
    api.post.mockResolvedValue(
      ok({
        id: IDS.merge,
        operationId: IDS.operation,
        primaryCustomerId: primary.id,
        duplicateCustomerId: duplicate.id,
        primaryVersion: 4,
        duplicateVersion: 6,
        name: primary.name,
        phone: primary.phone,
        dni: primary.dni,
        address: primary.address,
        mergedBy: IDS.user,
        mergedAt: '2026-10-21T15:00:00.000Z',
        replayed: false,
      }),
    );

    renderWithQueryClient(<CustomersScreen />);
    await user.click(await screen.findByRole('button', { name: 'Fusionar duplicados' }));
    await user.click(
      await screen.findByRole('button', {
        name: `Elegir a ${primary.name}, teléfono ${primary.phone} como cliente principal`,
      }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: `Elegir a ${duplicate.name}, teléfono ${duplicate.phone} como registro duplicado`,
      }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: /entiendo que María T\. Pérez se desactivará/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Fusionar y conservar principal' }));

    expect(
      await screen.findByText(`Los registros se fusionaron en ${primary.name}.`),
    ).toBeVisible();
    const calls = JSON.stringify(api.post.mock.calls);
    expect(calls).toContain('/api/v1/customers/merges');
    expect(calls).toContain(`"expectedPrimaryVersion":${String(primary.version)}`);
    expect(calls).toContain(`"expectedDuplicateVersion":${String(duplicate.version)}`);
    expect(calls).toMatch(
      /Idempotency-Key.*[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/,
    );
  });
});

const IDS = {
  user: '01900000-0000-7000-8000-000000000001',
  customer: '01900000-0000-7000-8000-000000000501',
  duplicate: '01900000-0000-7000-8000-000000000502',
  merge: '01900000-0000-7000-8000-000000000503',
  operation: '01900000-0000-7000-8000-000000000504',
  sale: '01900000-0000-7000-8000-000000000451',
  payment: '01900000-0000-7000-8000-000000000701',
} as const;

function customerFixture(overrides: Partial<Customer> = {}): Customer {
  return { ...baseCustomerFixture(), ...overrides };
}

function baseCustomerFixture(): Customer {
  return {
    id: IDS.customer,
    name: 'María Torres',
    phone: '999888777',
    dni: null,
    address: null,
    isActive: true,
    mergedIntoCustomerId: null,
    version: 3,
    createdAt: '2026-10-01T14:30:00.000Z',
    updatedAt: '2026-10-02T15:00:00.000Z',
  };
}

function accountFixture() {
  return {
    customer: {
      id: IDS.customer,
      name: 'María Torres',
      phone: '999888777',
      dni: null,
      address: 'Av. Principal 123',
      mergedCustomerIds: [],
    },
    summary: {
      salesCount: 1,
      activeDebtSalesCount: 1,
      overdueSalesCount: 1,
      totalPaidCents: 4000,
      totalOutstandingCents: 6000,
      overdueAmountCents: 6000,
      nearestDueDate: '2026-10-10',
      lastPaymentAt: '2026-10-02T15:00:00.000Z',
    },
    sales: [
      {
        id: IDS.sale,
        createdBy: IDS.user,
        creatorUsername: 'empleada',
        lifecycle: 'confirmed',
        originalTotalCents: 10000,
        currentTotalCents: 10000,
        paidCents: 4000,
        refundedCents: 0,
        forgivenAmountCents: 0,
        balanceCents: 6000,
        paymentSituation: 'partial',
        deliverySituation: 'complete',
        overdue: true,
        dueDate: '2026-10-10',
        lastPaymentAt: '2026-10-02T15:00:00.000Z',
        payments: [
          {
            id: IDS.payment,
            amountCents: 4000,
            correctedCents: 0,
            netAmountCents: 4000,
            method: 'yape',
            registeredBy: IDS.user,
            registrarUsername: 'empleada',
            effectiveAt: '2026-10-02T15:00:00.000Z',
          },
        ],
        confirmedAt: '2026-10-01T15:00:00.000Z',
        finalizedAt: null,
        cancelledAt: null,
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
