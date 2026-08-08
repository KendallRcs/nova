# Contexto para agentes

Antes de proponer o modificar el proyecto:

1. Lee [docs/README.md](docs/README.md).
2. Lee el índice del área afectada y sus fuentes de verdad.
3. No conviertas decisiones diferidas en decisiones implícitas.
4. Actualiza documentación, ADR e historias cuando cambie comportamiento o arquitectura.

## Decisiones vigentes

- Nova es un monorepo con frontend y backend desplegables por separado.
- El backend NestJS utiliza arquitectura hexagonal pragmática y módulos alineados al dominio.
- El núcleo del backend no depende de NestJS, Prisma, PostgreSQL, HTTP ni Cloudinary.
- Las historias y reglas funcionales viven en `docs/requirements/`.
- Las decisiones arquitectónicas viven en `docs/adr/`.

## Next.js

Esta versión puede contener cambios incompatibles con conocimiento previo. Antes de modificar código Next.js, lee la guía relevante en `node_modules/next/dist/docs/` y respeta sus avisos de deprecación.

