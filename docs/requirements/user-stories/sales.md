# Ventas, reservas y entregas

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story SAL-001 — Crear una venta con varios productos

- **Estado:** Confirmada
- **Como** empleado
- **quiero** registrar varios productos y cantidades en una sola venta
- **para** representar la operación completa realizada con el cliente.

#### Criterios de aceptación

- **Escenario:** Venta con múltiples líneas
- **Dado:** que cada línea tiene producto, cantidad, ubicación y precio acordado
- **Cuando:** confirmo una venta válida
- **Entonces:** se conserva el total acordado, el creador, la fecha y el detalle histórico de cada línea.

### User Story SAL-002 — Combinar entregas y reservas en una venta

- **Estado:** Confirmada
- **Como** empleado
- **quiero** indicar por producto y cantidad qué se entrega y qué queda reservado
- **para** atender operaciones con cumplimiento parcial.

#### Criterios de aceptación

- **Escenario:** Venta con líneas entregadas y reservadas
- **Dado:** que existe disponibilidad suficiente en las ubicaciones elegidas
- **Cuando:** confirmo las cantidades a entregar y reservar
- **Entonces:** las entregadas salen físicamente del inventario y las reservadas reducen solo la disponibilidad.

### User Story SAL-003 — Vender directamente desde el almacén

- **Estado:** Confirmada
- **Como** empleado
- **quiero** seleccionar el almacén como origen de una línea
- **para** registrar correctamente una venta atendida desde esa ubicación.

#### Criterios de aceptación

- **Escenario:** Entrega desde almacén
- **Dado:** que el almacén posee cantidad disponible suficiente
- **Cuando:** confirmo la entrega desde el almacén
- **Entonces:** el inventario físico disminuye únicamente en el almacén.

### User Story SAL-004 — Asignar fecha de vencimiento a un saldo

- **Estado:** Confirmada
- **Como** empleado
- **quiero** definir una fecha esperada de pago
- **para** identificar visualmente operaciones atrasadas.

#### Criterios de aceptación

- **Escenario:** Saldo supera la fecha esperada
- **Dado:** que una venta conserva saldo pendiente y tiene fecha de vencimiento
- **Cuando:** la fecha actual supera el vencimiento
- **Entonces:** la operación se muestra como atrasada sin cancelarse ni generar cargos automáticamente.

### User Story SAL-005 — Consultar mis ventas

- **Estado:** Confirmada
- **Como** empleado
- **quiero** consultar las ventas que registré
- **para** dar seguimiento a mis operaciones y pagos pendientes.

#### Criterios de aceptación

- **Escenario:** Consulta del empleado
- **Dado:** que existen ventas creadas por diferentes cuentas
- **Cuando:** consulto mi listado de ventas
- **Entonces:** el sistema muestra las ventas creadas por mi cuenta con sus estados de pago y entrega.

### User Story SAL-006 — Consultar cualquier venta como administrador

- **Estado:** Confirmada
- **Como** administrador
- **quiero** consultar ventas creadas por cualquier empleado
- **para** supervisar las operaciones del negocio.

#### Criterios de aceptación

- **Escenario:** Consulta administrativa
- **Dado:** que existen ventas creadas por diferentes cuentas
- **Cuando:** consulto el listado general de ventas
- **Entonces:** veo todas las ventas y el usuario responsable de cada una.

### User Story SAL-007 — Preservar el precio histórico de una venta

- **Estado:** Confirmada
- **Como** administrador
- **quiero** conservar los precios de referencia y acordados al vender
- **para** explicar el margen histórico aunque cambie el catálogo.

#### Criterios de aceptación

- **Escenario:** Cambio posterior de precios del producto
- **Dado:** que una venta fue confirmada con determinados precios
- **Cuando:** se actualizan los precios del catálogo
- **Entonces:** los importes y referencias de la venta histórica permanecen sin cambios.

### User Story SAL-008 — Editar una venta antes de confirmarla

- **Estado:** Confirmada
- **Como** empleado
- **quiero** modificar una venta mientras permanece en borrador
- **para** corregir productos, cantidades y precios antes de producir efectos financieros o de inventario.

#### Criterios de aceptación

- **Escenario:** Modificación de borrador
- **Dado:** que la venta todavía no fue confirmada
- **Cuando:** cambio sus líneas o condiciones
- **Entonces:** el borrador se actualiza sin generar movimientos de inventario, pagos ni auditoría financiera.

- **Escenario:** Edición directa de una venta confirmada
- **Dado:** que la venta ya fue confirmada
- **Cuando:** intento modificar directamente productos, cantidades o precios
- **Entonces:** el sistema rechaza la edición y orienta a utilizar una operación de ajuste, devolución o cancelación autorizada.

### User Story SAL-009 — Ajustar el total de una venta confirmada

- **Estado:** Confirmada
- **Como** administrador
- **quiero** ajustar justificadamente el total acordado de una venta confirmada
- **para** representar un acuerdo posterior sin sobrescribir su valor original.

#### Criterios de aceptación

- **Escenario:** Ajuste administrativo del total
- **Dado:** que existe una venta confirmada
- **Y dado:** que escribí una razón para el nuevo acuerdo
- **Cuando:** confirmo el ajuste de importe
- **Entonces:** se conserva el total anterior, el nuevo total, la diferencia, el responsable y la fecha, y se recalcula el saldo vigente.

- **Escenario:** Ajuste que produciría un total menor que lo ya reembolsado o aplicado
- **Dado:** que el nuevo total sería incompatible con los movimientos monetarios vigentes
- **Cuando:** intento confirmar el ajuste
- **Entonces:** el sistema rechaza la operación e informa qué movimientos deben resolverse primero.

---

