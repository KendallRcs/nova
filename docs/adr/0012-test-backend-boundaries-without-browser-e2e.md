# ADR-0012: Verificar el backend por fronteras sin E2E de navegador inicialmente

**Date**: 2026-08-26
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

Nova necesita proteger reglas financieras, inventario, persistencia y contratos
HTTP desde la primera vertical. Al mismo tiempo, los flujos de interfaz todavía
cambiarán con rapidez y una suite de navegador agregaría instalación, ejecución y
mantenimiento antes de que exista evidencia de que ese costo acelera el proyecto.

## Decision

Nova usa Vitest 4.x para dominio y aplicación, Testcontainers con PostgreSQL 18
para adaptadores Prisma, NestJS con Supertest para contratos HTTP y
dependency-cruiser para fronteras de imports. La etapa inicial no incorpora
Playwright ni otra suite E2E de navegador; los primeros flujos visibles se revisan
con checklists manuales acotados.

## Alternatives Considered

### Usar Jest como runner del backend

- **Pros**: es la opción histórica y predeterminada en muchos proyectos NestJS.
- **Cons**: requiere más adaptación para el stack ESM/TypeScript moderno elegido.
- **Why not**: Vitest cubre las pruebas necesarias con menor configuración y el
  núcleo no queda acoplado al runner.

### Probar persistencia solo con fakes

- **Pros**: pruebas muy rápidas y sin Docker.
- **Cons**: no verifica Prisma, migraciones, constraints, enums, bloqueos ni
  concurrencia PostgreSQL.
- **Why not**: esas propiedades protegen los riesgos principales de dinero y stock.

### Incorporar Playwright desde la primera interfaz

- **Pros**: verifica el recorrido completo desde el navegador y detecta errores de
  integración web/API.
- **Cons**: añade configuración, datos, esperas y mantenimiento sobre flujos aún
  inestables.
- **Why not**: se prioriza agilizar el desarrollo inicial; puede reevaluarse ante
  regresiones repetidas o un costo manual medible.

## Consequences

### Positive

- Las pruebas rápidas se concentran en capacidades e invariantes del negocio.
- Prisma y la concurrencia se verifican contra la tecnología real de producción.
- El contrato HTTP y la dirección de dependencias fallan automáticamente en CI.
- El scaffolding evita una dependencia y un job de navegador que aún no aportan
  valor comprobado.

### Negative

- Ninguna prueba automática confirma inicialmente el recorrido completo web/API.
- Los checklists manuales requieren disciplina y no son una barrera automática de
  regresión.
- Algunos defectos de integración visual o del navegador pueden detectarse más
  tarde.

### Risks

- **Regresiones entre frontend y API**: sostener OpenAPI y pruebas de contrato, y
  reevaluar E2E si los defectos cruzados se repiten.
- **Checklist manual omitido**: incorporarlo al criterio de terminado de cada
  flujo visible sin convertirlo en un documento extenso.
- **Falsa confianza por pruebas unitarias**: mantener integración PostgreSQL y
  transporte HTTP como suites obligatorias.
- **Fronteras hexagonales erosionadas**: ejecutar dependency-cruiser con severidad
  bloqueante en desarrollo y CI.
