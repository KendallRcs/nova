import type { components } from '@/shared/api/schema';
import { apiClient } from '@/shared/api/client';
import { toApiProblem } from '@/shared/api/problem-details';
export { newOperationId } from '@/shared/api/idempotency';

export type Customer = components['schemas']['CustomerResponse'];
export type SaleDraft = components['schemas']['SaleDraftResponse'];
export type SaleConfirmation = components['schemas']['SaleConfirmationResponse'];
export type SaleDraftLineInput = components['schemas']['SaleDraftLineRequest'];
export type PaymentMethod = components['schemas']['InitialSalePaymentRequest']['method'];

export interface DraftInput {
  customerId: string | null;
  dueDate: string | null;
  paymentAgreementNote: string | null;
  lines: SaleDraftLineInput[];
}

export interface ConfirmationInput {
  expectedVersion: number;
  priceExceptions: { saleLineId: string; reason: string }[];
  initialPayment: { amountCents: number; method: PaymentMethod } | null;
}

export const customerSearchQueryKey = (query: string) => ['customer-search', query] as const;

export async function searchCustomers(query: string): Promise<Customer[]> {
  const { data, error, response } = await apiClient.GET('/api/v1/customers', {
    params: { query: { query } },
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data.items;
}

export async function registerCustomer(input: { name: string; phone: string }): Promise<Customer> {
  const { data, error, response } = await apiClient.POST('/api/v1/customers', {
    body: input,
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function createSaleDraft(input: DraftInput): Promise<SaleDraft> {
  const { data, error, response } = await apiClient.POST('/api/v1/sales', {
    body: input as unknown as components['schemas']['SaleDraftDataRequest'],
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function updateSaleDraft(
  saleId: string,
  input: DraftInput,
  expectedVersion: number,
): Promise<SaleDraft> {
  const { data, error, response } = await apiClient.PUT('/api/v1/sales/{saleId}', {
    params: { path: { saleId } },
    body: {
      ...input,
      expectedVersion,
    } as unknown as components['schemas']['UpdateSaleDraftRequest'],
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function confirmSale(
  saleId: string,
  operationId: string,
  input: ConfirmationInput,
): Promise<SaleConfirmation> {
  const { data, error, response } = await apiClient.POST('/api/v1/sales/{saleId}/confirmation', {
    params: { path: { saleId } },
    headers: { 'Idempotency-Key': operationId },
    body: {
      expectedVersion: input.expectedVersion,
      priceExceptions: input.priceExceptions,
      ...(input.initialPayment === null ? {} : { initialPayment: input.initialPayment }),
    },
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}
