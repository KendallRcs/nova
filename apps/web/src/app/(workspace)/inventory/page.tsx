import type { Metadata } from 'next';

import { ModuleIntro, ModuleStart } from '@/shared/ui/module-start';

export const metadata: Metadata = { title: 'Inventario' };

export default function InventoryPage() {
  return (
    <ModuleStart
      title="Inventario"
      description="Consulta cada producto y su disponibilidad en tienda y almacén."
      help="Disponible, reservado y en revisión son cantidades distintas. El empleado no ve costos ni márgenes."
    >
      <ModuleIntro
        title="Inventario será la primera consulta operativa"
        description="Aquí conectaremos la búsqueda por código o nombre y el detalle por ubicación."
        items={[
          'Stock separado por ubicación',
          'Precio de venta visible',
          'Historial de movimientos trazable',
        ]}
      />
    </ModuleStart>
  );
}
