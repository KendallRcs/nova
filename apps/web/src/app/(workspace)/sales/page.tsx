import type { Metadata } from 'next';

import { ModuleIntro, ModuleStart } from '@/shared/ui/module-start';

export const metadata: Metadata = { title: 'Ventas' };

export default function SalesPage() {
  return (
    <ModuleStart
      title="Ventas"
      description="Registra acuerdos, cobros, reservas y entregas como una sola historia."
      help="Una venta puede pagarse al contado o por partes. Cobro y entrega se registran por separado para conservar el estado real."
    >
      <ModuleIntro
        title="El espacio de ventas está listo"
        description="La siguiente vertical conectará la creación y consulta de ventas con el API."
        items={[
          'Borradores antes de confirmar',
          'Pagos vinculados a la venta',
          'Reservas y entregas independientes',
        ]}
      />
    </ModuleStart>
  );
}
