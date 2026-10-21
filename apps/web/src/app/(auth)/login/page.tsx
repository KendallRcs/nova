import type { Metadata } from 'next';

import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = { title: 'Ingresar' };

interface LoginPageProps {
  searchParams: Promise<{ password?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  return <LoginForm passwordUpdated={query.password === 'updated'} />;
}
