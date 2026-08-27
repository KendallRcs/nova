# Arquitectura de datos

**Estado:** Fase 4 cerrada el 2026-08-24.

Prisma reflejará el modelo persistente; no definirá el modelo de dominio.

**Implementación:** las migraciones iniciales de categorías e Identidad y Acceso
fueron aplicadas y verificadas contra PostgreSQL 18.6 el 2026-08-26. El resto del
mapeo confirmado se incorporará mediante migraciones revisadas por capacidades,
sin usar `db push`.

## Orden de trabajo

1. [Fundamentos de datos](foundations.md) — versión inicial confirmada.
2. [Modelo relacional y cardinalidades](relational-model.md) — versión inicial confirmada.
3. [Restricciones e integridad referencial](integrity-constraints.md) — versión inicial confirmada.
4. [Concurrencia y límites transaccionales](transactions-and-concurrency.md) — versión inicial confirmada.
5. [Índices y modelos de lectura](indexes-and-read-models.md) — versión inicial confirmada.
6. [Diagrama entidad-relación](entity-relationship-diagram.md) — versión inicial confirmada.
7. [Mapeo hacia Prisma y PostgreSQL](prisma-postgresql-mapping.md) — versión inicial confirmada.

## Cierre

La fase se encuentra cerrada. Consulta [Cierre de la Fase 4](phase-4-closure.md)
para revisar resultados, obligaciones de implementación, riesgos y transición.
