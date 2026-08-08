# ADR-0001: Adoptar arquitectura hexagonal en el backend

**Date**: 2026-08-07
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

Nova contiene reglas no triviales de inventario, reservas, entregas, pagos, devoluciones y costos. El backend utilizará NestJS y Prisma, pero el modelo del negocio debe poder evolucionar y probarse sin depender de esos frameworks. El proyecto también tiene un objetivo formativo explícito en arquitectura de software.

## Decision

El backend se organiza mediante arquitectura hexagonal pragmática por capacidades del dominio. El núcleo de dominio y aplicación permanece libre de NestJS, Prisma, PostgreSQL, HTTP y proveedores externos; estos se conectan mediante adaptadores y composición.

## Alternatives Considered

### Arquitectura convencional de NestJS por controller/service

- **Pros**: menor estructura inicial y curva de aprendizaje reducida.
- **Cons**: facilita mezclar negocio, framework y persistencia en servicios.
- **Why not**: las reglas centrales requieren aislamiento y pruebas independientes de infraestructura.

### Clean Architecture con capas globales

- **Pros**: dirección de dependencias explícita y abundante material educativo.
- **Cons**: puede organizar el sistema por capas técnicas y generar ceremonias globales.
- **Why not**: se prefieren fronteras por capacidad y puertos solo donde exista una interacción externa real.

## Consequences

### Positive

- Las reglas se prueban sin levantar NestJS o PostgreSQL.
- Prisma y proveedores externos pueden cambiar sin modificar el dominio.
- Los límites y responsabilidades son explicables y verificables.

### Negative

- Aumenta la cantidad de conceptos y traducciones.
- Requiere disciplina para evitar puertos e interfaces ceremoniales.

### Risks

- **Sobreingeniería**: aplicar profundidad proporcional; un módulo simple puede conservar un modelo delgado.
- **Fugas de Prisma o NestJS**: añadir pruebas y reglas de importación cuando exista la estructura física.
- **Repositorios por tabla**: diseñarlos únicamente alrededor de agregados o capacidades justificadas.

