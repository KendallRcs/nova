# ADR-0015: Usar Cloudinary para imágenes optimizadas de productos

**Date**: 2026-10-19
**Status**: accepted
**Deciders**: propietario de Nova y equipo técnico

## Context

Nova necesita asociar hasta dos imágenes a cada producto sin cargar el VPS con
almacenamiento y procesamiento de archivos. Las fotografías pueden llegar con un
peso o resolución mayor al necesario, y el núcleo hexagonal no debe depender de
Cloudinary ni de detalles HTTP. También se debe evitar que un fallo entre el
almacenamiento externo y PostgreSQL deje referencias rotas.

## Decision

Se usa Cloudinary detrás de un puerto neutral de almacenamiento. La API valida
JPEG, PNG o WebP de hasta 5 MiB y aplica una transformación de entrada que limita
la imagen a 1600 × 1600 píxeles, sin ampliarla, y usa calidad automática `good`
antes de guardarla; la entrega usa formato y calidad automáticos según el cliente.
PostgreSQL conserva la posición, la clave externa y metadatos técnicos, pero no el
archivo ni credenciales del proveedor.

La sustitución carga primero el nuevo recurso, confirma después la asociación en
PostgreSQL y finalmente intenta eliminar el anterior. Si la persistencia falla,
se compensa eliminando el recurso recién cargado. Los fallos de limpieza externa
se registran, pero no revierten una asociación ya confirmada.

## Alternatives Considered

### Alternative 1: Guardar archivos en el VPS

- **Pros**: no depende de un proveedor externo y tiene un costo directo menor.
- **Cons**: exige almacenamiento persistente, copias de seguridad, CDN y
  procesamiento propio.
- **Why not**: aumenta la carga operativa y acopla los archivos al despliegue de la
  API.

### Alternative 2: Conservar el original y optimizar solo al entregar

- **Pros**: permite regenerar derivados futuros con toda la información original.
- **Cons**: conserva innecesariamente archivos pesados para un catálogo interno.
- **Why not**: Nova prioriza un almacenamiento ligero y no necesita originales de
  calidad fotográfica.

### Alternative 3: Carga directa desde el navegador

- **Pros**: evita transferir el archivo por la API de Nova.
- **Cons**: añade firmas o presets, coordinación cliente-proveedor y una
  reconciliación más compleja con PostgreSQL.
- **Why not**: el volumen esperado es pequeño y la carga mediada por la API hace
  más simple la validación y la consistencia del MVP.

## Consequences

### Positive

- El núcleo depende de capacidades neutrales y el proveedor se puede sustituir.
- Las imágenes almacenadas y entregadas son más ligeras que los archivos de
  entrada habituales.
- La base de datos nunca guarda binarios ni secretos de Cloudinary.

### Negative

- El archivo original atraviesa la API y Cloudinary antes de ser optimizado.
- La transformación de entrada es destructiva: Nova no conserva el original de
  máxima resolución.
- Desarrollo y producción necesitan credenciales de Cloudinary para usar estos
  endpoints.

### Risks

- Una interrupción puede dejar un recurso externo huérfano; la compensación y el
  registro de fallos permiten detectarlo y limpiarlo manualmente en el MVP.
- Una compresión excesiva puede degradar el catálogo; se mitiga con calidad
  automática `good` y un límite de 1600 píxeles.

