# ADR-0002: Organizar Nova como monorepo

**Date**: 2026-08-07
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

Nova tendrá frontend Next.js, backend NestJS, infraestructura y documentación que evolucionan como un solo producto. El equipo inicial es pequeño y necesita cambios coordinados, trazabilidad central y una experiencia local basada en Docker Compose.

## Decision

Nova utiliza un monorepo con aplicaciones frontend y backend desplegables por separado, documentación compartida e infraestructura en el mismo repositorio. Los paquetes compartidos se crearán solamente cuando exista propiedad y reutilización justificadas.

## Alternatives Considered

### Repositorios separados para frontend y backend

- **Pros**: ciclos y permisos completamente independientes.
- **Cons**: mayor coordinación para cambios de contrato y documentación fragmentada.
- **Why not**: la escala y el equipo actuales se benefician de cambios atómicos y una fuente única de contexto.

### Una aplicación Next.js con backend integrado

- **Pros**: despliegue y estructura inicial más simples.
- **Cons**: contradice el objetivo de aprender y operar un backend NestJS independiente.
- **Why not**: Nova necesita una API NestJS separada y desplegable en el VPS.

## Consequences

### Positive

- Cambios de frontend, API, infraestructura y documentación pueden revisarse juntos.
- Configuración, automatización y contratos pueden mantenerse coherentes.
- Los agentes encuentran una única fuente de contexto.

### Negative

- La configuración del workspace y CI será más compleja que en un proyecto único.
- Existe riesgo de crear paquetes compartidos que acoplen indebidamente las aplicaciones.

### Risks

- **Compartir el modelo del backend con el frontend**: compartir solo contratos justificados o generar tipos desde OpenAPI.
- **Pipelines innecesariamente globales**: detectar aplicaciones afectadas y mantener despliegues independientes.

