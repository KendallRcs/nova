# ADR-0009: Usar pnpm workspaces sin orquestador de tareas inicialmente

**Date**: 2026-08-24
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

El monorepo inicial contiene únicamente una aplicación web y una API, sin
paquetes compartidos ni un grafo complejo de construcción. Nova necesita ejecutar
tareas de ambas aplicaciones de forma coherente, pero todavía no existe evidencia
de que una capa de caché y orquestación compense su configuración y aprendizaje.

## Decision

Nova usa pnpm 11 y sus workspaces como gestor del monorepo. Los scripts raíz y los
filtros de pnpm coordinan desarrollo, pruebas y builds; no se incorpora Turborepo
ni otro orquestador hasta que aparezcan señales medibles que lo justifiquen.

## Alternatives Considered

### Incorporar Turborepo desde el primer día

- **Pros**: grafo de tareas, ejecución incremental y caché local o remota.
- **Cons**: agrega configuración, conceptos y otra superficie de diagnóstico.
- **Why not**: dos aplicaciones sin paquetes compartidos no producen todavía un
  beneficio material de caché u orquestación.

### Usar npm workspaces

- **Pros**: viene incluido con Node.js y reduce una herramienta externa.
- **Cons**: los filtros y la gestión de workspaces son menos expresivos para el
  flujo elegido, y la instalación utiliza más espacio en el caso general.
- **Why not**: pnpm cubre el caso actual con comandos claros y una política
  explícita para dependencias locales.

## Consequences

### Positive

- La configuración inicial del monorepo permanece pequeña y fácil de explicar.
- Un solo lockfile conserva versiones coherentes para web y API.
- Los filtros permiten operar cada desplegable por separado.
- Es posible añadir un orquestador después sin cambiar las fronteras del producto.

### Negative

- Los scripts raíz deben expresar manualmente las tareas comunes.
- No habrá caché remota ni conocimiento automático del grafo de tareas.
- Los builds repetidos pueden volverse lentos cuando crezca el repositorio.

### Risks

- **Scripts difíciles de mantener**: evaluar un orquestador cuando aparezcan
  varios paquetes compartidos o dependencias entre tareas.
- **CI innecesariamente lento**: medir tiempos y adoptar caché/orquestación si la
  repetición se vuelve significativa.
- **Versiones de pnpm distintas entre entornos**: fijar `packageManager` y activar
  la versión indicada mediante Corepack o un mecanismo equivalente documentado.
