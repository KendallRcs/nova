# Clientes

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story CUS-001 — Identificar a un cliente con saldo pendiente

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo para registrar, buscar y
  actualizar clientes, con teléfono canónico único y control optimista de versión.
- **Como** empleado
- **quiero** asociar una venta con deuda a un cliente identificable
- **para** saber quién debe pagar el saldo.

#### Criterios de aceptación

- **Escenario:** Venta con saldo y cliente identificado
- **Dado:** que registré nombre y un teléfono que no pertenece a otro cliente
- **Cuando:** confirmo una venta que conservará saldo pendiente
- **Entonces:** la venta queda vinculada al cliente y aparece en su deuda consolidada.

- **Escenario:** Teléfono ya utilizado
- **Dado:** que otro cliente posee el mismo teléfono normalizado
- **Cuando:** intento crear un nuevo cliente con ese número
- **Entonces:** el sistema evita el duplicado y me permite seleccionar al cliente existente.

### User Story CUS-002 — Registrar datos opcionales de un cliente

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo; DNI y dirección permanecen
  opcionales tanto al registrar como al actualizar.
- **Como** empleado
- **quiero** registrar dirección y DNI de manera opcional
- **para** identificar mejor al cliente cuando el negocio lo necesite.

#### Criterios de aceptación

- **Escenario:** Cliente sin documentos adicionales
- **Dado:** que proporcioné nombre y teléfono válidos
- **Cuando:** guardo al cliente sin dirección ni DNI
- **Entonces:** el cliente queda registrado sin exigir esos datos opcionales.

### User Story CUS-003 — Consultar historial y deuda consolidada

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo mediante un modelo de
  lectura CQRS-lite. Consolida identidades fusionadas, ventas no borrador, pagos y
  correcciones, reembolsos, saldos, atrasos y vencimientos sin exponer costos ni
  márgenes.
- **Como** empleado
- **quiero** consultar las ventas, pagos y saldo total de un cliente
- **para** conocer su situación antes de acordar una nueva venta.

#### Criterios de aceptación

- **Escenario:** Cliente con varias operaciones
- **Dado:** que el cliente tiene ventas y pagos registrados por uno o más empleados
- **Cuando:** consulto su historial
- **Entonces:** veo sus operaciones, montos cobrados, saldos pendientes y estados sin acceder a costos ni márgenes.

- **Escenario:** Consulta mediante una identidad fusionada
- **Dado:** que el cliente posee uno o más registros absorbidos por un principal
- **Cuando:** consulto la cuenta usando cualquiera de esas identidades
- **Entonces:** obtengo el cliente principal y el historial consolidado de todas sus identidades.

- **Escenario:** Operaciones cerradas o canceladas en el historial
- **Dado:** que el cliente posee ventas finalizadas o canceladas
- **Cuando:** consulto su deuda consolidada
- **Entonces:** esas operaciones permanecen visibles pero no incrementan la deuda activa.

### User Story CUS-004 — Fusionar clientes duplicados

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo con datos resueltos,
  bloqueo ordenado, versiones optimistas, idempotencia y auditoría del administrador.
- **Como** administrador
- **quiero** fusionar dos registros de la misma persona
- **para** mantener un único historial comercial y financiero.

#### Criterios de aceptación

- **Escenario:** Fusión con cliente principal seleccionado
- **Dado:** que elegí el registro principal y resolví los datos en conflicto
- **Cuando:** confirmo la fusión
- **Entonces:** las operaciones quedan asociadas al cliente principal, el duplicado se desactiva y se conserva la trazabilidad de la fusión.

- **Escenario:** Fusión basada en datos desactualizados
- **Dado:** que uno de los clientes cambió después de que revisé sus datos
- **Cuando:** intento confirmar la fusión con una versión anterior
- **Entonces:** el sistema rechaza la operación sin modificar ninguno de los registros.

- **Escenario:** Reintento de la misma fusión
- **Dado:** que una fusión ya fue confirmada con una clave idempotente
- **Cuando:** reintento exactamente la misma operación con esa clave
- **Entonces:** recibo el resultado original sin crear otra fusión.

---
