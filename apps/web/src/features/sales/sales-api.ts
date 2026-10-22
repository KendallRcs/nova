import type { components } from '@/shared/api/schema';
import { apiClient } from '@/shared/api/client';
import { toApiProblem } from '@/shared/api/problem-details';

export type SaleActivity = components['schemas']['SaleActivityItemResponse'];
export type SalePage = components['schemas']['SaleActivityPageResponse'];
export type SaleDetail = components['schemas']['SaleDetailResponse'];
export type SalePayment = components['schemas']['SalePaymentResponse'];
export type SaleDelivery = components['schemas']['SaleDeliveryResponse'];
export type SaleClosure = components['schemas']['SaleClosureResponse'];
export type PaymentCorrection = components['schemas']['PaymentCorrectionResponse'];
export type SaleReturn = components['schemas']['SaleReturnResponse'];
export type SaleTotalAdjustment = components['schemas']['SaleTotalAdjustmentResponse'];
export type SaleCancellation = components['schemas']['SaleCancellationResponse'];
export type InventoryLocation = components['schemas']['InventoryLocationResponse'];
export type PaymentMethod = components['schemas']['RecordSalePaymentRequest']['method'];
export type SaleLifecycle = SaleActivity['lifecycle'];
export type SaleDebtFilter = 'all' | 'pending' | 'paid' | 'overdue';

export interface SaleFilters {
  lifecycle?: SaleLifecycle;
  debt: SaleDebtFilter;
}

export const salesQueryRoot = ['sales'] as const;
export const salesQueryKey = (filters: SaleFilters) => [...salesQueryRoot, filters] as const;
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

export async function recordSalePayment(input: {
  saleId: string;
  operationId: string;
  expectedVersion: number;
  amountCents: number;
  method: PaymentMethod;
}): Promise<SalePayment> {
  const { data, error, response } = await apiClient.POST('/api/v1/sales/{saleId}/payments', {
    params: { path: { saleId: input.saleId } },
    headers: { 'Idempotency-Key': input.operationId },
    body: {
      expectedVersion: input.expectedVersion,
      amountCents: input.amountCents,
      method: input.method,
    },
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function deliverSaleReservation(input: {
  saleId: string;
  operationId: string;
  expectedVersion: number;
  lines: { saleLineId: string; quantity: number }[];
}): Promise<SaleDelivery> {
  const { data, error, response } = await apiClient.POST('/api/v1/sales/{saleId}/deliveries', {
    params: { path: { saleId: input.saleId } },
    headers: { 'Idempotency-Key': input.operationId },
    body: { expectedVersion: input.expectedVersion, lines: input.lines },
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function listInventoryLocations(): Promise<InventoryLocation[]> {
  const { data, error, response } = await apiClient.GET('/api/v1/inventory/locations');
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data.items;
}

export async function finalizeSale(input: {
  saleId: string;
  operationId: string;
  expectedVersion: number;
  reason: string | null;
}): Promise<SaleClosure> {
  const { data, error, response } = await apiClient.POST('/api/v1/sales/{saleId}/closure', {
    params: { path: { saleId: input.saleId } },
    headers: { 'Idempotency-Key': input.operationId },
    body: {
      expectedVersion: input.expectedVersion,
      reason: input.reason,
    } as never,
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function correctSalePayment(input: {
  saleId: string;
  paymentId: string;
  operationId: string;
  expectedVersion: number;
  amountCents: number;
  reason: string;
}): Promise<PaymentCorrection> {
  const { data, error, response } = await apiClient.POST(
    '/api/v1/sales/{saleId}/payments/{paymentId}/corrections',
    {
      params: { path: { saleId: input.saleId, paymentId: input.paymentId } },
      headers: { 'Idempotency-Key': input.operationId },
      body: {
        expectedVersion: input.expectedVersion,
        amountCents: input.amountCents,
        reason: input.reason,
      },
    },
  );
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export interface ReturnLineInput {
  saleLineId: string;
  quantity: number;
  productReturns: boolean;
  returnLocationId: string | null;
  condition: 'available' | 'review' | null;
}

export async function approveSaleReturn(input: {
  saleId: string;
  operationId: string;
  expectedVersion: number;
  reason: string;
  refundMethod: PaymentMethod | null;
  lines: ReturnLineInput[];
}): Promise<SaleReturn> {
  const { data, error, response } = await apiClient.POST('/api/v1/sales/{saleId}/returns', {
    params: { path: { saleId: input.saleId } },
    headers: { 'Idempotency-Key': input.operationId },
    body: {
      expectedVersion: input.expectedVersion,
      reason: input.reason,
      refundMethod: input.refundMethod,
      lines: input.lines,
    } as never,
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function adjustSaleTotal(input: {
  saleId: string;
  operationId: string;
  expectedVersion: number;
  newTotalCents: number;
  reason: string;
}): Promise<SaleTotalAdjustment> {
  const { data, error, response } = await apiClient.POST(
    '/api/v1/sales/{saleId}/total-adjustments',
    {
      params: { path: { saleId: input.saleId } },
      headers: { 'Idempotency-Key': input.operationId },
      body: {
        expectedVersion: input.expectedVersion,
        newTotalCents: input.newTotalCents,
        reason: input.reason,
      },
    },
  );
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export interface CancellationLineInput {
  saleLineId: string;
  returnedQuantity: number;
  notReturnedQuantity: number;
  returnLocationId: string | null;
  condition: 'available' | 'review' | null;
}

export async function cancelSale(input: {
  saleId: string;
  operationId: string;
  expectedVersion: number;
  reason: string;
  refundAmountCents: number;
  refundMethod: PaymentMethod | null;
  lines: CancellationLineInput[];
}): Promise<SaleCancellation> {
  const { data, error, response } = await apiClient.POST('/api/v1/sales/{saleId}/cancellations', {
    params: { path: { saleId: input.saleId } },
    headers: { 'Idempotency-Key': input.operationId },
    body: {
      expectedVersion: input.expectedVersion,
      reason: input.reason,
      refundAmountCents: input.refundAmountCents,
      refundMethod: input.refundMethod,
      lines: input.lines,
    } as never,
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
