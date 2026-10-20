# Importación inicial

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story DATA-001 — Importar productos e inventario inicial desde una plantilla

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo para cargar `.xlsx`,
  previsualizar errores y advertencias, y confirmar una sola importación de forma
  atómica e idempotente. Crea o reutiliza categorías y etiquetas activas, productos,
  posiciones y movimientos de apertura sin inventar compras ni movimientos de caja.
  La plantilla oficial puede descargarse desde la API y se genera usando las mismas
  columnas que valida el dominio.
- **Como** administrador
- **quiero** importar productos, costos y cantidades desde una plantilla de Excel
- **para** dejar preparado el catálogo y el inventario inicial sin registrar aproximadamente 300 productos uno por uno.

#### Criterios de aceptación

- **Escenario:** Descargar la plantilla oficial
- **Dado:** que soy un administrador autorizado para realizar la carga inicial
- **Cuando:** solicito la plantilla de productos
- **Entonces:** recibo un archivo `.xlsx` con las columnas oficiales en el orden esperado y listo para completar.

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

#### Plantilla oficial

Se utiliza la primera hoja del archivo `.xlsx`, con estas columnas en este orden:

1. `codigo`
2. `nombre`
3. `descripcion`
4. `categoria`
5. `etiquetas`
6. `precio_minimo_centimos`
7. `precio_sugerido_centimos`
8. `precio_maximo_centimos`
9. `costo_unitario_centimos`
10. `stock_tienda`
11. `stock_almacen`

Los importes se expresan en céntimos enteros y las etiquetas se separan con comas.
Código, nombre, categoría, precio mínimo y costo unitario son obligatorios; el costo
debe ser positivo. Los stocks son enteros no negativos y pueden ser ambos cero. El
precio sugerido y el máximo son opcionales, respetando el orden entre todos los
precios presentes. La ausencia de precio sugerido y el stock inicial total cero
generan advertencias, no errores.

El archivo admite como máximo 5 MiB y 1000 filas. Un código existente o repetido,
una clasificación inactiva o cualquier dato inválido bloquea la confirmación
completa. Las categorías y etiquetas activas se reutilizan y las inexistentes se
crean al confirmar. La previsualización normalizada queda guardada en el servidor:
la confirmación no acepta filas modificadas por el cliente.

---

