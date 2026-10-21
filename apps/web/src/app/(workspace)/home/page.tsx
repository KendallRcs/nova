import type { Metadata } from 'next';

import { HomeScreen } from '@/features/home/home-screen';

export const metadata: Metadata = { title: 'Inicio' };

export default function HomePage() {
  return <HomeScreen />;
}
