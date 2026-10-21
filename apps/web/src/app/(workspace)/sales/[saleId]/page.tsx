import type { Metadata } from 'next';

import { SaleDetailScreen } from '@/features/sales/sale-detail-screen';

export const metadata: Metadata = { title: 'Detalle de venta' };

export default async function SaleDetailPage({
  params,
}: Readonly<{ params: Promise<{ saleId: string }> }>) {
  const { saleId } = await params;
  return <SaleDetailScreen saleId={saleId} />;
}
