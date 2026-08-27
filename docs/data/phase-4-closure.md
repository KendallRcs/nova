# Cierre de la Fase 4 — Arquitectura de datos

**Estado:** cerrada el 2026-08-24.

## Resultado

Nova posee una arquitectura de datos inicial confirmada para catálogo, clientes,
ventas, inventario, costos, compras, adelantos, caja, gastos, acceso e importación
inicial. El diseño preserva las fronteras del dominio y define cómo PostgreSQL y
Prisma las implementarán sin convertirse en dependencias del núcleo hexagonal.

Al cerrar esta fase todavía no existían un schema Prisma ni una base desplegada.
La implementación posterior comenzó con la migración de categorías; el estado
vigente se registra en [Arquitectura de datos](README.md).

## Fuentes de verdad

| Documento | Responsabilidad |
| --- | --- |
| [Fundamentos](foundations.md) | Identidad, dinero, costeo, fechas, auditoría y eliminación |
| [Modelo relacional](relational-model.md) | Relaciones, propiedad, cardinalidades y proyecciones |
| [Integridad](integrity-constraints.md) | Restricciones estructurales y reglas transaccionales |
| [Concurrencia](transactions-and-concurrency.md) | Atomicidad, bloqueos, versiones e idempotencia |
| [Lecturas](indexes-and-read-models.md) | Índices, CQRS-lite, dashboards y reconciliaciones |
| [ERD](entity-relationship-diagram.md) | Visualización segmentada de relaciones |
| [Mapeo físico](prisma-postgresql-mapping.md) | Tipos, modelos Prisma, SQL personalizado y migraciones |

Los requerimientos funcionales siguen viviendo en `docs/requirements/` y el
modelo del negocio en `docs/domain/`; los documentos de datos no los sustituyen.

## Decisiones confirmadas

- UUID ordenados, preferentemente UUIDv7, generados antes de persistir.
- Dinero en céntimos enteros de 64 bits y cantidades físicas enteras.
- Costo promedio móvil global por producto, con costo de venta congelado y puerta
  de evolución a FIFO desde una fecha de corte.
- Atribución proporcional de pagos para devoluciones parciales.
- Instantes UTC, reportes en `America/Lima` y vencimientos como fecha civil.
- Historial explícito y operaciones compensatorias en vez de borrado destructivo.
- Stock físico por tienda/almacén y costo global independiente de ubicación.
- Posiciones actuales protegidas y reconciliables con libros inmutables.
- Transacciones técnicas fuera del núcleo hexagonal.
- `READ COMMITTED`, bloqueos pesimistas, versiones optimistas e idempotencia.
- CQRS-lite sobre la misma base, sin event sourcing ni proyecciones materializadas
  iniciales.
- Tipos PostgreSQL explícitos y migraciones SQL para `CHECK`, índices parciales y
  vistas no representadas de forma estable por Prisma.
- Enums PostgreSQL para vocabularios cerrados y tablas para datos configurables.

## ADR vigentes originados en la fase

- [ADR-0003: UUID ordenables](../adr/0003-use-time-ordered-uuids.md).
- [ADR-0004: dinero en céntimos enteros](../adr/0004-store-money-as-integer-cents.md).
- [ADR-0005: costo promedio móvil global](../adr/0005-use-global-moving-average-cost.md).
- [ADR-0006: concurrencia híbrida](../adr/0006-use-hybrid-concurrency-control.md).
- [ADR-0007: enums para vocabularios cerrados](../adr/0007-use-postgresql-enums-for-closed-vocabularies.md).

## Obligaciones para la implementación

- El núcleo no importa NestJS, Prisma, PostgreSQL ni modelos generados.
- Los repositorios persisten agregados; las query adapters atienden lecturas
  cruzadas.
- Toda operación crítica aplica posición, historial, caja y costo en un solo commit.
- Los bloqueos siguen un orden global y se prueban con PostgreSQL real.
- Toda migración se revisa antes de aplicar y conserva SQL personalizado.
- La base debe poder reconstruirse desde cero únicamente con migraciones y seeds
  técnicos.
- Los constraints, mapeadores, repositorios, carreras y queries tienen pruebas en
  su frontera correspondiente.
- Dinero `BigInt` se traduce a un contrato externo sin pérdida y nunca se expone
  accidentalmente como un tipo Prisma.

## Decisiones deliberadamente diferidas

No se han convertido en elecciones implícitas:

- versiones de Node.js, NestJS, Prisma, PostgreSQL y Next.js;
- gestor y herramienta del monorepo;
- rutas físicas de frontend, backend, paquetes y schema;
- archivo Prisma único o dividido;
- librería concreta para UUIDv7;
- contratos HTTP, serialización monetaria y manejo de errores;
- parámetros de sesión, hashing y rate limiting;
- proveedor y ciclo de vida de imágenes/comprobantes;
- infraestructura local, CI/CD, hosting, respaldos y observabilidad;
- objetivos numéricos de rendimiento, timeouts y reintentos;
- `pg_trgm`, vistas materializadas, cache, outbox, colas o múltiples bases.

Estas decisiones deben tomarse en su fase correspondiente y mediante ADR cuando
sean costosas de revertir.

## Riesgos que pasan a implementación

| Riesgo | Tratamiento acordado |
| --- | --- |
| Prisma no expresa toda la integridad | Migraciones SQL personalizadas y pruebas contra PostgreSQL |
| Deadlocks o stock/saldo consumido dos veces | Orden global, bloqueos, idempotencia y pruebas concurrentes |
| Divergencia entre posición y libro | Consultas de reconciliación sin corrección automática |
| Complejidad de causalidad explícita | FKs nombradas y constraints de exactamente un origen |
| Ganancias calculadas incorrectamente | Costo congelado, caja separada del ingreso comercial y pruebas de ejemplos |
| Fuga de Prisma al núcleo | Mapeadores, puertos y reglas de importación |
| Crecimiento del agregado Venta | Medir conflictos y separar solo con evidencia |

## Criterio de salida

La Fase 4 está cerrada porque cada dato confirmado tiene:

- autoridad y relación identificadas;
- tipo y nulabilidad conceptual;
- reglas de integridad y conservación;
- estrategia de concurrencia y transacción;
- ruta de lectura e índices candidatos;
- representación física prevista o migración SQL señalada;
- trazabilidad hacia dominio, requerimientos y ADR.

## Siguiente fase recomendada

Antes de programar funcionalidades se debe cerrar la base técnica del monorepo:

1. seleccionar versiones y herramientas del stack;
2. definir estructura física y reglas de dependencias;
3. diseñar contratos iniciales del backend;
4. definir estrategia de pruebas, entorno PostgreSQL y migraciones;
5. crear el esqueleto frontend/backend y verificar las fronteras;
6. implementar una primera capacidad vertical pequeña de extremo a extremo.

La primera capacidad debe demostrar dominio puro, puerto conductor, repositorio,
adaptador Prisma, migración, controlador y pruebas sin intentar implementar todos
los módulos a la vez.
