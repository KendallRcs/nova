# UI/UX

**Estado:** Fase 6 en definición; fundamentos confirmados el 2026-10-20.

## Fuentes de verdad

- [Fundamentos de experiencia](experience-foundations.md)
- [Arquitectura de información](information-architecture.md)
- [Flujos principales](core-flows.md)
- [Wireframes responsive](wireframes.md)
- [Paleta visual aprobada](assets/nova-color-palette.svg)
- [Contexto durable de la aplicación web](../../apps/web/PRODUCT.md)

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
2. Definir estados, patrones responsive y wireframes de baja fidelidad.
3. Resolver la arquitectura frontend y sus ADR sin inventar decisiones UI.
4. Implementar el shell, autenticación y primera vertical visible.
5. Consolidar el sistema visual desde la interfaz construida.

`DESIGN.md` no se escribirá como una aspiración previa: se generará desde el
sistema visual probado en pantallas reales. La configuración técnica de Next.js,
formularios, datos y componentes continúa perteneciendo a la siguiente fase de
arquitectura frontend.

