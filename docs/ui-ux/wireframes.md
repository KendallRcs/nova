# Wireframes responsive

**Estado:** primera iteración para validación funcional.

Estas láminas prueban jerarquía, navegación, densidad y continuidad entre móvil y
escritorio. No fijan todavía tipografía, iconografía, radios, sombras ni componentes
finales. Utilizan la paleta aprobada solo para hacer visible la jerarquía funcional.

## Láminas

- [Flujos móviles principales](wireframes/mobile-core.svg)
- [Superficies de escritorio](wireframes/desktop-core.svg)

## Decisiones representadas

### Acceso

- La pantalla pide únicamente usuario y contraseña.
- Una credencial temporal dirige a una pantalla específica para crear la contraseña
  personal antes de mostrar cualquier módulo.
- La recuperación es administrativa; no se inventa un enlace de correo o SMS.

### Inicio por perfil

- El empleado encuentra `Nueva venta` y búsqueda de producto antes que cualquier
  resumen.
- El administrador encuentra primero alertas que puede resolver y luego acciones
  frecuentes y resumen mensual.
- Ambos perfiles conservan la misma navegación principal.

### Productos

- La búsqueda acepta código o nombre desde un solo campo.
- El resultado móvil prioriza identidad, precios de venta y disponibilidad por
  ubicación.
- Los costos administrativos no ocupan el detalle operativo del empleado.

### Nueva venta

- En móvil se usa una secuencia corta: productos, cumplimiento, cliente/pago y
  revisión.
- Un resumen persistente mantiene visibles líneas, total, pago y saldo.
- `Guardar borrador` y `Confirmar venta` se distinguen porque solo la segunda acción
  produce inventario y caja.
- En escritorio la secuencia se presenta como una mesa de trabajo con líneas a la
  izquierda y resumen revisable a la derecha, sin convertirla en otro flujo.

### Seguimiento de deuda

- La cuenta del cliente organiza primero deuda vigente y ventas abiertas.
- El detalle muestra total, pagado y saldo antes del rastro operativo.
- `Registrar pago` es la acción cotidiana; las acciones administrativas permanecen
  separadas en un menú textual.

## Adaptación estructural

| Elemento | Móvil | Escritorio |
| --- | --- | --- |
| Navegación | barra inferior de cinco destinos | barra lateral con grupos expandidos |
| Encabezado | título, retorno y una acción contextual | título, ayuda y acción principal |
| Formularios | pasos de una columna | secciones simultáneas relacionadas |
| Resumen de venta | bloque adherido antes de confirmar | panel lateral persistente |
| Listado | filas apiladas | tabla con columnas explicables |
| Rastro operativo | secuencia vertical | secuencia vertical junto al resumen |

## Aspectos que deben validarse antes de alta fidelidad

1. Que cinco destinos inferiores sean suficientes para el uso cotidiano.
2. Que el Inicio del administrador no se sienta más importante que las operaciones.
3. Que el flujo móvil de venta permita atender con interrupciones sin perder contexto.
4. Que saldo, reserva y entrega se entiendan como estados distintos.
5. Que `Cómo funciona` sea visible sin competir con la acción principal.

## Siguiente iteración

Después de validar esta estructura se diseñarán estados de error, vacío, carga y
conflicto para las mismas superficies. La alta fidelidad se realizará durante la
primera vertical frontend para que el sistema visual nazca de componentes y datos
reales, no de una maqueta aislada.
