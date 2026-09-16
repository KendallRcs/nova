import type { CustomerIdentity } from '../domain/customer';

export interface PreparedCustomerMerge {
  mergeId: string;
  operationId: string;
  primaryCustomerId: string;
  duplicateCustomerId: string;
  expectedPrimaryVersion: number;
  expectedDuplicateVersion: number;
  identity: CustomerIdentity;
  actorId: string;
  effectiveAt: Date;
}

export interface CustomerMergeReceipt {
  mergeId: string;
  operationId: string;
  primaryCustomerId: string;
  duplicateCustomerId: string;
  primaryVersion: number;
  duplicateVersion: number;
  identity: CustomerIdentity;
  actorId: string;
  effectiveAt: Date;
}

export type CustomerMergeResult =
  | { readonly ok: true; readonly merge: CustomerMergeReceipt; readonly replayed: boolean }
  | {
      readonly ok: false;
      readonly reason:
        | 'same-customer'
        | 'customer-not-found'
        | 'primary-not-active'
        | 'duplicate-not-active'
        | 'phone-conflict'
        | 'version-conflict'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
      readonly conflictingCustomerId?: string;
    };

export interface CustomerMergeBook {
  merge(command: PreparedCustomerMerge): Promise<CustomerMergeResult>;
}
