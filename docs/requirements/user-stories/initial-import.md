# Importación inicial

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story DATA-001 — Importar productos e inventario inicial desde una plantilla

- **Estado:** Confirmada
- **Como** administrador
- **quiero** importar productos, costos y cantidades desde una plantilla de Excel
- **para** dejar preparado el catálogo y el inventario inicial sin registrar aproximadamente 300 productos uno por uno.

#### Criterios de aceptación

- **Escenario:** Archivo preparado con la plantilla oficial
- **Dado:** que completé una plantilla con códigos, nombres, categorías, precios, costo y cantidades por ubicación
- **Cuando:** cargo el archivo para validarlo
- **Entonces:** veo una previsualización que diferencia filas válidas, advertencias y errores antes de modificar el catálogo o el inventario.

- **Escenario:** Confirmación de una importación validada
- **Dado:** que revisé el resumen de la importación
- **Y dado:** que las filas de productos, costos y cantidades cumplen las reglas definidas
- **Cuando:** confirmo la importación
- **Entonces:** el sistema registra los productos y movimientos de inventario inicial por ubicación, sin crear compras, egresos ni ventas históricas, y entrega un resumen del resultado.

- **Escenario:** El archivo contiene una o más filas inválidas
- **Dado:** que la validación encontró al menos un error en la plantilla
- **Cuando:** intento confirmar la importación
- **Entonces:** el sistema no registra ninguna fila y presenta los errores que deben corregirse.

- **Escenario:** Ya se completó la carga inicial
- **Dado:** que una importación inicial fue confirmada exitosamente
- **Cuando:** intento ejecutar otra carga inicial
- **Entonces:** el sistema impide repetirla mediante el flujo normal.

---

