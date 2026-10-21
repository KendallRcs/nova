import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from './providers';
import './styles.css';

export const metadata: Metadata = {
  title: {
    default: 'Nova',
    template: '%s · Nova',
  },
  description: 'Gestión de ventas, inventario y cuentas del negocio.',
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
