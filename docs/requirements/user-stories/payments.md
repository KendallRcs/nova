# Pagos, cierres y cancelaciones

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story PAY-001 — Registrar un pago en una venta propia

- **Estado:** Confirmada
- **Como** empleado
- **quiero** registrar un pago posterior en una venta que creé
- **para** mantener actualizado el saldo del cliente.

#### Criterios de aceptación

- **Escenario:** Pago autorizado
- **Dado:** que soy el creador de la venta
- **Y dado:** que indiqué monto y método entre efectivo, Yape, Plin o POS
- **Cuando:** confirmo el pago
- **Entonces:** disminuye el saldo y se conserva el usuario, método, fecha y monto del movimiento.

- **Escenario:** Empleado intenta pagar una venta ajena
- **Dado:** que otro empleado creó la venta
- **Cuando:** intento registrar un pago en ella
- **Entonces:** el sistema rechaza la operación.

- **Escenario:** Pago superior al saldo vigente
- **Dado:** que el monto indicado supera el saldo pendiente de la venta
- **Cuando:** intento confirmar el pago
- **Entonces:** el sistema rechaza la operación y muestra el saldo máximo que puede registrarse.

### User Story PAY-002 — Registrar pagos en cualquier venta

- **Estado:** Confirmada
- **Como** administrador
- **quiero** registrar pagos en ventas de cualquier empleado
- **para** mantener correctos los saldos cuando atiendo al cliente.

#### Criterios de aceptación

- **Escenario:** Administrador cobra una venta ajena
- **Dado:** que la venta fue creada por otro usuario
- **Cuando:** registro un pago válido
- **Entonces:** el saldo se actualiza conservando por separado al creador de la venta y al registrador del pago.

### User Story PAY-003 — Finalizar una venta con saldo no cobrado

- **Estado:** Confirmada
- **Como** administrador
- **quiero** cerrar una venta sin cobrar todo el total acordado
- **para** representar un acuerdo informal sin ocultar la diferencia.

#### Criterios de aceptación

- **Escenario:** Cierre incompleto autorizado
- **Dado:** que la venta conserva saldo pendiente
- **Y dado:** que escribí una razón
- **Cuando:** confirmo el cierre incompleto
- **Entonces:** la venta queda finalizada y el saldo no cobrado se registra como monto condonado o pérdida comercial.

### User Story PAY-004 — Cancelar una venta conservando sus efectos reales

- **Estado:** Confirmada
- **Como** administrador
- **quiero** cancelar una venta indicando pagos, entregas y productos retornados
- **para** revertir únicamente los efectos que realmente correspondan.

#### Criterios de aceptación

- **Escenario:** Cancelación de venta con productos no entregados
- **Dado:** que la venta contiene unidades reservadas aún presentes en el negocio
- **Y dado:** que indiqué el tratamiento de los pagos recibidos
- **Cuando:** confirmo la cancelación con una razón
- **Entonces:** la venta queda cancelada, las unidades no entregadas se liberan y los movimientos monetarios permanecen trazables.

### User Story PAY-005 — Corregir un pago sin borrar su historia

- **Estado:** Confirmada
- **Como** administrador
- **quiero** anular o compensar un pago incorrecto con una razón
- **para** corregir el saldo sin ocultar la operación original.

#### Criterios de aceptación

- **Escenario:** Pago confirmado incorrectamente
- **Dado:** que existe un pago confirmado
- **Y dado:** que escribí una razón de corrección
- **Cuando:** confirmo su anulación o movimiento compensatorio
- **Entonces:** el saldo refleja la corrección y ambos movimientos permanecen asociados con sus responsables y fechas.

---

