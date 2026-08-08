# Productos y precios

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story PROD-001 — Consultar un producto y sus precios autorizados

- **Estado:** Confirmada
- **Como** empleado
- **quiero** buscar un producto por código o nombre
- **para** informar su disponibilidad y utilizar un precio de venta autorizado.

#### Criterios de aceptación

- **Escenario:** Consulta de producto existente
- **Dado:** que existe un producto activo con código manual único
- **Cuando:** lo busco por código o nombre
- **Entonces:** veo sus precios mínimo, sugerido y máximo opcional, junto con el stock de tienda y almacén, sin ver costos ni márgenes.

### User Story PROD-002 — Administrar el catálogo de productos

- **Estado:** Confirmada
- **Como** administrador
- **quiero** crear y actualizar productos
- **para** mantener vigente el catálogo utilizado por ventas e inventario.

#### Criterios de aceptación

- **Escenario:** Creación con código disponible
- **Dado:** que el código manual no pertenece a otro producto
- **Y dado:** que indiqué nombre, categoría y precio mínimo
- **Cuando:** registro el producto con descripción, precio sugerido, precio máximo y etiquetas opcionales
- **Entonces:** el producto queda disponible para recibir inventario y participar en ventas.

- **Escenario:** Código duplicado
- **Dado:** que otro producto ya utiliza el código indicado
- **Cuando:** intento guardar el producto
- **Entonces:** el sistema rechaza la operación e identifica el conflicto de código.

- **Escenario:** Rango de precios inconsistente
- **Dado:** que informé uno o más precios opcionales
- **Y dado:** que los valores no cumplen mínimo menor o igual que sugerido y sugerido menor o igual que máximo entre los precios presentes
- **Cuando:** intento guardar el producto
- **Entonces:** el sistema rechaza el rango e indica qué precios deben corregirse.

### User Story PROD-003 — Desactivar un producto con historial

- **Estado:** Confirmada
- **Como** administrador
- **quiero** desactivar un producto que ya no se comercializa
- **para** impedir nuevas operaciones sin destruir su historial.

#### Criterios de aceptación

- **Escenario:** Desactivación de producto utilizado
- **Dado:** que el producto participa en compras, movimientos o ventas históricas
- **Cuando:** confirmo su desactivación
- **Entonces:** deja de estar disponible para nuevas operaciones y permanece visible en los registros históricos.

### User Story PROD-004 — Aprobar una venta debajo del precio mínimo

- **Estado:** Confirmada
- **Como** administrador
- **quiero** aprobar un precio inferior al mínimo con una razón
- **para** permitir acuerdos excepcionales sin perder control comercial.

#### Criterios de aceptación

- **Escenario:** Empleado propone un precio inferior al mínimo
- **Dado:** que una línea de venta tiene un precio inferior al mínimo vigente
- **Y dado:** que existe una razón escrita
- **Cuando:** un administrador aprueba la excepción
- **Entonces:** la línea puede confirmarse conservando precio de referencia, precio acordado, razón y aprobador.

- **Escenario:** Excepción sin aprobación
- **Dado:** que una línea de venta tiene un precio inferior al mínimo vigente
- **Cuando:** el empleado intenta confirmar la venta sin aprobación administrativa
- **Entonces:** el sistema impide confirmar la venta.

### User Story PROD-005 — Asociar imágenes a un producto

- **Estado:** Confirmada
- **Como** administrador
- **quiero** asociar hasta dos imágenes opcionales a un producto
- **para** reconocer visualmente la mercancía sin depender únicamente del código o nombre.

#### Criterios de aceptación

- **Escenario:** Producto sin imágenes
- **Dado:** que completé los datos obligatorios del producto
- **Cuando:** lo guardo sin adjuntar imágenes
- **Entonces:** el producto queda registrado normalmente con una representación visual predeterminada.

- **Escenario:** Producto con hasta dos imágenes
- **Dado:** que seleccioné una o dos imágenes válidas
- **Cuando:** guardo el producto
- **Entonces:** las imágenes quedan asociadas y disponibles en su consulta.

- **Escenario:** Producto supera el límite de imágenes
- **Dado:** que el producto ya tiene dos imágenes asociadas
- **Cuando:** intento añadir otra imagen
- **Entonces:** el sistema rechaza la operación e informa el límite permitido.

### User Story PROD-006 — Organizar productos mediante categorías y etiquetas

- **Estado:** Confirmada
- **Como** empleado
- **quiero** filtrar productos por categoría y etiquetas
- **para** encontrarlos aunque no recuerde su código o nombre exacto.

#### Criterios de aceptación

- **Escenario:** Producto clasificado
- **Dado:** que todo producto posee una categoría y puede tener varias etiquetas opcionales
- **Cuando:** filtro el catálogo por una categoría o etiqueta
- **Entonces:** veo los productos activos que coinciden con el criterio elegido.

### User Story PROD-007 — Administrar categorías y etiquetas sin perder historial

- **Estado:** Confirmada
- **Como** administrador
- **quiero** crear, renombrar y desactivar categorías y etiquetas
- **para** mantener organizada la búsqueda de productos sin romper clasificaciones históricas.

#### Criterios de aceptación

- **Escenario:** Creación de una clasificación
- **Dado:** que no existe una categoría o etiqueta equivalente activa
- **Cuando:** registro su nombre
- **Entonces:** queda disponible para clasificar productos.

- **Escenario:** Cambio de nombre
- **Dado:** que existe una categoría o etiqueta activa
- **Cuando:** actualizo su nombre
- **Entonces:** los productos asociados muestran el nuevo nombre sin perder su relación.

- **Escenario:** Desactivación de una clasificación utilizada
- **Dado:** que una categoría o etiqueta está asociada con productos
- **Cuando:** confirmo su desactivación
- **Entonces:** deja de estar disponible para nuevas asignaciones y permanece visible en el historial existente.

---

