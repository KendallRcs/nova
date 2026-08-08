# Arquitectura

## Decisiones vigentes

- [Backend con arquitectura hexagonal](backend/hexagonal-architecture.md)
- [ADR-0001: adoptar arquitectura hexagonal](../adr/0001-adopt-hexagonal-backend.md)
- [ADR-0002: organizar Nova como monorepo](../adr/0002-use-monorepo.md)

## Áreas

- `backend/`: límites, dependencias y convenciones del API NestJS.
- `frontend/`: arquitectura modular de Next.js; se definirá en su fase.
- `diagrams/`: diagramas C4 y de componentes cuando exista una arquitectura suficientemente estable.

El modelo de negocio vive en [Dominio](../domain/README.md). Las decisiones persistentes viven en [ADR](../adr/README.md).

