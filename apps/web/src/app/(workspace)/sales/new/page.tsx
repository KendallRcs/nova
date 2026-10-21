import type { Metadata } from 'next';

import { SaleCreateScreen } from '@/features/sales/sale-create-screen';

export const metadata: Metadata = { title: 'Registrar venta' };

export default function NewSalePage() {
  return <SaleCreateScreen />;
}
