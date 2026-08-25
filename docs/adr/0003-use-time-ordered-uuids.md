# ADR-0003: Usar UUID ordenables para identidades persistentes

**Date**: 2026-08-23
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

Nova necesita crear identidades antes de persistir agregados y coordinar varias entidades en una transacción. Los códigos manuales son datos comerciales que pueden corregirse y no deben convertirse en identidad técnica. También se busca evitar secuencias predecibles y conservar portabilidad de los datos.

## Decision

Nova utiliza UUID ordenables temporalmente, preferentemente UUIDv7, para las identidades persistentes. El dominio los encapsula en tipos opacos y obtiene nuevos valores mediante un generador, sin depender de una librería o base de datos concreta.

## Alternatives Considered

### `BIGINT` autoincremental

- **Pros**: compacto, rápido y soportado directamente por PostgreSQL.
- **Cons**: la identidad nace al persistir, expone secuencias y dificulta mover datos sin coordinación.
- **Why not**: Nova se beneficia de generar identidades desde la aplicación antes de guardar agregados coordinados.

### UUIDv4

- **Pros**: amplio soporte y generación descentralizada.
- **Cons**: distribución aleatoria con peor localidad de índice.
- **Why not**: un UUID ordenable conserva las ventajas sin inserciones completamente aleatorias.

### Código manual como clave primaria

- **Pros**: identificador conocido por el negocio.
- **Cons**: mezcla identidad con un dato editable y propaga cambios comerciales a todas las relaciones.
- **Why not**: el código permanece como clave de negocio única, separada de la identidad interna.

## Consequences

### Positive

- Los agregados pueden recibir identidad antes de persistirse.
- Las identidades no revelan conteos secuenciales.
- Importaciones y movimientos de datos no requieren renumeración.

### Negative

- Claves e índices ocupan más espacio que `BIGINT`.
- La generación concreta debe configurarse y probarse explícitamente.

### Risks

- **Soporte desigual de UUIDv7**: ocultar la generación detrás de un puerto y validar la implementación seleccionada.
- **Fuga del formato al dominio**: mantener tipos de identidad opacos y evitar lógica basada en el timestamp del UUID.
