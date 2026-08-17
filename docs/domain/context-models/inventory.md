# Modelo táctico de Inventario

**Estado:** versión inicial confirmada el 2026-08-16.

Inventario es autoridad sobre dónde se encuentran las unidades y cuáles pueden ofrecerse. No decide precios, acuerdos comerciales, pagos ni costos de compra.

## Agregado Existencia

### Identidad y frontera

La raíz `Existencia` representa la posición actual de un `ProductoId` en una `UbicacionId`. Su identidad conceptual es la combinación estable de ambos valores.

Mantiene:

- cantidad física;
- cantidad reservada;
- cantidad en revisión;
- reservas activas asociadas a líneas de venta;
- versión de concurrencia.

La existencia no contiene el Producto de Catálogo ni la Venta. Los referencia mediante `ProductoId`, `VentaId` y `LineaVentaId`.

### Cantidades derivadas

```text
cantidad disponible = cantidad física - cantidad reservada - cantidad en revisión
```

Todas las cantidades son enteras y no negativas. Debe cumplirse siempre:

```text
cantidad reservada + cantidad en revisión <= cantidad física
```

### Reserva activa

`Reserva de inventario` es una entidad interna identificable porque debe liberarse o consumirse de manera precisa. Conserva venta, línea de venta, ubicación, cantidad inicial, cantidad activa y fecha.

Solo las reservas activas forman parte de la frontera cargada por `Existencia`. Su historia completa permanece en movimientos inmutables, evitando que el agregado crezca indefinidamente.

### Comportamientos

- `abrirExistencia()`;
- `ingresar()`;
- `reservar()`;
- `liberarReserva()`;
- `entregarDisponible()`;
- `entregarReserva()`;
- `recibirRetornoEnRevision()`;
- `aprobarRetornoParaVenta()`;
- `darDeBaja()`;
- `ajustarAlConteo()`.

## Invariantes de Existencia

1. Ninguna operación produce cantidades físicas, reservadas, en revisión o disponibles negativas.
2. Reservar exige disponibilidad suficiente y no cambia la cantidad física.
3. Liberar exige una reserva activa suficiente, reduce lo reservado y aumenta lo disponible.
4. Entregar unidades disponibles reduce cantidad física y disponible en la misma magnitud.
5. Entregar unidades reservadas reduce cantidad física, reservada y reserva activa en la misma magnitud.
6. Una reserva pertenece a una venta, línea, producto y ubicación concretos; no se reutiliza para otra operación.
7. Una baja ordinaria solo consume unidades disponibles. Si alcanzaría una reserva o unidades en revisión, primero debe resolverse explícitamente su situación.
8. Un retorno pendiente de revisión aumenta cantidad física y cantidad en revisión, pero no disponibilidad.
9. Aprobar un retorno apto reduce cantidad en revisión y aumenta disponibilidad sin cambiar cantidad física.
10. Un ajuste de conteo registra cantidad observada, diferencia, razón, actor y fecha; nunca sobrescribe silenciosamente el valor anterior.
11. Si un conteo resultaría menor que las cantidades reservadas y en revisión, el ajuste se bloquea hasta resolverlas explícitamente.
12. Dos comandos no pueden consumir la misma disponibilidad o reserva usando una versión obsoleta.

## Agregado Movimiento de inventario

Cada cambio confirmado crea un `Movimiento de inventario` inmutable como raíz independiente de historial, no como hijo mutable de `Existencia`.

Conserva:

- producto y ubicación;
- tipo y cantidad;
- valores anteriores y resultantes relevantes;
- causa de negocio, como venta, compra, devolución, traslado o carga inicial;
- actor y fecha;
- razón cuando la operación la exige;
- referencia de costo cuando sea necesaria para rentabilidad o pérdida.

Tipos iniciales:

- apertura;
- ingreso por compra;
- reserva;
- liberación;
- entrega;
- retorno en revisión;
- habilitación para venta;
- traslado de salida y entrada;
- baja;
- ajuste positivo o negativo.

Los movimientos no se editan ni eliminan. Una corrección genera un nuevo movimiento compensatorio.

## Traslado de inventario

`Traslado` es una operación identificable que coordina dos agregados `Existencia`: origen y destino.

Invariantes:

1. Origen y destino son diferentes.
2. Producto y cantidad positiva son obligatorios.
3. El origen posee disponibilidad suficiente.
4. La salida y la entrada se confirman en una sola transacción.
5. Se conservan traslado, responsable, fecha y movimientos emparejados.
6. Un traslado no mueve reservas; solo unidades disponibles.

No se crea un único agregado que contenga todas las existencias de la tienda: eso provocaría contención innecesaria entre productos independientes.

## Estados de una reserva

| Estado | Significado |
| --- | --- |
| Activa | Mantiene unidades bloqueadas para una línea de venta |
| Parcialmente consumida | Parte fue entregada y una cantidad continúa bloqueada |
| Consumida | Toda la cantidad fue entregada |
| Liberada | La cantidad restante volvió a estar disponible |

`Consumida` y `Liberada` son estados históricos; dejan de contribuir a la cantidad reservada activa.

## Eventos de Inventario

| Evento | Hecho representado |
| --- | --- |
| `ExistenciaAbierta` | Se registró la posición inicial de un producto en una ubicación |
| `InventarioIngresado` | Un ingreso físico por compra fue confirmado |
| `InventarioReservado` | Unidades quedaron bloqueadas para una línea de venta |
| `ReservaLiberada` | Unidades reservadas volvieron a estar disponibles |
| `InventarioEntregado` | Unidades salieron físicamente hacia un cliente |
| `RetornoRecibidoEnRevision` | Unidades retornaron sin quedar disponibles todavía |
| `RetornoHabilitadoParaVenta` | Unidades revisadas quedaron disponibles |
| `InventarioTrasladado` | Salida e ingreso entre ubicaciones se confirmaron juntos |
| `InventarioDadoDeBaja` | Unidades no vendibles salieron de la existencia |
| `InventarioAjustado` | Un conteo corrigió una diferencia de existencia |

Los eventos describen hechos ya persistidos. `ReservarInventario` o `TrasladarInventario` serían comandos, no eventos.

## Costos y pérdidas

Inventario conserva referencias de costo necesarias en movimientos, pero no fija todavía el método para atribuir costos cuando existen compras a precios diferentes. FIFO, promedio ponderado u otra política se decidirá antes del modelo de datos.

Una baja debe recibir el costo atribuible calculado por la política vigente para que Analítica reconozca la pérdida. El agregado no consulta Prisma ni calcula costos leyendo compras directamente.

## Carga inicial

La importación confirmada coordina atómicamente:

- creación de productos en Catálogo;
- apertura o incremento inicial de `Existencia` por tienda y almacén;
- movimientos de apertura con su costo inicial;
- registro de que la herramienta de inicialización ya fue utilizada.

No crea compras, ventas ni movimientos de caja. Si falla cualquier fila u operación, no se confirma ninguna.
