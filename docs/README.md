# Documentación de Nova

Este es el punto de entrada para personas y agentes. La documentación se versiona con el código y cada decisión debe tener una única fuente de verdad.

## Ruta de lectura rápida

1. [Visión del producto](product/vision.md)
2. [Descubrimiento del negocio](product/discovery.md)
3. [Alcance](product/scope.md)
4. [Requerimientos funcionales](requirements/README.md)
5. [Modelo de dominio](domain/README.md)
6. [Arquitectura de datos](data/README.md)
7. [Arquitectura](architecture/README.md)
8. [Decisiones arquitectónicas](adr/README.md)

## Áreas

| Área | Propósito | Estado |
| --- | --- | --- |
| [Producto](product/README.md) | Problema, contexto y alcance | Fases 1 y 2 cerradas |
| [Requerimientos](requirements/README.md) | Historias y reglas de negocio | Fase 2 cerrada |
| [Dominio](domain/README.md) | Lenguaje, contextos, agregados y eventos | Fase 3 cerrada |
| [Arquitectura](architecture/README.md) | Arquitectura general, frontend y backend | Fase 5 en progreso |
| [ADR](adr/README.md) | Decisiones costosas de revertir | Activo |
| [Datos](data/README.md) | Modelo relacional, integridad y transacciones | Fase 4 cerrada |
| [UI/UX](ui-ux/README.md) | Design system, flujos y accesibilidad | Pendiente |
| [Calidad](quality/README.md) | Estrategia de pruebas y calidad | Base backend confirmada |
| [Operaciones](operations/README.md) | Docker, CI/CD, observabilidad y despliegue | Pendiente |

## Reglas documentales

- Las historias describen valor y comportamiento observable.
- Las reglas transversales no se duplican dentro de cada historia.
- Los ADR explican decisiones arquitectónicas, no requisitos funcionales.
- Los documentos de dominio no deben contener tablas Prisma ni detalles HTTP.
- Un cambio de comportamiento exige actualizar la historia y las reglas afectadas.
- Un cambio arquitectónico significativo exige evaluar un ADR nuevo o la sustitución de uno existente.
