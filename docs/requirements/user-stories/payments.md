# Pagos, cierres y cancelaciones

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story PAY-001 — Registrar un pago en una venta propia

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo para registrar cobros en una
  venta propia con efectivo, Yape, Plin o POS. El pago, el nuevo saldo, la versión
  de la venta y la entrada de caja se confirman de manera atómica e idempotente;
  un cobro superior al saldo se rechaza indicando el saldo disponible. El frontend
  incorpora el cobro posterior desde el detalle, valida el saldo, permite usar su
  importe exacto y conserva la misma clave idempotente durante un reintento.
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
- **Trazabilidad de implementación:** backend completo; una cuenta con
  `payments:create-any` puede cobrar ventas ajenas y se conservan por separado el
  creador de la venta y quien registró el pago. La acción frontend se habilita por
  capacidad y el rastro identifica la cuenta que registró cada cobro.
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
- **Trazabilidad de implementación:** backend completo mediante cierre atómico,
  idempotente y versionado. Un cierre con saldo exige razón, registra el importe
  condonado y se distingue de una venta pagada mediante el estado
  `closed-with-balance`; un cierre sin saldo queda como completo.
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
- **Trazabilidad de implementación:** backend completo mediante una operación
  administrativa atómica, versionada e idempotente. La cancelación exige una
  decisión explícita por cada línea, libera reservas, registra retornos físicos y
  su costo histórico, conserva productos no retornados y crea una salida de caja
  únicamente por el reembolso manual declarado.
- **Como** administrador
- **quiero** cancelar una venta indicando pagos, entregas y productos retornados
- **para** revertir únicamente los efectos que realmente correspondan.

#### Criterios de aceptación

- **Escenario:** Cancelación de venta con productos no entregados
- **Dado:** que la venta contiene unidades reservadas aún presentes en el negocio
- **Y dado:** que indiqué el tratamiento de los pagos recibidos
- **Cuando:** confirmo la cancelación con una razón
- **Entonces:** la venta queda cancelada, las unidades no entregadas se liberan y los movimientos monetarios permanecen trazables.

- **Escenario:** Reembolso manual al cancelar
- **Dado:** que la venta posee un pago neto vigente
- **Cuando:** indico cuánto dinero se devolvió y confirmo la cancelación
- **Entonces:** el sistema registra exactamente ese importe y su método, sin superar el pago neto ni calcular automáticamente un reembolso total.

- **Escenario:** Cancelación sin devolución de dinero
- **Dado:** que el acuerdo no incluyó devolver dinero al cliente
- **Cuando:** confirmo la cancelación con reembolso igual a cero
- **Entonces:** no se crea salida de caja y los cobros anteriores permanecen visibles.

- **Escenario:** Producto entregado que retorna al negocio
- **Dado:** que una unidad ya fue entregada al cliente
- **Cuando:** indico que retorna, su ubicación y si queda disponible o en revisión
- **Entonces:** el inventario y su costo histórico ingresan en la condición elegida.

- **Escenario:** Producto entregado que no retorna
- **Dado:** que una unidad ya fue entregada al cliente
- **Cuando:** indico que no retorna al cancelar
- **Entonces:** la cancelación conserva esa decisión sin incrementar inventario ni costo.

- **Escenario:** Tratamiento incompleto de las líneas
- **Dado:** que la venta contiene unidades entregadas o reservadas
- **Cuando:** intento cancelar sin declarar el tratamiento de cada línea
- **Entonces:** el sistema rechaza toda la operación sin efectos parciales.

### User Story PAY-005 — Corregir un pago sin borrar su historia

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo mediante correcciones
  parciales o totales, acumulables, atómicas e idempotentes. El pago original se
  conserva, su estado refleja la corrección y cada compensación crea una salida de
  caja con el mismo método, razón, actor y fecha.
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
