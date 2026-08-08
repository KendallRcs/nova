# Devoluciones

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story RET-001 — Aprobar una devolución total o parcial

- **Estado:** Confirmada
- **Como** administrador
- **quiero** devolver una o varias unidades de una venta
- **para** reembolsar al cliente sin cancelar productos que no forman parte de la devolución.

#### Criterios de aceptación

- **Escenario:** Devolución parcial de una venta
- **Dado:** que seleccioné líneas y cantidades previamente vendidas
- **Y dado:** que escribí una razón obligatoria
- **Cuando:** apruebo la devolución
- **Entonces:** se crea una devolución vinculada a la venta únicamente por las cantidades seleccionadas.

- **Escenario:** Reembolso superior a lo pagado por las unidades devueltas
- **Dado:** que el monto solicitado supera el importe neto efectivamente pagado y todavía no reembolsado por las unidades seleccionadas
- **Cuando:** intento aprobar la devolución
- **Entonces:** el sistema rechaza el reembolso e informa el máximo permitido.

### User Story RET-002 — Registrar reembolso y retorno físico por separado

- **Estado:** Confirmada
- **Como** administrador
- **quiero** indicar cuánto dinero se devuelve y si el producto retorna
- **para** reflejar correctamente el efecto financiero y físico de una devolución.

#### Criterios de aceptación

- **Escenario:** Reembolso sin retorno por producto defectuoso
- **Dado:** que la devolución fue aprobada con razón obligatoria
- **Y dado:** que indiqué que el producto no retorna
- **Cuando:** confirmo monto y método del reembolso
- **Entonces:** se registra la salida de dinero sin incrementar el inventario.

- **Escenario:** Reembolso con retorno físico
- **Dado:** que la devolución fue aprobada con razón obligatoria
- **Y dado:** que indiqué ubicación y condición de retorno
- **Cuando:** confirmo monto y método del reembolso
- **Entonces:** se registra la salida de dinero y la unidad retorna con la disponibilidad correspondiente a su condición.

- **Escenario:** Reembolso mediante un método diferente al pago original
- **Dado:** que la devolución fue aprobada y existe un importe reembolsable
- **Cuando:** selecciono efectivo, Yape, Plin o POS y confirmo el reembolso
- **Entonces:** el sistema registra el método realmente utilizado sin exigir que coincida con el pago original.

### User Story RET-003 — Impedir devoluciones no autorizadas

- **Estado:** Confirmada
- **Como** administrador
- **quiero** reservar la aprobación de devoluciones al rol administrativo
- **para** controlar salidas de dinero y alteraciones de inventario.

#### Criterios de aceptación

- **Escenario:** Empleado intenta aprobar una devolución
- **Dado:** que inicié sesión como empleado
- **Cuando:** intento confirmar una devolución
- **Entonces:** el sistema rechaza la operación.

---

