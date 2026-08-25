# ADR-0005: Usar costo promedio móvil global por producto

**Date**: 2026-08-23
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

Nova compra un mismo producto a costos diferentes, pero no identifica físicamente el lote de cada unidad cuando vende. La tienda y el almacén pertenecen al mismo negocio y los traslados no deberían alterar el costo. El sistema necesita márgenes históricos explicables y debe permitir una futura evolución a FIFO si la operación comienza a controlar lotes.

## Decision

Nova utiliza costo promedio móvil global por producto y conserva el costo de cada compra. Al confirmar una venta, congela el costo total atribuido a sus líneas y registra la política y versión utilizadas. El diseño encapsula la atribución detrás de una política de costeo para permitir sustituirla en el futuro.

## Alternatives Considered

### FIFO

- **Pros**: conserva capas de costo y consume primero las unidades más antiguas.
- **Cons**: exige afirmar y mantener una relación con lotes que el negocio no identifica al vender, trasladar o devolver.
- **Why not**: añade complejidad sin representar mejor la operación actual.

### Último costo de compra

- **Pros**: cálculo muy simple y útil para estimar reposición.
- **Cons**: valora todo el inventario como la compra más reciente y distorsiona el margen histórico.
- **Why not**: se conserva como referencia para precios, no como costo de venta.

### Promedio por ubicación

- **Pros**: mantiene valores separados entre tienda y almacén.
- **Cons**: un traslado obliga a mover costo y puede valorar distinto el mismo producto dentro del negocio.
- **Why not**: las ubicaciones son físicas, no unidades económicas independientes.

## Consequences

### Positive

- El costo refleja las unidades actuales sin inventar identificación de lotes.
- Los traslados no cambian costos.
- Cada venta conserva un costo histórico estable aunque ocurran compras posteriores.
- El último costo sigue disponible para sugerir revisión de precios.

### Negative

- El sistema no puede afirmar retrospectivamente qué lote físico fue vendido.
- Cancelaciones, reservas y retornos deben mover también el valor atribuido.
- Las divisiones requieren distribuir céntimos residuales.

### Risks

- **Consumo concurrente del mismo valor disponible**: proteger la posición de costo mediante bloqueo o versión en la misma transacción de la venta.
- **Migración futura a FIFO**: conservar compras y asignaciones inmutables, versionar la política (`MOVING_AVERAGE_V1`) y crear una capa FIFO de apertura desde la cantidad y valor existentes en una fecha de corte. Las ventas históricas mantienen su política original.
- **Pretender reconstruir lotes pasados**: una migración futura aplica hacia adelante; reconstrucción FIFO retrospectiva solo sería posible si desde ahora se almacenaran y operaran capas, complejidad descartada para el MVP.
