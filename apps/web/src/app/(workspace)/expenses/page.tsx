import type { Metadata } from 'next';

import { ExpensesScreen } from '@/features/expenses/expenses-screen';

export const metadata: Metadata = { title: 'Gastos' };

export default function ExpensesPage() {
  return <ExpensesScreen />;
}
