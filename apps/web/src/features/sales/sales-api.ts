import type { components } from '@/shared/api/schema';
import { apiClient } from '@/shared/api/client';
import { toApiProblem } from '@/shared/api/problem-details';

export type SaleActivity = components['schemas']['SaleActivityItemResponse'];
export type SalePage = components['schemas']['SaleActivityPageResponse'];
export type SaleDetail = components['schemas']['SaleDetailResponse'];
export type SaleLifecycle = SaleActivity['lifecycle'];
export type SaleDebtFilter = 'all' | 'pending' | 'paid' | 'overdue';

export interface SaleFilters {
  lifecycle?: SaleLifecycle;
  debt: SaleDebtFilter;
}

export const salesQueryKey = (filters: SaleFilters) => ['sales', filters] as const;
export const saleDetailQueryKey = (saleId: string) => ['sale', saleId] as const;

export async function listSales(filters: SaleFilters, cursor?: string): Promise<SalePage> {
  const { data, error, response } = await apiClient.GET('/api/v1/sales', {
    params: {
      query: {
        debt: filters.debt,
        ...(filters.lifecycle === undefined ? {} : { lifecycle: filters.lifecycle }),
        ...(cursor === undefined ? {} : { cursor }),
      },
    },
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function getSaleDetail(saleId: string): Promise<SaleDetail> {
  const { data, error, response } = await apiClient.GET('/api/v1/sales/{saleId}', {
    params: { path: { saleId } },
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export const lifecycleLabels: Record<SaleLifecycle, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmada',
  finalized: 'Finalizada',
  cancelled: 'Cancelada',
};

export const paymentLabels: Record<SaleActivity['paymentSituation'], string> = {
  'not-applicable': 'Sin cobros todavía',
  unpaid: 'Sin pagos',
  partial: 'Pago parcial',
  paid: 'Pagada',
  'closed-with-balance': 'Finalizada incompleta',
};

export const deliveryLabels: Record<SaleActivity['deliverySituation'], string> = {
  'not-applicable': 'Sin entrega todavía',
  pending: 'Pendiente de entrega',
  partial: 'Entrega parcial',
  complete: 'Entregada',
};

export const paymentMethodLabels: Record<SaleDetail['payments'][number]['method'], string> = {
  cash: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  pos: 'POS',
};

export function saleReference(saleId: string): string {
  return saleId.slice(-8).toUpperCase();
}

export function productSnapshot(line: SaleDetail['lines'][number]): { code: string; name: string } {
  const snapshot: unknown = line.snapshot;
  if (
    isRecord(snapshot) &&
    typeof snapshot.code === 'string' &&
    typeof snapshot.name === 'string'
  ) {
    return { code: snapshot.code, name: snapshot.name };
  }
  return { code: 'Sin código histórico', name: `Producto ${line.productId.slice(-8)}` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
