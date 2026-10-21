# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Nova sirve inicialmente a un negocio familiar pequeño con una tienda, un almacén y
aproximadamente seis usuarios internos.

- El empleado trabaja principalmente desde un teléfono Android mientras atiende el
  local o una venta originada en transmisiones. Necesita consultar stock y precios,
  crear ventas, cobrar sus propias ventas y entregar reservas con rapidez.
- El administrador también usa el móvil, pero puede trabajar desde laptop o PC para
  tareas de mayor densidad: catálogo, inventario, compras, gastos, usuarios,
  autorizaciones y reportes.

## Product Purpose

Nova convierte operaciones hoy sostenidas por cuadernos y memoria informal en una
fuente confiable y trazable. Debe permitir saber qué ocurrió con cada producto,
venta, reserva, entrega, pago, deuda, compra y gasto, quién lo registró y cuál es la
situación vigente.

El éxito significa reducir stock incorrecto, ventas omitidas y deudas olvidadas sin
volver más lenta la atención cotidiana.

## Positioning

Nova no es un CRUD contable genérico. Su unidad de verdad es la operación real del
pequeño comercio: separa venta, cobro, entrega, reserva, inventario, costo y caja,
pero permite seguirlos como una historia coherente aun cuando los acuerdos con
clientes sean informales y cambien con el tiempo.

Aunque nace para resolver problemas del negocio familiar, su lenguaje y estructura
deben poder servir a otros pequeños comercios con operación semejante.

## Operating Context

- Uso principal mobile-first en el mostrador, almacén o durante ventas por streaming.
- Uso secundario responsive en laptop o PC para administración y análisis.
- Una tienda y un almacén, unos 300 productos y conexión estable a internet.
- Productos identificados por códigos manuales.
- Cobros en efectivo, Yape, Plin y POS.
- Clientes frecuentes y ocasionales; algunas ventas se pagan por partes o dejan
  productos separados para entrega posterior.
- El backend REST versionado es la fuente del estado y aplica permisos, concurrencia
  e idempotencia; la interfaz no recrea reglas de negocio por su cuenta.

## Capabilities and Constraints

- Dos perfiles iniciales: Administrador y Empleado.
- Catálogo, inventario por ubicación, clientes, ventas, pagos, entregas,
  devoluciones, compras, anticipos, gastos, usuarios y dashboards.
- El empleado no ve costos o márgenes ni ejecuta acciones administrativas.
- La aplicación debe presentar dinero en PEN, contenido en español y fechas según
  `America/Lima`.
- La primera carga de productos mediante Excel ocurre una sola vez.
- El frontend usa Next.js y se despliega de forma independiente del backend.
- La experiencia offline, perfiles personalizados y PWA instalable no pertenecen al
  MVP actual.

## Brand Commitments

- El producto se llama **Nova**.
- La voz es directa, clara y operativa: nombra acciones por lo que la persona hace,
  evita jerga técnica y explica cómo resolver un error.
- Nova puede trascender a la juguetería original; su identidad no debe depender de
  una estética infantil ni de una marca comercial específica del negocio familiar.
- La interfaz utiliza una base clara y colores luminosos para resultar llamativa sin
  verse oscura, sobrecargada ni saturada de acentos.
- No existen todavía logo, colores corporativos ni otros activos de marca que deban
  conservarse.

## Evidence on Hand

- Visión, descubrimiento y alcance confirmados en `../../docs/product/`.
- 56 historias y 125 escenarios confirmados en `../../docs/requirements/`.
- Dominio, datos, arquitectura y contratos backend documentados en `../../docs/`.
- API funcional disponible en `../api` con OpenAPI en desarrollo.
- No existen testimonios, métricas públicas, fotografías o activos comerciales; la
  interfaz no debe fabricarlos.

## Product Principles

1. Rapidez operativa sin perder trazabilidad.
2. Estado real antes que supuestos automáticos.
3. Información sensible visible solo para quien corresponde.
4. Mobile-first sin degradar las tareas administrativas en escritorio.
5. Lenguaje del negocio antes que lenguaje técnico.

## Accessibility & Inclusion

La interfaz debe funcionar con teclado, foco visible, lectores de pantalla, tamaños
táctiles adecuados y contraste suficiente. No debe depender únicamente del color
para comunicar estado. Debe admitir reducción de movimiento y mantenerse utilizable
desde 320 píxeles de ancho hasta escritorio.
