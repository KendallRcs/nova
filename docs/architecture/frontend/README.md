# Arquitectura frontend

**Estado:** confirmada para el MVP el 2026-10-21.

## Fuentes de verdad

- [Arquitectura de la aplicación web](application-architecture.md)
- [ADR-0017: frontend modular por capacidades](../../adr/0017-adopt-modular-feature-first-frontend.md)
- [Contratos HTTP del backend](../backend/http-api-contracts.md)
- [Estados y recuperación de interfaz](../../ui-ux/interface-states.md)
- [Contexto durable de la aplicación](../../../apps/web/PRODUCT.md)

## Principios

1. `app/` ensambla rutas; las capacidades viven fuera del árbol de rutas.
2. OpenAPI, no el código del backend, define la frontera TypeScript.
3. El backend conserva la autoridad sobre permisos e invariantes.
4. Cada clase de estado tiene un propietario y no se copia sin necesidad.
5. Se usan Server Components por defecto y se introduce una frontera cliente solo
   donde la interacción operativa la necesita.
6. Un componente compartido aparece después de reutilización real, no por
   anticipación.

## Próximo incremento

1. Preparar dependencias frontend confirmadas y generación del contrato. **Completado.**
2. Crear tokens, primitivas y shell responsive. **Completado.**
3. Implementar acceso, sesión actual y cambio de contraseña temporal. **Completado.**
4. Implementar la primera vertical operativa de consulta de inventario. **Completado.**
5. Añadir pruebas unitarias y de integración de componentes sin Playwright. **Completado.**
6. Implementar consulta y seguimiento responsive de ventas. **Completado.**
7. Implementar creación multilínea y confirmación de ventas. **Completado.**
8. Incorporar cobros y entregas posteriores desde el detalle de venta. **Completado.**
9. Incorporar devoluciones, correcciones y cierre administrativo de ventas. **Completado.**
10. Incorporar ajustes del total y cancelación administrativa de ventas. **Completado.**
11. Implementar consulta, registro, edición y cuenta consolidada de clientes. **Completado.**
12. Incorporar la fusión administrativa de clientes duplicados. **Completado.**
13. Implementar proveedores, anticipos y sus resoluciones. **Completado.**
14. Implementar registro y detalle de compras con aplicación de anticipos. **Siguiente.**
