import type { Metadata } from 'next';

import { PurchaseDetailScreen } from '@/features/procurement/purchase-detail-screen';

export const metadata: Metadata = { title: 'Detalle de compra' };

export default async function PurchasePage({
  params,
}: Readonly<{ params: Promise<{ purchaseId: string }> }>) {
  const { purchaseId } = await params;
  return <PurchaseDetailScreen purchaseId={purchaseId} />;
}
