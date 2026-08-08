# Clientes

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story CUS-001 — Identificar a un cliente con saldo pendiente

- **Estado:** Confirmada
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
- **Como** empleado
- **quiero** consultar las ventas, pagos y saldo total de un cliente
- **para** conocer su situación antes de acordar una nueva venta.

#### Criterios de aceptación

- **Escenario:** Cliente con varias operaciones
- **Dado:** que el cliente tiene ventas y pagos registrados por uno o más empleados
- **Cuando:** consulto su historial
- **Entonces:** veo sus operaciones, montos cobrados, saldos pendientes y estados sin acceder a costos ni márgenes.

### User Story CUS-004 — Fusionar clientes duplicados

- **Estado:** Confirmada
- **Como** administrador
- **quiero** fusionar dos registros de la misma persona
- **para** mantener un único historial comercial y financiero.

#### Criterios de aceptación

- **Escenario:** Fusión con cliente principal seleccionado
- **Dado:** que elegí el registro principal y resolví los datos en conflicto
- **Cuando:** confirmo la fusión
- **Entonces:** las operaciones quedan asociadas al cliente principal, el duplicado se desactiva y se conserva la trazabilidad de la fusión.

---

