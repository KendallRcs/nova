# UI/UX

**Estado:** fundamentos confirmados e implementación frontend iniciada el 2026-10-21.

## Fuentes de verdad

- [Fundamentos de experiencia](experience-foundations.md)
- [Arquitectura de información](information-architecture.md)
- [Flujos principales](core-flows.md)
- [Wireframes responsive](wireframes.md)
- [Estados y recuperación de la interfaz](interface-states.md)
- [Paleta visual aprobada](assets/nova-color-palette.svg)
- [Contexto durable de la aplicación web](../../apps/web/PRODUCT.md)
- [Sistema visual implementado](../../apps/web/DESIGN.md)

## Decisiones confirmadas

- La experiencia es `mobile-first` y continúa siendo completa en laptop o PC.
- La portada y los accesos se adaptan a Administrador y Empleado.
- La navegación utiliza nombres completos y consistentes con el negocio.
- Cada módulo ofrece ayuda contextual y una sección visible `Cómo funciona`.
- La dirección visual `Mostrador luminoso` utiliza una base clara y acentos
  funcionales sin saturar la interfaz.
- Nova prioriza rapidez operativa, trazabilidad y divulgación progresiva.

## Orden de trabajo

1. Confirmar arquitectura de información y flujos críticos.
2. Definir estados, patrones responsive y wireframes de baja fidelidad. **Completado.**
3. Resolver la arquitectura frontend y sus ADR sin inventar decisiones UI. **Completado.**
4. Implementar el shell y autenticación. **Completado.**
5. Implementar la primera vertical operativa: consulta de inventario. **Siguiente.**
6. Consolidar el sistema visual desde la interfaz construida. **Base extraída.**

`DESIGN.md` no se escribirá como una aspiración previa: se generará desde el
sistema visual probado en pantallas reales. La configuración técnica de Next.js,
formularios, datos y componentes continúa perteneciendo a la siguiente fase de
arquitectura frontend.

