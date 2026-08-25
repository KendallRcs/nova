# ADR-0007: Usar enums PostgreSQL para vocabularios cerrados

**Date**: 2026-08-24
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

Nova posee estados, métodos y políticas cuyo conjunto modifica reglas de negocio y
no debe ser administrado libremente por usuarios. También posee conceptos como
categorías, permisos y proveedores que sí necesitan identidad, relaciones o
configuración. El mapeo Prisma debe distinguir ambos casos sin convertir cada
valor en una tabla ni permitir texto arbitrario.

## Decision

Nova representa mediante enums Prisma respaldados por enums PostgreSQL los
vocabularios técnicos cerrados, como estados, métodos de pago, dirección de caja y
versión de política de costeo. Los conceptos configurables o con ciclo de vida
propio permanecen como tablas relacionadas.

## Alternatives Considered

### Texto con restricciones `CHECK`

- **Pros**: añadir valores puede requerir solamente modificar una constraint y el
  tipo SQL continúa siendo texto.
- **Cons**: duplica el vocabulario entre Prisma y SQL, ofrece tipos generados menos
  expresivos y facilita divergencias durante migraciones personalizadas.
- **Why not**: los valores cerrados participan en lógica y se benefician de un
  contrato visible tanto en Prisma como en PostgreSQL.

### Tablas catálogo para todos los vocabularios

- **Pros**: permite añadir valores sin alterar tipos y asociar metadatos.
- **Cons**: agrega joins, seeds, claves foráneas y estados administrables a
  conceptos que forman parte del código.
- **Why not**: un administrador no debe crear un nuevo método financiero o estado
  de venta sin que la aplicación implemente antes su comportamiento.

## Consequences

### Positive

- Prisma genera tipos explícitos para valores cerrados.
- PostgreSQL rechaza valores desconocidos incluso fuera de Prisma.
- Los datos administrables siguen modelados con identidad y relaciones propias.
- Añadir un estado que cambia comportamiento exige una migración revisable.

### Negative

- Evolucionar un enum requiere coordinar schema, migración y despliegue.
- Renombrar o eliminar valores exige una migración de datos cuidadosa.
- Los enums no deben reutilizarse artificialmente entre ciclos de vida distintos.

### Risks

- **Enum convertido en configuración por crecimiento del negocio**: migrarlo a
  tabla mediante un ADR y una migración de datos cuando aparezca esa necesidad.
- **Despliegue incompatible al añadir valores**: aplicar cambios aditivos antes de
  publicar código que los escriba y probar la actualización desde la versión previa.
- **Enum genérico demasiado amplio**: mantener vocabularios específicos por
  significado, aunque algunos compartan inicialmente los mismos valores.
