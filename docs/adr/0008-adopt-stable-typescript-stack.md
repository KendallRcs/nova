# ADR-0008: Adoptar una base TypeScript estable para el monorepo

**Date**: 2026-08-24
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

Nova necesita una base reproducible para dos aplicaciones desplegables por
separado, con compatibilidad comprobada entre runtime, frameworks, ORM y base de
datos. Al ser un proyecto nuevo conviene disponer de una vida útil amplia, pero
las versiones preliminares aumentarían el riesgo sin resolver una necesidad del
negocio.

## Decision

Nova usa Node.js 24 LTS, TypeScript 5 en modo estricto, Next.js 16.3 con React 19,
NestJS 11 con Express 5, Prisma ORM 7 y PostgreSQL 18. Las versiones exactas se
fijan al crear el lockfile y no se usan versiones canary, beta, RC o Early Access
en el camino crítico.

## Alternatives Considered

### Adoptar inmediatamente las versiones más nuevas, aunque sean preliminares

- **Pros**: acceso temprano a capacidades de Node 26, Prisma 8 y otras ramas en
  desarrollo.
- **Cons**: APIs cambiantes, migraciones adicionales y menor soporte de
  producción entre herramientas.
- **Why not**: Nova necesita estabilidad operativa y ninguna funcionalidad
  definida depende de esas novedades.

### Partir de versiones estables anteriores

- **Pros**: más tiempo de uso acumulado y abundante material histórico.
- **Cons**: menor horizonte de soporte y actualizaciones mayores más tempranas en
  un proyecto que aún no tiene restricciones heredadas.
- **Why not**: las versiones seleccionadas ya son estables y compatibles, por lo
  que retroceder no aporta una reducción de riesgo proporcional.

## Consequences

### Positive

- Todo el monorepo comparte un runtime LTS y TypeScript estricto.
- El stack tiene compatibilidad oficial y un horizonte amplio de soporte.
- Prisma queda aislado en el adaptador de salida y Express en el borde HTTP.
- El entorno puede reproducirse fijando Node, dependencias e imagen PostgreSQL.

### Negative

- Será necesario revisar guías de migración antes de actualizar versiones mayores.
- Next.js, NestJS y Prisma evolucionan con calendarios distintos.
- Express es una decisión concreta del host aunque el núcleo sea independiente.

### Risks

- **Deriva entre documentación y lockfile**: verificar las versiones durante el
  scaffolding y actualizar esta base si cambia alguna rama mayor.
- **Fin de soporte futuro**: mantener actualizaciones menores y evaluar nuevas
  ramas LTS mediante un ADR cuando sea necesario.
- **Dependencia accidental del núcleo**: aplicar pruebas de arquitectura que
  prohíban imports de framework, ORM y base de datos desde `hexagon/`.
