import type { Metadata } from 'next';

import { ModuleIntro, ModuleStart } from '@/shared/ui/module-start';

export const metadata: Metadata = { title: 'Clientes' };

export default function CustomersPage() {
  return (
    <ModuleStart
      title="Clientes"
      description="Encuentra a una persona y revisa sus ventas, pagos y saldo vigente."
      help="Cada pago pertenece a una venta. La cuenta del cliente los reúne sin mezclar los acuerdos originales."
    >
      <ModuleIntro
        title="Una cuenta clara por cliente"
        description="Esta sección incorporará búsqueda, datos de contacto y seguimiento de ventas abiertas."
        items={['Nombre y teléfono como base', 'DNI opcional', 'Rastro completo de pagos']}
      />
    </ModuleStart>
  );
}
