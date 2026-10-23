import type { Metadata } from 'next';

import { ProcurementScreen } from '@/features/procurement/procurement-screen';

export const metadata: Metadata = { title: 'Compras' };

export default function PurchasesPage() {
  return <ProcurementScreen />;
}
