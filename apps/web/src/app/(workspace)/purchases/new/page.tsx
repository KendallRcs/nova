import type { Metadata } from 'next';

import { PurchaseCreateScreen } from '@/features/procurement/purchase-create-screen';

export const metadata: Metadata = { title: 'Registrar compra' };

export default function NewPurchasePage() {
  return <PurchaseCreateScreen />;
}
