# Fundamentos de datos

**Estado:** versión inicial confirmada el 2026-08-23.

Este documento reúne las decisiones transversales confirmadas antes del modelo relacional. Todavía no define modelos Prisma.

## 1. Identificadores

### Recomendación

Utilizar UUID ordenables temporalmente —preferentemente UUIDv7— como identificadores persistentes de entidades y agregados. El dominio continuará tratándolos como tipos opacos (`VentaId`, `ProductoId`, etc.) y no dependerá del formato UUID.

### Razones

- pueden generarse antes de persistir, útil para agregados y operaciones coordinadas;
- no exponen conteos secuenciales en URLs o contratos;
- permiten importar y mover datos sin renumerar identidades;
- su orden temporal mejora la localidad de índices frente a UUID completamente aleatorios;
- facilitan una evolución futura sin acoplar identidad a una única base de datos.

### Alternativas

| Alternativa | Ventajas | Desventajas | Evaluación |
| --- | --- | --- | --- |
| `BIGINT` autoincremental | Simple, compacto y rápido | Identidad nace en base de datos, expone secuencia y complica movimientos de datos | Válida para un monolito pequeño, pero menos alineada con agregados que generan identidad |
| UUIDv4 | Generación distribuida y amplio soporte | Inserciones aleatorias y peor localidad de índice | No aporta ventaja frente a un UUID ordenable para Nova |
| Código manual como PK | Familiar para el negocio | Puede corregirse o cambiar y filtra una decisión comercial a todas las relaciones | Rechazada; el código es clave de negocio única, no identidad interna |

### Consecuencias

- Las claves primarias serán más grandes que un `BIGINT`.
- Los códigos visibles de producto permanecen separados y únicos.
- La librería o mecanismo concreto para producir UUIDv7 se decidirá en implementación y quedará detrás de un generador de identidades.

## 2. Dinero, costos y cantidades

### Dinero transaccional

Representar importes reales en PEN como céntimos enteros:

```text
S/ 125.40 = 12 540 céntimos
```

Aplica a precios, totales acordados, pagos, reembolsos, gastos, anticipos y movimientos de caja.

Ventajas:

- evita errores de coma flotante;
- prohíbe fracciones de céntimo en dinero cobrado o pagado;
- las sumas y comparaciones son exactas;
- el dominio puede usar un objeto `Dinero` sin depender de `Decimal` de Prisma.

La base utilizará un entero con capacidad suficiente y restricciones que impidan valores fuera del rango de cada operación.

### Cantidades

Las unidades de inventario usan enteros. No existen juguetes fraccionarios en el alcance actual.

### Costos calculados

El sistema conserva:

- costo unitario de compra en céntimos;
- costo total de cada línea de compra;
- valor total del inventario atribuible por producto;
- costo total atribuido a cada línea de venta, devolución o baja.

Cuando una división no sea exacta, se distribuyen los céntimos residuales de forma determinista para que la suma de asignaciones coincida siempre con el total original. Nunca se corrige una diferencia inventando decimales monetarios invisibles.

## 3. Método de costeo

### Recomendación

Usar costo promedio móvil global por producto, conservando el historial de cada compra.

```text
nuevo valor disponible = valor anterior no atribuido + costo de nuevas unidades
nueva cantidad         = cantidad anterior no atribuida + nuevas unidades
costo promedio         = nuevo valor disponible / nueva cantidad
```

El promedio es global para el producto, no por tienda o almacén. Un traslado cambia ubicación física, pero no el valor del juguete.

### Asignación

- Al confirmar una venta, el costo de sus unidades queda atribuido y congelado en las líneas comerciales, incluso si algunas unidades permanecen reservadas.
- Las unidades reservadas conservan esa atribución y no vuelven a participar en el promedio disponible.
- Cancelar o liberar una venta reincorpora el costo atribuido de las unidades que vuelven a estar disponibles.
- Una devolución con retorno apto reincorpora al promedio disponible el costo histórico atribuido a esas unidades.
- Una devolución pendiente de revisión conserva ese costo en una posición separada; solo vuelve al promedio disponible al declararse apta.
- Una devolución sin retorno revierte ingreso comercial, pero conserva el costo ya reconocido.
- Una unidad retornada en revisión conserva su costo; si luego se da de baja, ese costo se reconoce como pérdida.

### Por qué promedio móvil

Nova no identifica unidades físicas ni lotes al vender. FIFO afirmaría que salió una compra específica aunque el negocio no distingue físicamente ese lote. El promedio móvil ofrece un costo explicable, estable y coherente con esa operación real.

### Alternativas

| Alternativa | Ventajas | Desventajas | Evaluación |
| --- | --- | --- | --- |
| FIFO | Trazabilidad exacta por capas y conserva cada costo | Requiere consumir y transferir capas que el negocio no identifica físicamente | Mayor complejidad sin evidencia operativa que justifique el lote |
| Último costo | Muy sencillo y útil para precio de reposición | No representa el costo histórico de las unidades existentes | Se conservará como referencia para sugerir precios, no como costo de venta |
| Promedio por ubicación | Refleja valores separados por local | Los traslados obligan a mover valor y pueden dar costos distintos al mismo producto | Innecesario con una sola tienda y un almacén del mismo negocio |

### Control requerido

La atribución de costos debe ejecutarse con bloqueo o control de versión para impedir que dos ventas consuman simultáneamente el mismo valor disponible. La estrategia técnica se detallará con las transacciones.

### Evolución futura a FIFO

La política de costeo no se incrustará en repositorios ni controladores. Cada asignación conservará el identificador y versión de la política utilizada, inicialmente `MOVING_AVERAGE_V1`.

Si Nova controla lotes en el futuro, podrá activar FIFO desde una fecha de corte creando una capa de apertura con la cantidad y valor existentes. Las ventas anteriores conservarán su costo promedio histórico y las posteriores utilizarán la nueva política. No se promete reconstruir retrospectivamente lotes que el negocio no identificó.

## 4. Pagos atribuibles en devoluciones parciales

### Recomendación

Como cada pago pertenece a la venta completa y no a una línea, atribuir el pago neto proporcionalmente al valor comercial neto de las líneas vigentes.

Ejemplo:

- línea A: S/ 60;
- línea B: S/ 40;
- pago neto total: S/ 50;
- pago atribuible a A: S/ 30;
- pago atribuible a B: S/ 20.

Si se devuelve B, el reembolso máximo inicial es S/ 20, no S/ 40, porque solo ese importe fue efectivamente pagado y atribuible.

### Reglas

- La atribución se recalcula desde movimientos vigentes; no convierte cada pago en varios pagos.
- Los céntimos residuales se asignan con una regla determinista y estable.
- El total atribuido nunca supera el pago neto de la venta.
- El reembolso acumulado de una unidad nunca supera su pago atribuible.
- Ajustes del total y devoluciones anteriores forman parte del valor comercial neto usado en el cálculo.

### Alternativas

| Alternativa | Problema |
| --- | --- |
| Asignar pagos manualmente por línea | Añade trabajo en cada cobro y contradice el pago único asociado a la venta |
| Consumir líneas en orden | El resultado depende de un orden artificial que el cliente nunca acordó |
| Permitir reembolsar el precio completo aunque no esté pagado | Puede devolver más dinero del recibido |

La fórmula exacta de redondeo y distribución se acompañará de ejemplos y pruebas antes de implementar devoluciones.

## 5. Fechas y zona horaria

### Recomendación

- Guardar instantes técnicos y de operaciones como fecha y hora con zona, normalizados a UTC.
- Mostrar y agrupar usando `America/Lima` como zona del negocio.
- Guardar fechas civiles sin hora —como vencimiento— mediante tipo `date`.
- Conservar por separado `created_at`, `updated_at` y la fecha efectiva cuando una operación pueda registrarse después de haber ocurrido.

### Regla de período

Un mes de reporte se interpreta desde las `00:00` del primer día hasta antes de las `00:00` del primer día del mes siguiente en `America/Lima`, convirtiendo esos límites a UTC para consultar.

No se almacenan horas locales sin zona ni se calcula un mes mediante una cantidad fija de segundos.

## 6. Auditoría e historial

### Recomendación

Combinar metadatos comunes con historial explícito de operaciones sensibles:

- entidades mutables: `created_at` y `updated_at`;
- operaciones humanas: `actor_id` y fecha efectiva;
- acciones sensibles: razón obligatoria cuando corresponda;
- pagos, ajustes, movimientos, devoluciones, cierres, cancelaciones y aplicaciones: registros propios inmutables;
- correcciones: estado y referencia al registro compensatorio, nunca sobrescritura destructiva.

No crear inicialmente una tabla genérica que almacene copias JSON de cada cambio. Duplicaría el modelo, dificultaría restricciones y daría una falsa sensación de auditoría. Se evaluará un registro técnico adicional para seguridad y diagnóstico durante la fase de arquitectura.

## 7. Eliminación y conservación

- Productos, categorías, etiquetas, clientes fusionados, proveedores y cuentas con historia no se eliminan físicamente.
- Sus estados activos, inactivos o fusionados controlan nuevas operaciones.
- Registros transaccionales confirmados son inmutables o compensables.
- No se añadirá `deleted_at` automáticamente a todas las tablas.
- La eliminación física se limita a datos técnicos recuperables o borradores sin efectos, cuando el caso de uso se defina expresamente.

## Decisiones registradas mediante ADR

- [ADR-0003: UUID ordenables](../adr/0003-use-time-ordered-uuids.md).
- [ADR-0004: dinero en céntimos enteros](../adr/0004-store-money-as-integer-cents.md).
- [ADR-0005: costo promedio móvil global](../adr/0005-use-global-moving-average-cost.md).
