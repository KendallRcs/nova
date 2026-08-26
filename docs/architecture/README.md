# Arquitectura

**Estado:** Fase 5 — contratos técnicos en progreso.

## Decisiones vigentes

- [Backend con arquitectura hexagonal](backend/hexagonal-architecture.md)
- [ADR-0001: adoptar arquitectura hexagonal](../adr/0001-adopt-hexagonal-backend.md)
- [ADR-0002: organizar Nova como monorepo](../adr/0002-use-monorepo.md)
- [Base técnica del monorepo](technical-foundation.md)
- [ADR-0008: adoptar una base TypeScript estable](../adr/0008-adopt-stable-typescript-stack.md)
- [ADR-0009: usar pnpm workspaces sin orquestador inicialmente](../adr/0009-use-pnpm-workspaces-without-task-orchestrator.md)
- [Contratos HTTP del backend](backend/http-api-contracts.md)
- [ADR-0010: exponer una API REST versionada y documentada con OpenAPI](../adr/0010-use-versioned-rest-api-with-openapi.md)
- [Autenticación y seguridad de sesiones](backend/authentication-and-sessions.md)
- [ADR-0011: usar sesiones opacas persistidas en el servidor](../adr/0011-use-server-side-opaque-sessions.md)
- [Base de calidad del backend](../quality/backend-quality-foundation.md)
- [ADR-0012: verificar el backend por fronteras sin E2E de navegador inicialmente](../adr/0012-test-backend-boundaries-without-browser-e2e.md)

## En definición

- [Herramientas de código y plan de scaffolding](tooling-and-scaffolding.md) —
  propuesta para validación.

## Áreas

- `backend/`: límites, dependencias y convenciones del API NestJS.
- `frontend/`: arquitectura modular de Next.js; se definirá en su fase.
- `diagrams/`: diagramas C4 y de componentes cuando exista una arquitectura suficientemente estable.

El modelo de negocio vive en [Dominio](../domain/README.md). Las decisiones persistentes viven en [ADR](../adr/README.md).
