# Ventas, reservas y entregas

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story SAL-001 — Crear una venta con varios productos

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend de borradores completo para crear una
  venta con varias líneas, cantidades, ubicación, precio acordado, total derivado,
  cliente opcional y condiciones de entrega o reserva. La confirmación backend
  congela composición, precios y costo y ejecuta los efectos iniciales de
  inventario. También puede registrar un cobro inicial y su entrada de caja; una
  venta totalmente pagada puede confirmarse sin cliente y una que conserve saldo
  continúa exigiendo un cliente. El frontend incorpora una mesa de venta
  multilínea con búsqueda de productos, total en vivo, cliente existente o nuevo,
  cobro inicial y confirmación atómica con protección idempotente.
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
- **Trazabilidad de implementación:** backend completo al confirmar un borrador:
  bloquea posiciones, entrega y reserva por línea en una transacción idempotente y
  revierte todo el conjunto si cualquier efecto falla. También permite entregas
  posteriores parciales o totales sobre reservas activas, conserva su historial y
  recalcula la situación de entrega sin generar un cobro. Al registrar la venta,
  el frontend permite distribuir por línea las unidades que se entregan ahora y
  las que permanecen separadas. Desde el detalle también permite consumir una o
  varias reservas activas y refleja el hecho en el rastro cronológico.
- **Como** empleado
- **quiero** indicar por producto y cantidad qué se entrega y qué queda reservado
- **para** atender operaciones con cumplimiento parcial.

#### Criterios de aceptación

- **Escenario:** Venta con líneas entregadas y reservadas
- **Dado:** que existe disponibilidad suficiente en las ubicaciones elegidas
- **Cuando:** confirmo las cantidades a entregar y reservar
- **Entonces:** las entregadas salen físicamente del inventario y las reservadas reducen solo la disponibilidad.

- **Escenario:** Entrega posterior parcial de una separación
- **Dado:** que una venta confirmada conserva unidades reservadas para el cliente
- **Cuando:** el empleado responsable registra la entrega de una parte de esas unidades
- **Entonces:** disminuyen en la misma cantidad la existencia física, la reserva activa y el costo reservado, y el resto continúa separado.

- **Escenario:** Entrega posterior independiente del pago
- **Dado:** que una venta confirmada conserva saldo por cobrar y unidades reservadas
- **Cuando:** registro una entrega válida
- **Entonces:** se conserva el total y el historial de pagos sin crear un nuevo cobro ni exigir que el saldo esté pagado.

- **Escenario:** Reintento o entrega superior a la reserva
- **Dado:** que una orden de entrega ya fue aplicada o supera las unidades todavía reservadas
- **Cuando:** se procesa la solicitud
- **Entonces:** el mismo `Idempotency-Key` devuelve el resultado original y una orden distinta que exceda la reserva se rechaza sin efectos parciales.

### User Story SAL-003 — Vender directamente desde el almacén

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo; cada línea conserva su
  ubicación y la confirmación afecta únicamente esa posición de inventario. El
  frontend muestra el disponible por ubicación y permite elegir tienda o almacén
  antes de confirmar cada línea.
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
- **Trazabilidad de implementación:** backend completo para derivar la etiqueta
  `overdue` usando el saldo vigente, la fecha civil actual de Lima y el vencimiento;
  la consulta no modifica ni cancela la venta. La creación frontend admite fecha
  esperada y nota opcional del acuerdo cuando queda saldo.
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
- **Trazabilidad de implementación:** backend completo mediante listado paginado con
  cliente canónico, creador, totales, cobrado, saldo, estado de pago, estado de
  entrega y atraso. El detalle operativo expone líneas, instantáneas, reservas,
  entregas posteriores, pagos, correcciones, ajustes y cierre; oculta el costo
  atribuido a quien no tiene capacidad financiera. El alcance del empleado se
  fuerza a su propia cuenta. El frontend incorpora listado responsive, filtros por
  ciclo de vida y deuda, progreso de cobro y un detalle con productos, ubicación,
  acuerdo y cronología de pagos y cambios principales.
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
- **Trazabilidad de implementación:** backend completo; el permiso `sales:read-any`
  habilita el listado general y los filtros por creador, cliente, ciclo de vida y
  situación de deuda, además del detalle de cualquier venta. El frontend reutiliza
  la misma consulta, identifica al responsable en cada operación y delega al
  backend el alcance efectivo según la cuenta autenticada.
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
- **Trazabilidad de implementación:** backend completo al confirmar: congela código,
  nombre, precios de referencia, precio acordado, costo atribuido y política de
  costeo. Un precio inferior al mínimo exige permiso y razón administrativa. El
  frontend muestra mínimo y sugerido, acepta el precio acordado y solicita la razón
  únicamente a una cuenta autorizada cuando el precio queda bajo el mínimo.
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
- **Trazabilidad de implementación:** backend completo para reemplazar los datos y
  líneas de un borrador propio con versión optimista; un administrador puede
  corregir cualquier borrador. No se producen movimientos de stock ni caja. El
  frontend conserva el borrador creado durante el intento actual y lo actualiza
  antes de reintentar cuando cambian productos o condiciones después de un fallo
  de confirmación.
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
- **Trazabilidad de implementación:** backend completo mediante una operación
  administrativa atómica, idempotente y versionada. Conserva el total anterior,
  el nuevo total, la diferencia, la razón, el actor y la fecha; rechaza un total
  inferior al cobro neto vigente y recalcula el seguimiento desde los hechos.
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
