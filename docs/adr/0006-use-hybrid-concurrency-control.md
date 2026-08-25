# ADR-0006: Usar control de concurrencia híbrido en el borde hexagonal

**Date**: 2026-08-24
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

Nova debe impedir sobrepagos y el consumo concurrente del mismo stock, costo o
saldo de adelanto. Estas operaciones cruzan módulos sobre un único PostgreSQL,
pero el núcleo hexagonal no debe depender de Prisma, SQL ni tipos de transacción.
El volumen previsto es pequeño, aunque la exactitud financiera y física es crítica.

## Decision

Nova usa `READ COMMITTED` como aislamiento predeterminado, bloqueos pesimistas de
los recursos consumidos y versiones optimistas para detectar ediciones obsoletas.
La transacción se implementa mediante adaptadores o composición que satisfacen el
mismo puerto conductor, sin exponer el cliente transaccional al dominio.

## Alternatives Considered

### `SERIALIZABLE` para todas las operaciones

- **Pros**: ofrece una garantía general fuerte y detecta varias anomalías.
- **Cons**: aumenta abortos y reintentos, incluso en operaciones que no compiten, y
  no elimina la necesidad de idempotencia ni de transacciones bien delimitadas.
- **Why not**: es una carga operativa innecesaria para el MVP y oculta qué recurso
  de negocio debe serializar cada capacidad.

### Solo control optimista

- **Pros**: evita esperas por bloqueos y resulta sencillo para ediciones comunes.
- **Cons**: varias ventas o pagos pueden realizar trabajo completo antes de que uno
  falle; coordinar sumas y múltiples posiciones se vuelve más complejo.
- **Why not**: stock, saldo y costo se consumen en el momento y se benefician de una
  serialización explícita y corta.

### Transacciones administradas por el dominio

- **Pros**: hace visible la atomicidad dentro del flujo de negocio.
- **Cons**: introduce conceptos de persistencia y potencialmente tipos de Prisma o
  PostgreSQL en el núcleo.
- **Why not**: viola la dirección de dependencias hexagonal; la capacidad expresa
  el cambio completo y el adaptador garantiza su atomicidad técnica.

## Consequences

### Positive

- Pagos, inventario, costos y adelantos se protegen con mecanismos proporcionales
  a su riesgo.
- El dominio permanece independiente de NestJS, Prisma y PostgreSQL.
- Las pantallas pueden detectar versiones obsoletas y pedir una recarga explícita.
- El orden global de bloqueos reduce la probabilidad de deadlocks.

### Negative

- Cada operación crítica debe declarar y respetar qué filas bloquea.
- Se necesitan pruebas de integración concurrentes con PostgreSQL real.
- Prisma puede requerir SQL específico dentro del adaptador para algunos bloqueos.

### Risks

- **Deadlocks por orden inconsistente**: imponer un orden global y reintentos
  técnicos acotados para órdenes idempotentes.
- **Bloqueos demasiado largos**: validar I/O y preparar datos antes de abrir la
  transacción; medir tiempo de espera y duración.
- **Fuga de infraestructura al núcleo**: probar fronteras de importación y mantener
  clientes transaccionales exclusivamente en adaptadores y composición.
