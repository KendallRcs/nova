# Inventario

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story INV-001 — Consultar existencias por ubicación y disponibilidad

- **Estado:** Confirmada
- **Como** empleado
- **quiero** consultar el inventario de tienda y almacén
- **para** saber cuántas unidades pueden ofrecerse realmente.

#### Criterios de aceptación

- **Escenario:** Producto con unidades reservadas
- **Dado:** que un producto posee existencias físicas y algunas están reservadas
- **Cuando:** consulto su inventario
- **Entonces:** veo por ubicación las cantidades físicas, reservadas y disponibles.

### User Story INV-002 — Trasladar inventario entre ubicaciones

- **Estado:** Confirmada
- **Como** administrador
- **quiero** trasladar unidades entre tienda y almacén
- **para** reflejar dónde se encuentra físicamente la mercancía.

#### Criterios de aceptación

- **Escenario:** Traslado con disponibilidad suficiente
- **Dado:** que la ubicación de origen tiene suficientes unidades disponibles
- **Cuando:** confirmo el producto, cantidad, origen y destino
- **Entonces:** el movimiento reduce el origen, incrementa el destino y conserva responsable y fecha como una única operación.

- **Escenario:** Traslado sin disponibilidad suficiente
- **Dado:** que la cantidad solicitada supera las unidades disponibles en el origen
- **Cuando:** intento confirmar el traslado
- **Entonces:** el sistema rechaza la operación sin modificar ninguna ubicación.

### User Story INV-003 — Dar de baja mercancía no vendible

- **Estado:** Confirmada
- **Como** administrador
- **quiero** dar de baja unidades dañadas, perdidas o no vendibles
- **para** mantener el inventario real y conocer la pérdida asociada.

#### Criterios de aceptación

- **Escenario:** Baja de unidades disponibles
- **Dado:** que existen unidades disponibles en la ubicación indicada
- **Y dado:** que seleccioné una categoría y escribí una razón
- **Cuando:** confirmo la baja
- **Entonces:** disminuye el inventario físico y disponible y queda registrado su costo como pérdida de inventario.

- **Escenario:** Baja que afectaría unidades reservadas
- **Dado:** que la cantidad disponible no cubre la baja solicitada porque existen unidades reservadas
- **Cuando:** intento confirmar la baja
- **Entonces:** el sistema bloquea la operación e identifica las reservas que deben resolverse.

### User Story INV-004 — Ajustar una diferencia de conteo físico

- **Estado:** Confirmada
- **Como** administrador
- **quiero** registrar una diferencia encontrada durante un conteo
- **para** reconciliar el sistema con la existencia física sin inventar una causa.

#### Criterios de aceptación

- **Escenario:** Conteo distinto del stock esperado
- **Dado:** que conté físicamente un producto en una ubicación
- **Y dado:** que escribí la razón del ajuste
- **Cuando:** confirmo la cantidad física encontrada
- **Entonces:** el sistema registra la diferencia como ajuste auditable y actualiza la existencia de esa ubicación.

### User Story INV-005 — Reservar unidades sin retirarlas físicamente

- **Estado:** Confirmada
- **Como** empleado
- **quiero** reservar unidades de una venta para un cliente
- **para** evitar que se ofrezcan mientras permanecen en tienda o almacén.

#### Criterios de aceptación

- **Escenario:** Reserva con unidades disponibles
- **Dado:** que la ubicación elegida posee cantidad disponible suficiente
- **Cuando:** confirmo la reserva de la línea de venta
- **Entonces:** aumenta la cantidad reservada y disminuye la disponible sin cambiar la existencia física.

### User Story INV-006 — Liberar inventario de una reserva cancelada

- **Estado:** Confirmada
- **Como** administrador
- **quiero** liberar las unidades de una reserva cancelada que no fueron entregadas
- **para** ofrecerlas nuevamente a otros clientes.

#### Criterios de aceptación

- **Escenario:** Cancelación de una línea reservada y no entregada
- **Dado:** que las unidades siguen físicamente en su ubicación
- **Cuando:** confirmo la cancelación y su liberación
- **Entonces:** disminuye la cantidad reservada y aumenta la disponible en la misma ubicación.

### User Story INV-007 — Revisar mercancía devuelta antes de venderla

- **Estado:** Confirmada
- **Como** administrador
- **quiero** clasificar el estado de un producto que retorna
- **para** impedir que una unidad defectuosa vuelva accidentalmente al stock vendible.

#### Criterios de aceptación

- **Escenario:** Producto retornado pendiente de revisión
- **Dado:** que una devolución incluye retorno físico
- **Cuando:** marco la unidad como pendiente de revisión
- **Entonces:** el producto figura físicamente en la ubicación elegida pero no aumenta el stock disponible.

- **Escenario:** Producto retornado apto para venta
- **Dado:** que revisé una unidad retornada
- **Cuando:** la clasifico como apta para venta
- **Entonces:** la unidad se incorpora al stock disponible de la ubicación elegida.

---

