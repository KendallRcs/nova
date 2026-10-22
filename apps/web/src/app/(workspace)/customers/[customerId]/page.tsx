import type { Metadata } from 'next';

import { CustomerDetailScreen } from '@/features/customers/customer-detail-screen';

export const metadata: Metadata = { title: 'Cuenta del cliente' };

export default async function CustomerDetailPage({
  params,
}: Readonly<{ params: Promise<{ customerId: string }> }>) {
  const { customerId } = await params;
  return <CustomerDetailScreen customerId={customerId} />;
}
