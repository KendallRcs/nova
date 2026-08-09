# Modelo de dominio

**Estado:** Fase 3 en progreso.

Esta sección modelará el negocio sin depender de NestJS, Prisma, PostgreSQL ni contratos HTTP.

## Orden de trabajo

1. [Lenguaje ubicuo](ubiquitous-language.md) — versión inicial confirmada.
2. [Subdominios y clasificación estratégica](subdomains.md) — clasificación inicial confirmada.
3. Bounded contexts y mapa de relaciones — siguiente paso.
4. Entidades y objetos de valor.
5. Agregados e invariantes.
6. Estados y transiciones.
7. Eventos de dominio.
8. Diagramas conceptuales.

## Criterios

- El lenguaje debe ser comprensible para el negocio.
- Un bounded context es un límite de modelo, no un microservicio.
- Los agregados serán pequeños y protegerán invariantes reales.
- No todos los módulos requieren un modelo rico.
- Los eventos representarán hechos importantes para el negocio, no cada modificación técnica.
