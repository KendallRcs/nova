# Modelo de dominio

**Estado:** Fase 3 cerrada el 2026-08-16.

Esta sección modelará el negocio sin depender de NestJS, Prisma, PostgreSQL ni contratos HTTP.

## Orden de trabajo

1. [Lenguaje ubicuo](ubiquitous-language.md) — versión inicial confirmada.
2. [Subdominios y clasificación estratégica](subdomains.md) — clasificación inicial confirmada.
3. [Bounded contexts](bounded-contexts.md) y [mapa de relaciones](context-map.md) — versión inicial confirmada.
4. [Entidades y objetos de valor](entities-and-value-objects.md) — versión inicial confirmada.
5. [Agregados e invariantes](aggregates-and-invariants.md) — versión inicial confirmada.
6. [Estados y transiciones](states-and-transitions.md) — versión inicial confirmada.
7. [Eventos de dominio](domain-events.md) — versión inicial confirmada.
8. [Modelos tácticos por contexto](context-models/README.md) — versiones iniciales confirmadas.
9. [Modelo conceptual](conceptual-model.md) — fronteras y coordinaciones confirmadas.
10. [Cierre de la Fase 3](phase-3-closure.md) — decisiones transferidas a Datos.

## Criterios

- El lenguaje debe ser comprensible para el negocio.
- Un bounded context es un límite de modelo, no un microservicio.
- Los agregados serán pequeños y protegerán invariantes reales.
- No todos los módulos requieren un modelo rico.
- Los eventos representarán hechos importantes para el negocio, no cada modificación técnica.

Consulta también el [diagnóstico DDD](diagnostic.md), que registra qué partes del modelo ya existen y cuáles faltan.
