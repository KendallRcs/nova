import type { Metadata } from 'next';

import { MoreScreen } from '@/features/home/more-screen';

export const metadata: Metadata = { title: 'Más' };

export default function MorePage() {
  return <MoreScreen />;
}
