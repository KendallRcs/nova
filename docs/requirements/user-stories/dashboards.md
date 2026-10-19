# Dashboard y reportes

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story DASH-001 — Consultar el flujo de caja mensual

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo mediante un reporte mensual
  de movimientos reales de caja agrupados por método y causa, con entradas, salidas
  y flujo neto calculados sin volver a contar anticipos aplicados.
- **Como** administrador
- **quiero** comparar entradas y salidas reales de dinero del mes
- **para** saber cuánto efectivo ingresó y egresó del negocio.

#### Criterios de aceptación

- **Escenario:** Consulta de un período mensual
- **Dado:** que existen cobros, compras, anticipos, gastos y reembolsos en el período
- **Cuando:** consulto el flujo de caja del mes
- **Entonces:** veo cada categoría de entrada y salida y su flujo neto sin duplicar anticipos aplicados a compras.

### User Story DASH-002 — Consultar el resultado mensual

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo con ventas confirmadas,
  ajustes, devoluciones y reembolsos de cancelación separados del costo reconocido,
  gastos operativos, bajas, pérdidas de anticipos y saldos condonados.
- **Como** administrador
- **quiero** consultar ventas, costo vendido, gastos y pérdidas por separado
- **para** estimar correctamente la rentabilidad del negocio.

#### Criterios de aceptación

- **Escenario:** Resultado de un período
- **Dado:** que existen ventas, costos históricos, gastos, devoluciones, bajas y saldos condonados
- **Cuando:** consulto el resultado del mes
- **Entonces:** veo ingresos, costo de venta, margen bruto, gastos operativos, pérdidas y resultado estimado como conceptos diferenciados.

### User Story DASH-003 — Comparar desempeño por usuario

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo; las ventas se atribuyen al
  creador, los cobros al registrador y las devoluciones, cancelaciones, ajustes,
  cierres y correcciones a la cuenta responsable de cada operación.
- **Como** administrador
- **quiero** consultar ventas creadas y pagos registrados por cada cuenta
- **para** supervisar la actividad sin confundir quién vendió con quién cobró.

#### Criterios de aceptación

- **Escenario:** Venta creada por un empleado y cobrada por otro usuario
- **Dado:** que distintas cuentas participaron en la operación
- **Cuando:** consulto el reporte por usuario
- **Entonces:** la venta se atribuye a su creador y cada cobro a quien registró el pago.

### User Story DASH-004 — Identificar productos rentables y necesidades de stock

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo con ranking por unidades,
  margen o baja disponibilidad, costo histórico reconocido, devoluciones y la
  fotografía actual de stock separada por tienda y almacén.
- **Como** administrador
- **quiero** consultar productos más vendidos, más rentables y con baja disponibilidad
- **para** tomar decisiones de precio y reposición.

#### Criterios de aceptación

- **Escenario:** Consulta del rendimiento de productos
- **Dado:** que existen ventas e inventario en el período seleccionado
- **Cuando:** consulto los indicadores de productos
- **Entonces:** veo unidades vendidas, margen calculado con costos históricos y disponibilidad por ubicación como métricas separadas.

## Reglas de lectura implementadas

- `month` usa `YYYY-MM` y representa el mes calendario de `America/Lima` mediante
  un intervalo UTC semiabierto.
- El resultado comercial reconoce la venta original al confirmarse; ajustes,
  devoluciones, reembolsos manuales de cancelación, bajas, pérdidas y condonaciones
  afectan el mes de su fecha efectiva.
- Una compra no es gasto operativo ni reduce directamente el resultado: su costo
  se reconoce al entregar el producto o al darlo de baja.
- Una devolución sin retorno reduce el ingreso, pero no revierte el costo. Si el
  producto retorna, su costo histórico reduce el costo vendido del período.
- La rentabilidad por producto utiliza importes de línea y devoluciones atribuibles.
  Los ajustes globales del total y reembolsos de cancelación no se prorratean entre
  productos porque el negocio no definió una asignación por línea; por eso la suma
  del ranking puede diferir del resultado mensual consolidado.
- El stock del reporte de productos es una fotografía actual, no una reconstrucción
  histórica del cierre del mes.

---

