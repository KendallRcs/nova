# Índices y modelos de lectura

**Estado:** Versión inicial confirmada el 2026-08-24.

Este documento diseña las consultas del MVP sin contaminar el modelo de escritura.
Nova usará CQRS-lite: una sola base PostgreSQL y una sola fuente de verdad, con
repositorios orientados a agregados para escribir y consultas especializadas para
leer.

## Principios

- Un índice existe para una consulta, restricción o bloqueo conocido; no se indexa
  cada columna por prevención.
- PostgreSQL crea índices para claves primarias y restricciones únicas, pero las
  claves foráneas que se consulten o participen en borrados deben indexarse de
  forma explícita.
- Los índices compuestos siguen igualdad, rango y ordenamiento de las consultas
  reales.
- Las listas extensas usan paginación por cursor estable, no `OFFSET` creciente.
- Los dashboards leen hechos confirmados; borradores y operaciones anuladas se
  excluyen según la semántica de cada métrica.
- Ningún modelo de lectura se convierte en autoridad de stock, deuda, costo o caja.
- No se introducen tablas materializadas, Elasticsearch, Redis ni una base de
  lectura separada en el MVP.

## Separación hexagonal de lecturas y escrituras

```text
Escritura
Controlador ──► capacidad ──► repositorios de agregados ──► PostgreSQL

Lectura
Controlador ──► consulta de aplicación ──► query adapter PostgreSQL ──► DTO
```

- Un repositorio carga y persiste una frontera de consistencia; no ofrece métodos
  para cada pantalla.
- Una query puede unir ventas, clientes, pagos, productos, inventario y usuarios
  cuando el resultado es solo de lectura.
- La query concreta vive en el adaptador PostgreSQL y puede usar Prisma o SQL.
- El contrato de la capacidad de consulta usa filtros y DTO propios, nunca tipos
  generados por Prisma.
- Cálculos con significado de negocio —saldo, atraso, margen— se definen una sola
  vez mediante expresiones SQL reutilizables o transformaciones puras. El formato
  visual permanece en el frontend.
- Las pruebas de integración verifican la query contra PostgreSQL; las reglas
  puras derivadas se prueban sin base de datos.

Esto no es event sourcing ni CQRS completo: escrituras y lecturas comparten las
mismas tablas confirmadas y el resultado es consistente al commit.

## Convenciones de búsqueda y paginación

### Texto

- Códigos, usernames y teléfonos se consultan por su columna normalizada exacta.
- Producto y cliente conservan una representación normalizada de búsqueda para no
  depender de mayúsculas, tildes o espacios de presentación.
- En el MVP se priorizan coincidencia exacta de código/teléfono y búsqueda por
  prefijo de nombre. Una búsqueda tolerante a fragmentos mediante `pg_trgm` queda
  como optimización medible, no como requisito inicial para unos 300 productos.

### Cursores

Las listas cronológicas se ordenan por `(effective_at DESC, id DESC)` o, cuando no
existe fecha efectiva, `(created_at DESC, id DESC)`. El cursor contiene ambos
valores para que empates y nuevas inserciones no dupliquen ni omitan filas.

Los catálogos estables se ordenan por nombre normalizado y UUID. La API impone un
límite máximo de página; su valor concreto se definirá con los contratos HTTP.

### Periodos

Los filtros mensuales reciben fechas civiles del negocio. La aplicación convierte
`[inicio, fin)` desde `America/Lima` a UTC una sola vez y las queries comparan el
instante efectivo contra esos límites. No aplican funciones de zona horaria a la
columna indexada en cada fila.

## Índices estructurales

Los siguientes índices respaldan identidad, joins y relaciones frecuentes. Las
claves primarias y restricciones únicas confirmadas no se duplican.

| Área | Índice conceptual | Propósito |
| --- | --- | --- |
| Acceso | `sessions(user_id, status)` | revocar y consultar sesiones de una cuenta |
| Acceso | `sessions(protected_credential)` único | resolver renovaciones sin duplicados |
| Catálogo | `products(category_id, status)` | productos activos por categoría |
| Catálogo | `products(search_name, id)` | búsqueda y orden estable por nombre |
| Catálogo | `product_tags(tag_id, product_id)` | productos asociados a un tag |
| Clientes | `customers(phone_normalized)` único parcial para canónicos | impedir duplicados activos/canónicos |
| Clientes | `customers(search_name, id)` | búsqueda estable por nombre |
| Clientes | `customers(merged_into_customer_id)` | resolver fusiones y dependientes |
| Ventas | `sale_lines(sale_id, product_id)` único | reconstruir venta e impedir producto repetido |
| Ventas | `sales(customer_id, confirmed_at DESC, id DESC)` | historial y deuda por cliente |
| Ventas | `sales(created_by, confirmed_at DESC, id DESC)` | actividad comercial por cuenta |
| Ventas | `sales(due_date, id)` parcial con ventas abiertas | seguimiento de deudas vencidas o próximas |
| Pagos | `payments(sale_id, effective_at, id)` | saldo e historial cronológico de la venta |
| Pagos | `payments(registered_by, effective_at DESC, id DESC)` | cobros por cuenta y periodo |
| Entregas | `deliveries(sale_id, effective_at, id)` | historial de entrega |
| Entregas | `delivery_lines(sale_line_id)` | cantidades entregadas por línea |
| Devoluciones | `returns(sale_id, effective_at, id)` | devoluciones de la venta |
| Devoluciones | `return_lines(sale_line_id)` | cantidad e importe ya devueltos |
| Inventario | `inventory_positions(product_id, location_id)` único | posición bloqueable y consulta por producto |
| Inventario | `inventory_positions(location_id, product_id)` | listado de stock de una ubicación |
| Inventario | `inventory_reservations(sale_line_id, location_id)` parcial activa | localizar y resolver reservas vigentes |
| Inventario | `inventory_movements(product_id, location_id, effective_at DESC, id DESC)` | kardex por producto y ubicación |
| Costo | `cost_movements(product_id, effective_at DESC, id DESC)` | historia y reconciliación de costo |
| Costo | `sale_cost_allocations(sale_line_id)` | costo congelado de la línea |
| Compras | `purchases(supplier_id, effective_at DESC, id DESC)` | historial del proveedor |
| Compras | `purchase_lines(product_id, purchase_id)` | compras y último costo por producto |
| Adelantos | `supplier_advances(supplier_id, status, effective_at DESC, id DESC)` | saldos por proveedor |
| Adelantos | `advance_applications(purchase_id, advance_id)` | adelantos usados por una compra |
| Caja | `cash_movements(effective_at DESC, id DESC)` | libro y reportes por periodo |
| Caja | `cash_movements(method, effective_at DESC, id DESC)` | totales por método de pago |
| Gastos | `operating_expenses(category_id, effective_at DESC, id DESC)` | gastos por categoría y periodo |
| Importación | `initial_product_imports(status)` único parcial confirmado | garantizar la única carga inicial exitosa |

Los índices parciales deben usar estados estables y expresiones que PostgreSQL
pueda evaluar de forma inmutable. La etiqueta “atrasada” depende de la fecha actual
y por eso no forma parte de la condición de un índice; la query filtra `due_date`
contra la fecha de negocio usando el índice de ventas abiertas.

## Índices orientados a reportes

Se agregan solamente si `EXPLAIN (ANALYZE, BUFFERS)` demuestra que los índices
estructurales no bastan:

| Consulta | Índice candidato | Motivo para diferirlo |
| --- | --- | --- |
| Ventas por estado y periodo | `sales(lifecycle_status, confirmed_at, id)` | con pocas ventas, el índice por fecha puede ser suficiente |
| Líneas vendidas por producto | `sale_lines(product_id, sale_id)` | útil al crecer el análisis histórico por producto |
| Caja por causa y periodo | `(origin_kind, effective_at, id)` o índice parcial por origen | la representación causal física aún se mapeará a Prisma |
| Movimientos por actor | `inventory_movements(actor_id, effective_at, id)` | requerido solo si auditoría lo consulta frecuentemente |
| Búsqueda parcial por nombre | GIN trigram sobre texto normalizado | extensión y costo de escritura injustificados sin medición |

Un índice candidato no forma parte del schema inicial hasta observar el plan de la
consulta con un volumen de prueba representativo.

## Modelos de lectura del MVP

Los nombres siguientes describen contratos conceptuales, no tablas ni nombres
definitivos de TypeScript.

### Catálogo con disponibilidad

**Entrada:** texto opcional, categoría, tags, estado y cursor.

**Salida por producto:** código, nombre, categoría, precios autorizados, imágenes,
stock físico/reservado/revisión/disponible por tienda y almacén.

El empleado puede ver precio de venta y stock, pero no costo, margen ni precio de
compra. La consulta selecciona columnas según una capacidad autorizada; no entrega
datos sensibles para ocultarlos solo con CSS.

### Detalle operativo de venta

**Entrada:** sale_id y actor autenticado.

**Salida:** cabecera, cliente canónico e identidad histórica, creador, líneas e
instantáneas, pagos/correcciones, entregas, reservas, devoluciones, total original
y vigente, saldo, situación de pago, situación de entrega y etiquetas.

El saldo se deriva de hechos vigentes. `atrasada` significa: saldo mayor que cero,
fecha de vencimiento anterior a la fecha actual de Lima y venta no cerrada ni
cancelada. Esta etiqueta no se persiste.

### Ventas y actividad por cuenta

**Entrada:** periodo, usuario opcional, estado y cursor.

**Salida:** venta, creador, fecha, cliente, total vigente, cobro neto, saldo,
estado de pago y entrega. El reporte distingue ventas creadas de pagos registrados;
un pago no se atribuye automáticamente al creador de la venta.

### Cuenta por cobrar de clientes

**Entrada:** texto de cliente, estado de deuda, vencimiento y cursor.

**Salida por cliente canónico:** nombre, teléfono, cantidad de ventas con saldo,
saldo total, monto vencido y vencimiento más cercano. El detalle expande ventas,
total vigente, pagos netos, saldo y última fecha de pago.

Los clientes fusionados se agrupan bajo el principal sin reescribir el
`customer_id` histórico de las ventas.

### Seguimiento de inventario

**Entrada:** producto, categoría, ubicación, disponibilidad y cursor.

**Salida:** producto, cantidades físicas, reservadas, en revisión y disponibles
por ubicación; total global físico; reservas activas; última fecha de movimiento.

El kardex es otra consulta paginada por producto/ubicación y devuelve movimientos,
causa, actor, fecha y saldos anterior/resultante.

### Compras y adelantos

**Entrada:** proveedor, estado, periodo y cursor.

**Salida de compra:** proveedor registrado u ocasional, líneas, total, adelantos
aplicados, pago nuevo, usuario y fecha. **Salida de adelanto:** importe original,
aplicado, reembolsado, perdido, saldo y compras relacionadas.

El saldo de adelanto se deriva y se compara con la proyección almacenada para
detectar divergencias.

### Caja y gastos

**Entrada:** periodo, dirección, método, causa, categoría y cursor.

**Salida:** movimientos causales con importe, método, operación origen, actor y
fecha; además totales de entradas, salidas y neto por método. Los gastos se agrupan
por categoría sin duplicar compras o adelantos como gastos operativos.

### Resumen mensual del negocio

**Entrada:** intervalo mensual de Lima y, opcionalmente, comparación anterior.

**Salida:**

- ventas comerciales netas;
- cobros y reembolsos efectivos;
- costo reconocido de ventas y devoluciones;
- margen bruto;
- gastos operativos;
- pérdidas por bajas y adelantos perdidos;
- resultado estimado del periodo;
- saldo pendiente total y vencido;
- unidades vendidas, devueltas y dadas de baja.

El dashboard diferencia acuerdo comercial de movimiento de caja. “Ganancia” no es
simplemente dinero ingresado menos dinero salido: una compra aumenta inventario y
su costo se reconoce al vender o dar de baja.

### Rentabilidad por producto

**Entrada:** periodo, categoría, producto y ordenamiento.

**Salida:** unidades netas vendidas, ingreso comercial neto, costo atribuido neto,
margen bruto total, margen unitario y porcentaje de margen. Devoluciones sin
retorno revierten ingreso, pero conservan el costo reconocido según la política
confirmada.

### Desempeño por usuario

**Entrada:** periodo y usuario opcional.

**Salida:** cantidad y monto de ventas creadas, cobros registrados, devoluciones o
ajustes administrativos y ticket promedio. Las métricas no confunden autor de la
venta con registrador del cobro.

## Vistas SQL y consultas directas

Se recomiendan vistas SQL ordinarias para fórmulas compartidas y suficientemente
estables, por ejemplo:

- pagos netos por venta;
- reembolsos netos por venta;
- saldo vigente por venta;
- cantidades entregadas y devueltas por línea;
- balance explicado de adelantos;
- disponibilidad actual por producto y ubicación.

Las vistas no almacenan datos y permanecen dentro del adaptador PostgreSQL. Una
query puede componerlas con tablas y otras vistas. No se crea una vista por cada
endpoint ni se colocan reglas de autorización dentro de ellas.

Las vistas materializadas se difieren. Con el volumen inicial, consultar tablas e
índices ofrece datos inmediatos y evita refrescos, tablas derivadas y consistencia
eventual. Solo se evaluarán si una consulta medida no cumple el objetivo de
respuesta aun después de optimizarla.

## Consistencia y seguridad de lectura

- Las consultas ordinarias ven únicamente commits confirmados.
- Un reporte compuesto que requiera una fotografía consistente puede usar una
  transacción de solo lectura `REPEATABLE READ`.
- Las consultas reciben el actor o alcance autorizado cuando la visibilidad dependa
  de él; no aceptan un `user_id` arbitrario del cliente como autorización.
- Costos, márgenes, gastos, datos personales completos y actividad global solo se
  seleccionan para perfiles autorizados.
- Los DTO no incluyen hashes, credenciales de sesión, referencias internas de
  almacenamiento innecesarias ni datos personales que la pantalla no utiliza.

## Validación de rendimiento

Antes de aprobar el mapeo Prisma:

1. Crear datos de prueba por encima del volumen inicial esperado.
2. Ejecutar las consultas críticas con `EXPLAIN (ANALYZE, BUFFERS)`.
3. Verificar ausencia de N+1 desde los query adapters.
4. Confirmar uso de índices sin forzarlo artificialmente.
5. Medir p95 del endpoint completo, no solo tiempo SQL.
6. Revisar costo de escritura y tamaño después de cada índice añadido.

Las pruebas de query usan PostgreSQL real. Un fake no puede demostrar joins,
índices, zona horaria, semántica de `NULL` ni planes de ejecución.

## Reconciliaciones administrativas

Las consultas de diagnóstico, separadas de las pantallas habituales, detectan:

- posiciones físicas distintas de la suma de movimientos;
- posiciones de costo distintas del libro y asignaciones;
- total vigente distinto de su secuencia de ajustes;
- saldo de adelanto distinto de aplicaciones, devoluciones y pérdidas;
- operaciones monetarias sin exactamente un movimiento causal;
- movimientos físicos o de costo sin documento causal válido.

Estas consultas informan; no corrigen automáticamente. Una reparación debe usar
un caso de uso administrativo auditable.

## Decisiones todavía no implícitas

Este documento no fija:

- nombres físicos definitivos de vistas o índices;
- implementación con Prisma Client, SQL tipado o una combinación;
- extensión `pg_trgm`;
- materialización o caché futura;
- tamaño máximo de página y objetivos numéricos de rendimiento;
- diseño exacto de endpoints y DTO TypeScript.

Esas decisiones se tomarán al mapear e implementar consultas reales, usando los
planes de ejecución como evidencia.
