# Diagnóstico DDD

**Fecha:** 2026-08-16
**Puntuación actual:** 8/10

## Criterios satisfechos

- El lenguaje inicial utiliza términos que el negocio puede reconocer.
- El dominio central está identificado: control de ventas y deudas.
- Los bounded contexts y sus relaciones iniciales están explícitamente definidos y confirmados.
- El agregado `Venta` mantiene una frontera acotada para el volumen esperado y referencia otros agregados por identidad.
- El modelo define comportamientos e invariantes dentro de la raíz en lugar de concentrarlos en servicios técnicos.
- Operaciones Comerciales posee un modelo rico para pagos, saldos, cumplimiento, devoluciones y cierres.
- Los eventos relevantes del dominio central están definidos sin adoptar event sourcing ni confundirlos con comandos.

## Criterios pendientes

- Precisar adaptadores o capas anticorrupción para proveedores externos.
- Mantener el lenguaje consistente cuando existan código y pruebas.

La puntuación es una línea base de diseño, no una métrica de avance del producto ni un objetivo para introducir patrones innecesarios.
