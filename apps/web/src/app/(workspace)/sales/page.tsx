import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SalesScreen } from '@/features/sales/sales-screen';

export const metadata: Metadata = { title: 'Ventas' };

export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <SalesScreen />
    </Suspense>
  );
}
