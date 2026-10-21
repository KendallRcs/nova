import type { Metadata } from 'next';

import { PasswordForm } from '@/features/auth/password-form';

export const metadata: Metadata = { title: 'Crear contraseña' };

export default function PasswordPage() {
  return <PasswordForm />;
}
