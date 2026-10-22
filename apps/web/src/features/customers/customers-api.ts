import type { components } from '@/shared/api/schema';
import { apiClient } from '@/shared/api/client';
import { toApiProblem } from '@/shared/api/problem-details';

export type Customer = components['schemas']['CustomerResponse'];
export type CustomerAccount = components['schemas']['CustomerAccountResponse'];
export type CustomerMerge = components['schemas']['CustomerMergeResponse'];

export interface CustomerInput {
  name: string;
  phone: string;
  dni: string | null;
  address: string | null;
}

export const customersQueryRoot = ['customers'] as const;
export const customerAccountsQueryRoot = ['customer-account'] as const;
export const customersQueryKey = (query: string) => [...customersQueryRoot, query] as const;
export const customerAccountQueryKey = (customerId: string) =>
  [...customerAccountsQueryRoot, customerId] as const;

export async function searchCustomers(query: string): Promise<Customer[]> {
  const { data, error, response } = await apiClient.GET('/api/v1/customers', {
    params: { query: query.length > 0 ? { query } : {} },
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data.items;
}

export async function registerCustomer(input: CustomerInput): Promise<Customer> {
  const { data, error, response } = await apiClient.POST('/api/v1/customers', {
    body: input as never,
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function updateCustomer(
  customerId: string,
  expectedVersion: number,
  input: CustomerInput,
): Promise<Customer> {
  const { data, error, response } = await apiClient.PUT('/api/v1/customers/{customerId}', {
    params: { path: { customerId } },
    body: { ...input, expectedVersion } as never,
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function getCustomerAccount(customerId: string): Promise<CustomerAccount> {
  const { data, error, response } = await apiClient.GET('/api/v1/customers/{customerId}/account', {
    params: { path: { customerId } },
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function mergeCustomers(input: {
  operationId: string;
  primary: Customer;
  duplicate: Customer;
  resolved: CustomerInput;
}): Promise<CustomerMerge> {
  const { data, error, response } = await apiClient.POST('/api/v1/customers/merges', {
    headers: { 'Idempotency-Key': input.operationId },
    body: {
      primaryCustomerId: input.primary.id,
      duplicateCustomerId: input.duplicate.id,
      expectedPrimaryVersion: input.primary.version,
      expectedDuplicateVersion: input.duplicate.version,
      resolvedName: input.resolved.name,
      resolvedPhone: input.resolved.phone,
      resolvedDni: input.resolved.dni,
      resolvedAddress: input.resolved.address,
    } as never,
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}
