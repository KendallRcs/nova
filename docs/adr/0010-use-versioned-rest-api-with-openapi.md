# ADR-0010: Exponer una API REST versionada y documentada con OpenAPI

**Date**: 2026-08-24
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

El frontend y el backend de Nova son desplegables independientes y necesitan un
contrato explícito que permita evolucionarlos de forma compatible. Los flujos son
operaciones administrativas y transaccionales acotadas, con un solo frontend
conocido y reglas de negocio que no deben filtrarse hacia el transporte.

## Decision

Nova expone una API REST sobre HTTPS y JSON bajo `/api/v1`, usa versionado mayor
por URI y genera una descripción OpenAPI desde DTO propios del adaptador HTTP. Los
errores siguen RFC 9457 Problem Details y el núcleo hexagonal permanece ajeno a
HTTP, NestJS y OpenAPI.

## Alternatives Considered

### GraphQL

- **Pros**: selección flexible de campos, esquema tipado y composición de lecturas.
- **Cons**: agrega resolvers, autorización por grafo, manejo propio de caché y una
  semántica menos directa para estados HTTP e idempotencia.
- **Why not**: Nova tiene un consumidor conocido y no presenta todavía consultas
  variables que compensen esa complejidad.

### REST sin versionado ni contrato OpenAPI verificable

- **Pros**: configuración inicial mínima.
- **Cons**: cambios incompatibles difíciles de detectar y coordinación implícita
  entre despliegues de web y API.
- **Why not**: contradice el objetivo de despliegue independiente y reduce la
  trazabilidad de contratos para desarrolladores y agentes.

### Versionado mediante headers o media types

- **Pros**: conserva URLs de recursos sin versión y permite negociación avanzada.
- **Cons**: resulta menos visible en documentación, logs, pruebas manuales y soporte.
- **Why not**: el versionado por URI es suficiente, explícito y está soportado
  directamente por NestJS.

## Consequences

### Positive

- Web y API pueden coordinar cambios aditivos y despliegues independientes.
- OpenAPI permite documentación, pruebas de contrato y clientes tipados futuros.
- Problem Details evita formatos de error inventados por cada módulo.
- Los DTO HTTP permanecen fuera del dominio y de los puertos requeridos.

### Negative

- Los DTO y metadatos OpenAPI requieren mantenimiento deliberado.
- Una ruptura real puede exigir mantener temporalmente más de una versión.
- REST no elimina la necesidad de diseñar capacidades transaccionales explícitas.

### Risks

- **OpenAPI divergente del comportamiento**: generar la especificación desde el
  adaptador y verificarla mediante pruebas de contrato en CI.
- **Exposición de entidades internas**: prohibir modelos Prisma o de dominio en
  firmas de controladores y revisar esquemas públicos.
- **Proliferación prematura de versiones**: favorecer cambios aditivos y crear una
  versión nueva únicamente ante incompatibilidades inevitables.
