# Dashboard y reportes

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story DASH-001 — Consultar el flujo de caja mensual

- **Estado:** Confirmada
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
- **Como** administrador
- **quiero** consultar productos más vendidos, más rentables y con baja disponibilidad
- **para** tomar decisiones de precio y reposición.

#### Criterios de aceptación

- **Escenario:** Consulta del rendimiento de productos
- **Dado:** que existen ventas e inventario en el período seleccionado
- **Cuando:** consulto los indicadores de productos
- **Entonces:** veo unidades vendidas, margen calculado con costos históricos y disponibilidad por ubicación como métricas separadas.

---

