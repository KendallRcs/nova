import type { Customer } from '../domain/customer';

export interface CustomerView {
  id: string;
  name: string;
  phone: string;
  dni: string | null;
  address: string | null;
  isActive: boolean;
  mergedIntoCustomerId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
export function toCustomerView(customer: Customer): CustomerView {
  const values = customer.toPrimitives();
  return {
    id: values.id,
    name: values.name,
    phone: values.phoneNormalized,
    dni: values.dni,
    address: values.address,
    isActive: values.status === 'active',
    mergedIntoCustomerId: values.mergedIntoCustomerId,
    version: values.version,
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  };
}
