# Devoluciones

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story RET-001 — Aprobar una devolución total o parcial

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend y frontend completos. Desde el detalle
  administrativo se eligen únicamente unidades entregadas todavía retornables; la
  interfaz anticipa la reducción comercial y el eventual reembolso antes de
  confirmar la operación idempotente.
- **Como** administrador
- **quiero** devolver una o varias unidades de una venta
- **para** reembolsar al cliente sin cancelar productos que no forman parte de la devolución.

#### Criterios de aceptación

- **Escenario:** Devolución parcial de una venta
- **Dado:** que seleccioné líneas y cantidades previamente vendidas
- **Y dado:** que escribí una razón obligatoria
- **Cuando:** apruebo la devolución
- **Entonces:** se crea una devolución vinculada a la venta únicamente por las cantidades seleccionadas.

- **Escenario:** Exceso pagado después de retirar productos
- **Dado:** que el pago neto supera el nuevo total comercial después de retirar las unidades seleccionadas
- **Cuando:** apruebo la devolución
- **Entonces:** el sistema calcula como reembolso exactamente el exceso pagado y deja el saldo en cero.

- **Escenario:** Devolución durante una venta todavía pendiente de pago
- **Dado:** que al retirar las unidades seleccionadas el pago neto no supera el nuevo total comercial
- **Cuando:** apruebo la devolución
- **Entonces:** el sistema reduce el total y recalcula el saldo sin generar un reembolso.

### User Story RET-002 — Registrar reembolso y retorno físico por separado

- **Estado:** Confirmada
- **Trazabilidad de implementación:** el formulario trata cada línea por separado,
  permite declarar si vuelve físicamente y, cuando retorna, exige ubicación y
  condición. El método financiero se solicita solo cuando el nuevo total produce
  un exceso pagado reembolsable.
- **Como** administrador
- **quiero** indicar si el producto retorna y el método de un eventual reembolso
- **para** reflejar correctamente el efecto financiero y físico de una devolución.

#### Criterios de aceptación

- **Escenario:** Reembolso sin retorno por producto defectuoso
- **Dado:** que la devolución fue aprobada con razón obligatoria
- **Y dado:** que indiqué que el producto no retorna
- **Cuando:** confirmo la devolución
- **Entonces:** se registra el reembolso calculado cuando existe exceso pagado sin incrementar el inventario.

- **Escenario:** Reembolso con retorno físico
- **Dado:** que la devolución fue aprobada con razón obligatoria
- **Y dado:** que indiqué ubicación y condición de retorno
- **Cuando:** confirmo la devolución
- **Entonces:** se registra el eventual reembolso calculado y la unidad retorna con la disponibilidad correspondiente a su condición.

- **Escenario:** Reembolso mediante un método diferente al pago original
- **Dado:** que la devolución produce un exceso pagado reembolsable
- **Cuando:** selecciono efectivo, Yape, Plin o POS y confirmo la devolución
- **Entonces:** el sistema registra el método realmente utilizado sin exigir que coincida con el pago original.

### User Story RET-003 — Impedir devoluciones no autorizadas

- **Estado:** Confirmada
- **Trazabilidad de implementación:** tanto el endpoint como la acción de interfaz
  requieren `returns:approve`; una cuenta sin esa capacidad no recibe la opción
  administrativa y el backend conserva la autorización final.
- **Como** administrador
- **quiero** reservar la aprobación de devoluciones al rol administrativo
- **para** controlar salidas de dinero y alteraciones de inventario.

#### Criterios de aceptación

- **Escenario:** Empleado intenta aprobar una devolución
- **Dado:** que inicié sesión como empleado
- **Cuando:** intento confirmar una devolución
- **Entonces:** el sistema rechaza la operación.

## Trazabilidad de implementación

- Dominio y reglas monetarias: `apps/api/src/modules/sales/hexagon/domain/sale.ts`.
- Caso de uso y puerto: `approve-sale-return.ts` y `sale-return-book.ts`.
- Persistencia atómica: `prisma-sale-return-book.ts` y migración
  `20261018130000_add_returns`.
- Contrato HTTP: `POST /api/v1/sales/{saleId}/returns`.
- Lectura: el listado descuenta reembolsos del pago neto y el detalle expone las
  devoluciones, ocultando su costo sin permiso financiero.
- Verificación: pruebas unitarias de regla, contrato HTTP e integración real con
  PostgreSQL cubren devolución sin exceso, reembolso exacto, retorno a revisión e
  idempotencia.

---

