import type { Metadata } from 'next';

import { ProductDetailScreen } from '@/features/inventory/product-detail-screen';

export const metadata: Metadata = { title: 'Detalle de producto' };

export default async function ProductDetailPage({
  params,
}: Readonly<{ params: Promise<{ productId: string }> }>) {
  const { productId } = await params;
  return <ProductDetailScreen productId={productId} />;
}
