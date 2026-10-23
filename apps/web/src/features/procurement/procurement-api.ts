import type { components } from '@/shared/api/schema';
import { apiClient } from '@/shared/api/client';
import { newOperationId } from '@/shared/api/idempotency';
import { toApiProblem } from '@/shared/api/problem-details';

type SupplierSchema = components['schemas']['SupplierResponse'];
type AdvanceSchema = components['schemas']['SupplierAdvanceListItemResponse'];

export type PaymentMethod = 'cash' | 'yape' | 'plin' | 'pos';
export type Supplier = Omit<SupplierSchema, 'phone' | 'document' | 'description'> & {
  phone: string | null;
  document: string | null;
  description: string | null;
};
export type SupplierAdvance = Omit<AdvanceSchema, 'purpose'> & { purpose: string | null };
export type PurchasePage = components['schemas']['PurchaseHistoryPageResponse'];
export type PurchaseSummary = components['schemas']['PurchaseHistoryItemResponse'];
export type AdvanceResolution = Omit<
  components['schemas']['AdvanceResolutionResponse'],
  'reason'
> & {
  reason: string | null;
};

export const suppliersQueryRoot = ['suppliers'] as const;
export const suppliersQueryKey = (query: string) => [...suppliersQueryRoot, query] as const;
export const advancesQueryRoot = ['supplier-advances'] as const;
export const advancesQueryKey = (supplierId: string, status: string) =>
  [...advancesQueryRoot, supplierId, status] as const;
export const purchasesQueryRoot = ['purchases'] as const;
export const purchasesQueryKey = (supplierId: string) =>
  [...purchasesQueryRoot, supplierId] as const;

export async function searchSuppliers(query = ''): Promise<Supplier[]> {
  const { data, error, response } = await apiClient.GET('/api/v1/suppliers', {
    params: { query: query.trim().length > 0 ? { query: query.trim() } : {} },
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data.items as Supplier[];
}

export async function registerSupplier(input: {
  name: string;
  kind: Supplier['kind'];
  phone: string | null;
  document: string | null;
  description: string | null;
}): Promise<Supplier> {
  const { data, error, response } = await apiClient.POST('/api/v1/suppliers', {
    body: input as never,
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data as Supplier;
}

export async function listSupplierAdvances(input: {
  supplierId?: string;
  status?: SupplierAdvance['status'];
}): Promise<SupplierAdvance[]> {
  const { data, error, response } = await apiClient.GET('/api/v1/supplier-advances', {
    params: {
      query: {
        ...(input.supplierId === undefined ? {} : { supplierId: input.supplierId }),
        ...(input.status === undefined ? {} : { status: input.status }),
      },
    },
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data.items as SupplierAdvance[];
}

export async function registerSupplierAdvance(input: {
  operationId: string;
  supplierId: string;
  amountCents: number;
  method: PaymentMethod;
  purpose: string | null;
}): Promise<components['schemas']['SupplierAdvanceResponse']> {
  const { data, error, response } = await apiClient.POST('/api/v1/supplier-advances', {
    headers: { 'Idempotency-Key': input.operationId },
    body: {
      supplierId: input.supplierId,
      amountCents: input.amountCents,
      method: input.method,
      purpose: input.purpose,
    } as never,
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function resolveSupplierAdvance(input: {
  operationId: string;
  advanceId: string;
  expectedVersion: number;
  type: 'refund' | 'loss';
  amountCents: number;
  method: PaymentMethod;
  reason: string;
}): Promise<AdvanceResolution> {
  const result =
    input.type === 'refund'
      ? await apiClient.POST('/api/v1/supplier-advances/{advanceId}/refunds', {
          params: { path: { advanceId: input.advanceId } },
          headers: { 'Idempotency-Key': input.operationId },
          body: {
            expectedVersion: input.expectedVersion,
            amountCents: input.amountCents,
            method: input.method,
          },
        })
      : await apiClient.POST('/api/v1/supplier-advances/{advanceId}/losses', {
          params: { path: { advanceId: input.advanceId } },
          headers: { 'Idempotency-Key': input.operationId },
          body: {
            expectedVersion: input.expectedVersion,
            amountCents: input.amountCents,
            reason: input.reason,
          },
        });
  const { data, error, response } = result;
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data as AdvanceResolution;
}

export async function listPurchases(input: {
  supplierId?: string;
  cursor?: string;
}): Promise<PurchasePage> {
  const { data, error, response } = await apiClient.GET('/api/v1/purchases', {
    params: {
      query: {
        ...(input.supplierId === undefined ? {} : { supplierId: input.supplierId }),
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      },
    },
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  pos: 'POS',
};

export { newOperationId };
