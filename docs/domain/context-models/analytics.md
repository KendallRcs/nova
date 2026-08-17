# Modelo de lectura de Analítica

**Estado:** versión inicial confirmada el 2026-08-16.

Analítica responde preguntas del negocio combinando hechos confirmados de otros contextos. No origina ventas, pagos, gastos ni movimientos y no se convierte en autoridad de sus totales transaccionales.

## Naturaleza del contexto

Analítica utiliza modelos de lectura, no agregados de escritura. En el tamaño esperado del MVP puede resolver consultas optimizadas directamente sobre PostgreSQL. Si posteriormente se materializan proyecciones, deben poder reconstruirse desde las fuentes transaccionales.

No se requiere inicialmente un almacén analítico, broker ni base de datos separada.

## Período

Los reportes reciben un intervalo explícito. Para vistas mensuales, Nova usa meses calendario de la zona del negocio. La zona y almacenamiento temporal exactos se fijarán en la arquitectura de datos; las operaciones conservan su instante efectivo.

## Flujo de caja

Fuente: movimientos vigentes de Finanzas Operativas agrupados por fecha efectiva, dirección, método y causa.

```text
flujo neto = cobros de ventas
           + reembolsos de proveedores
           - pagos nuevos de compras
           - anticipos a proveedores
           - reembolsos a clientes
           - gastos operativos
```

Aplicar un anticipo a una compra no aparece otra vez porque no mueve dinero en ese momento.

## Resultado comercial estimado

El resultado se mantiene separado del flujo de caja:

```text
ventas netas acordadas = ventas confirmadas
                       + ajustes de total
                       - devoluciones comerciales

margen bruto estimado = ventas netas acordadas - costo histórico atribuible

resultado estimado = margen bruto estimado
                   - gastos operativos
                   - bajas de inventario
                   - pérdidas de anticipos
                   - saldos condonados
```

Las ventas se atribuyen inicialmente al período de confirmación; ajustes, devoluciones, bajas, gastos y condonaciones afectan el período de su fecha efectiva. Esto permite explicar qué ocurrió cada mes sin reescribir silenciosamente períodos anteriores.

Los pagos de clientes no vuelven a sumarse como ventas: afectan flujo de caja y cobranza. Por ello una venta con saldo puede mostrar margen comercial esperado aunque todavía no se haya cobrado completamente.

El resultado se denomina `estimado` hasta confirmar el método de costeo y las reglas de reconocimiento en la Fase 4.

## Cuenta por cobrar

Fuente: ventas confirmadas con saldo vigente, resolviendo identidades de clientes fusionados.

Incluye:

- total acordado y total comercial neto;
- pago neto;
- saldo pendiente;
- vencimiento e indicador de atraso;
- creador de la venta;
- cliente principal;
- estados de cobro y entrega.

La suma por cliente es una proyección; no crea una deuda separada ni admite pagos generales.

## Desempeño por usuario

Las métricas conservan responsabilidades distintas:

- ventas creadas, cantidad y total se atribuyen al creador de la venta;
- pagos se atribuyen al registrador de cada pago;
- operaciones administrativas se atribuyen a su aprobador o responsable.

Una cuenta inactiva continúa apareciendo en períodos históricos.

## Rendimiento de productos

Por producto y período se muestran separadamente:

- unidades vendidas;
- unidades devueltas;
- ventas netas acordadas;
- costo histórico atribuible;
- margen estimado y porcentaje;
- stock físico, reservado, en revisión y disponible por ubicación.

Los productos más vendidos y más rentables no se confunden: volumen y margen son ordenamientos diferentes.

La disponibilidad es una fotografía actual salvo que el reporte solicite explícitamente reconstrucción histórica, capacidad que queda fuera del MVP inicial.

## Acceso a información

- Administrador accede a costos, márgenes, gastos, pérdidas y comparaciones por usuario.
- Empleado accede a stock, precios autorizados, sus ventas y la información de clientes permitida, sin costos ni márgenes.

La autorización se aplica en el backend y cada consulta solicita solo los campos permitidos.

## Actualización y consistencia

En el MVP se prefieren consultas consistentes contra las tablas transaccionales y vistas SQL cuando resulten útiles. Los eventos pueden invalidar cachés o actualizar proyecciones futuras, pero ningún dashboard crítico depende inicialmente de que un consumidor asíncrono haya procesado un evento.

Si se incorporan proyecciones materializadas:

- serán idempotentes;
- registrarán hasta qué evento o versión procesaron;
- podrán reconstruirse;
- mostrarán cuándo fueron actualizadas;
- no aceptarán correcciones manuales de totales.

## Decisiones pendientes para la Fase 4

- método de costeo histórico: FIFO, promedio ponderado u otro;
- precisión y redondeo monetario;
- tratamiento exacto del costo ante devoluciones;
- índices y vistas necesarios para los reportes;
- instante de corte y zona horaria persistente;
- necesidad real de guardar proyecciones frente a calcularlas bajo demanda.

Estas decisiones permanecen explícitas porque afectan datos y no deben inferirse de una fórmula provisional.
