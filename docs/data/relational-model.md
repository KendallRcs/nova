# Modelo relacional lógico

**Estado:** Versión inicial confirmada el 2026-08-24.

Este documento traduce el modelo de dominio de Nova a relaciones persistentes sin
acoplarlo todavía a Prisma ni a nombres físicos definitivos. Describe propiedad,
cardinalidades y fuentes de verdad; las restricciones SQL concretas se definirán
en el siguiente paso.

## Convenciones

- Todas las entidades tienen un identificador UUID ordenado.
- Los importes usan enteros en céntimos y el sufijo conceptual `_cents`.
- Las cantidades de inventario son enteros.
- Los instantes se almacenan en UTC; una fecha de vencimiento es una fecha civil.
- Las referencias entre contextos son identificadores, no objetos compartidos.
- Las entidades mutables tienen `created_at` y `updated_at`; los hechos históricos
  registran además autor y fecha efectiva.
- Los estados de ciclo de vida son explícitos. No existe un `deleted_at` universal.
- Los nombres en `snake_case` son conceptuales y podrán ajustarse al mapear Prisma.

## Identidad y acceso

| Relación | Datos principales | Cardinalidades y notas |
| --- | --- | --- |
| `access_profiles` | nombre, estado | Un perfil agrupa permisos. Inicialmente se siembran Administrador y Empleado. |
| `permissions` | módulo, acción, código único | Catálogo extensible de capacidades. |
| `profile_permissions` | profile_id, permission_id | Unión N:M con unicidad del par. |
| `user_accounts` | profile_id, username normalizado, hash de credencial, estado, security_version | Un perfil tiene muchas cuentas; el username es único. No se elimina una cuenta con historia. |
| `sessions` | user_id, credencial de renovación protegida, security_version emitida, estado, metadatos opcionales, issued_at, renewed_at, ended_at | Una cuenta tiene muchas sesiones. El cierre de sesión o cambio de seguridad invalida la sesión, no la borra. |

Las tablas operativas que indiquen autor apuntan a `user_accounts`. Desactivar un
usuario preserva toda su autoría histórica.

## Catálogo

| Relación | Datos principales | Cardinalidades y notas |
| --- | --- | --- |
| `categories` | nombre, descripción opcional, estado | Una categoría clasifica muchos productos y todo producto pertenece a una. |
| `tags` | nombre normalizado, estado | Palabras clave reutilizables. |
| `products` | category_id, código normalizado, nombre, descripción, precio mínimo/sugerido/máximo, estado | Código, nombre, categoría y precio mínimo son obligatorios. El código manual es único; sugerido y máximo son opcionales. |
| `product_tags` | product_id, tag_id | Unión N:M con unicidad del par. |
| `product_images` | product_id, storage_key, orden, metadatos técnicos | Un producto tiene de cero a dos imágenes; el orden solo admite 1 o 2. |

Un producto usado por operaciones históricas se desactiva en vez de eliminarse.
La ubicación física de archivos queda detrás de `storage_key`; el núcleo no conoce
Cloudinary ni otro proveedor.

## Clientes

| Relación | Datos principales | Cardinalidades y notas |
| --- | --- | --- |
| `customers` | nombre, teléfono normalizado, DNI y dirección opcionales, estado, merged_into_customer_id opcional | Un cliente puede absorber duplicados. El registro absorbido apunta al cliente principal. |
| `customer_merges` | primary_customer_id, duplicate_customer_id, datos resueltos, merged_by, merged_at | Auditoría inmutable de la consolidación; un duplicado solo puede ser absorbido una vez. |

Las ventas conservan el `customer_id` utilizado al registrarlas. Las consultas
pueden resolver el cliente canónico siguiendo la fusión, sin reescribir historia.
El DNI y la dirección son opcionales. La unicidad exacta del teléfono cuando
existen clientes fusionados se concreta en las restricciones.

## Ventas, cobros y entregas

| Relación | Datos principales | Cardinalidades y notas |
| --- | --- | --- |
| `sales` | created_by, customer_id opcional, estado de ciclo de vida, total original, total vigente, due_date opcional, version, fechas de confirmación/finalización/cancelación | Una venta pertenece a su creador y, como máximo, a un cliente. Tiene una o más líneas al confirmarse. |
| `sale_lines` | sale_id, product_id, cantidad, precio unitario acordado, subtotal original, instantánea de código/nombre/precios, razón y aprobador de excepción, costo atribuido, política de costeo | Muchas líneas pertenecen a una venta. Cada producto aparece una sola vez por venta y puede tener cantidad mayor a uno. |
| `sale_total_adjustments` | sale_id, total anterior, total nuevo, diferencia, razón, changed_by, effective_at | Historial inmutable de cambios posteriores al total acordado. |
| `payments` | sale_id, importe, método, registered_by, effective_at, estado | Cada pago pertenece exactamente a una venta. Una venta puede tener muchos pagos. |
| `payment_corrections` | payment_id, tipo, importe compensado, razón, corrected_by, effective_at | Un pago puede tener varias correcciones compensatorias; nunca se sobrescribe el hecho original. |
| `deliveries` | sale_id, delivered_by, effective_at | Una venta puede tener varias entregas. |
| `delivery_lines` | delivery_id, sale_line_id, location_id, cantidad | Una entrega contiene una o más líneas y especifica de qué ubicación salió cada cantidad. |
| `returns` | sale_id, razón obligatoria, estado, created_by, effective_at | Una venta puede tener varias devoluciones. |
| `return_lines` | return_id, sale_line_id, cantidad, importe comercial, product_returns, return_location_id opcional, condición opcional, costo atribuido | Permite devolver dinero con o sin retorno físico del producto. |
| `return_refunds` | return_id, importe, método, registered_by, effective_at | Una devolución tiene exactamente un reembolso monetario. |
| `sale_closures` | sale_id, tipo completa/incompleta, importe condonado, razón, closed_by, effective_at | Como máximo un cierre definitivo por venta. |
| `sale_cancellations` | sale_id, razón, cancelled_by, effective_at | Como máximo una cancelación por venta. |
| `sale_cancellation_lines` | cancellation_id, sale_line_id, cantidad liberada, cantidad retornada, cantidad no retornada | Conserva el resultado físico por línea al cancelar. |
| `sale_cancellation_refunds` | cancellation_id, importe, método, registered_by, effective_at | Registra el dinero devuelto al cancelar, si lo hubo. |

Reglas estructurales importantes:

- `customer_id` puede estar vacío en borrador o venta al contado, pero será
  obligatorio al confirmar una venta que deje saldo pendiente.
- El costo de cada línea queda congelado al confirmar la venta, aunque el producto
  permanezca reservado físicamente.
- Cambiar el total crea `sale_total_adjustments`; no altera el total original.
- Entrega, pago y cierre son dimensiones distintas. Pagar no implica entregar y
  entregar no implica completar el pago.
- Una devolución completa incluye producto y dinero; el modelo también conserva
  explícitamente los casos excepcionales donde el producto no retorna.
- Las correcciones generan hechos compensatorios y el correspondiente movimiento
  financiero; no eliminan pagos ni devoluciones.

## Inventario y costo

| Relación | Datos principales | Cardinalidades y notas |
| --- | --- | --- |
| `locations` | código, nombre, tipo tienda/almacén, estado | Inicialmente existen exactamente la tienda y el almacén; el modelo admite más ubicaciones futuras. |
| `inventory_positions` | product_id, location_id, physical_quantity, reserved_quantity, review_quantity, version | Una fila única por producto y ubicación. Es una proyección transaccional protegida. |
| `inventory_reservations` | sale_line_id, location_id, initial_quantity, active_quantity, estado, created_at, ended_at | Una línea puede reservar cantidades en una o más ubicaciones. Conserva liberaciones y consumos. |
| `inventory_movements` | product_id, location_id, tipo, deltas físico/reservado/revisión, valores anterior/resultante, autor, effective_at, razón y referencia origen | Libro inmutable de todo cambio de inventario. |
| `inventory_transfers` | product_id, origin_location_id, destination_location_id, cantidad, transferred_by, effective_at | Una transferencia produce dos movimientos enlazados: salida y entrada. |
| `product_cost_positions` | product_id, available_quantity/value, review_quantity/value, reserved_quantity/value, version, costing_policy | Posición global de costo por producto, independiente de la ubicación. |
| `cost_movements` | product_id, tipo, cantidad, valor, saldos anterior/resultante, política de costeo, effective_at y referencia origen | Libro inmutable de variaciones del valor de inventario. |
| `sale_cost_allocations` | sale_line_id, cantidad, costo total congelado, reserved_remaining_quantity/value, costing_policy | Una o más asignaciones de costo pertenecen a una línea. El costo comercial no cambia al entregar una reserva. |

`inventory_positions` permite bloquear y actualizar una fila concreta durante una
operación concurrente. Debe reconciliarse con `inventory_movements`; no reemplaza
el libro histórico. De igual forma, `product_cost_positions` se reconcilia con
`cost_movements`.

El costo es global por producto, pero el stock físico está separado por ubicación.
El costo promedio vigente se calcula solo con unidades que aún forman parte del
inventario disponible bajo `MOVING_AVERAGE_V1`. Al confirmar una venta, el valor
sale de disponible y queda asignado a su línea. Si la mercadería queda separada,
esa asignación conserva temporalmente cantidad y valor reservados hasta entregar,
liberar o devolver. Las unidades en revisión se aíslan del promedio disponible.

La transición futura a FIFO conserva `costing_policy` en posiciones, movimientos
y asignaciones. Los saldos existentes podrán convertirse en una capa inicial sin
reconstruir compras históricas ni recalcular ventas ya confirmadas.

## Proveedores y compras

| Relación | Datos principales | Cardinalidades y notas |
| --- | --- | --- |
| `suppliers` | nombre, contacto y descripción opcionales, estado | Un proveedor tiene muchas compras y adelantos. |
| `purchases` | supplier_id opcional, instantánea opcional del proveedor ocasional, estado, total, importe cubierto por adelantos, importe nuevo pagado, created_by, confirmed_by, fechas | Una compra tiene una o más líneas al confirmarse y conserva quién la suministró, registrado u ocasional. |
| `purchase_lines` | purchase_id, product_id, destination_location_id, cantidad, costo unitario, subtotal | Cada línea repone un producto en una ubicación y alimenta su costo global. |
| `supplier_advances` | supplier_id, importe original, saldo vigente, método, propósito/descripción, estado, version, registered_by, effective_at | Un adelanto requiere proveedor registrado y puede reservar productos existentes, nuevos o todavía no detallados. |
| `advance_applications` | advance_id, purchase_id, importe, applied_by, effective_at | Unión N:M: una compra usa varios adelantos y un adelanto puede aplicarse a varias compras. |
| `advance_refunds` | advance_id, importe, método, registered_by, effective_at | Un adelanto puede tener varias devoluciones recibidas. |
| `advance_losses` | advance_id, importe, razón, registered_by, effective_at | Registra la parte que se decide reconocer como pérdida. |

Confirmar una compra crea inventario, costo y salida financiera dentro de un mismo
límite transaccional. La parte aplicada desde un adelanto no genera una segunda
salida de dinero: consume el saldo del adelanto. El detalle de productos esperado
en un adelanto es informativo y puede cambiar cuando se concrete la compra.

## Finanzas y gastos

| Relación | Datos principales | Cardinalidades y notas |
| --- | --- | --- |
| `cash_movements` | dirección entrada/salida, importe, método, estado, idempotency_key, registered_by, effective_at, razón y referencia origen | Libro financiero inmutable. Cada hecho monetario produce un movimiento. |
| `expense_categories` | nombre, estado | Clasifica gastos manuales como movilidad, renta o comida. |
| `operating_expenses` | category_id, importe, método, descripción opcional, comprobante opcional, registered_by, effective_at, estado | Solo representa gastos independientes; las compras y adelantos se integran automáticamente mediante `cash_movements`. |
| `expense_cancellations` | expense_id, razón, cancelled_by, effective_at | Compensa un gasto sin borrar su registro original. |

Cada `cash_movement` tendrá exactamente una referencia foránea de origen entre las
operaciones que pueden mover dinero: pago, corrección, reembolso, compra, adelanto,
devolución de adelanto, gasto o cancelación. Aplicar un adelanto o reconocer su
pérdida no mueve dinero nuevamente. Se propone usar columnas origen explícitas y una restricción de
exclusión mutua, en lugar de `origin_type + origin_id`, para que PostgreSQL pueda
garantizar la existencia del documento causal.

## Importación inicial

| Relación | Datos principales | Cardinalidades y notas |
| --- | --- | --- |
| `initial_product_imports` | archivo/checksum, estado, filas totales, resumen de validación, requested_by, validated_at, confirmed_at | Conserva la trazabilidad de la carga inicial de productos. Solo puede existir una importación confirmada con éxito. |

La validación es de todo o nada. Ningún producto se persiste si una fila falla, y
la confirmación de todas las filas ocurre en una sola transacción. No se modelan
importaciones de ventas ni un subsistema genérico reutilizable.

## Datos calculados y proyecciones almacenadas

No se almacenan como fuente de verdad:

- stock disponible: `physical_quantity - reserved_quantity - review_quantity`;
- saldo de una venta: total vigente menos pagos efectivos y más/menos ajustes o
  reembolsos según las reglas confirmadas;
- estado de pago, estado de entrega y etiqueta de atraso;
- ganancia: ingreso reconocido menos costo congelado y efectos de devoluciones;
- costo promedio unitario, derivado de cantidad y valor disponibles;
- métricas mensuales y rankings del dashboard.

Sí se almacenan como proyecciones protegidas por concurrencia:

- total vigente de una venta, reconciliable con sus ajustes;
- cantidades actuales por producto y ubicación;
- cantidad y valor globales disponibles, reservados y en revisión;
- saldo vigente de un adelanto;
- versiones optimistas de agregados con escrituras concurrentes.

Estas duplicaciones son intencionales: aceleran operaciones críticas, pero cada
una tiene un libro o historial autoritativo con el cual debe reconciliarse.

## Resumen de cardinalidades críticas

| Origen | Relación | Destino |
| --- | --- | --- |
| Perfil | 1:N | Usuario |
| Perfil | N:M | Permiso |
| Producto | N:M | Tag |
| Producto | 1:0..2 | Imagen |
| Cliente | 1:N | Venta |
| Venta | 1:N | Línea de venta |
| Venta | 1:N | Pago |
| Venta | 1:N | Entrega |
| Entrega | 1:N | Línea de entrega |
| Venta | 1:N | Devolución |
| Devolución | 1:N | Línea de devolución |
| Producto + ubicación | 1:1 | Posición de inventario |
| Línea de venta | 1:N | Reserva de inventario |
| Producto | 1:1 | Posición global de costo |
| Compra | 1:N | Línea de compra |
| Adelanto de proveedor | N:M | Compra, mediante aplicación |
| Hecho monetario | 1:1 | Movimiento financiero |

## Fuera de este paso

Quedan deliberadamente pendientes para los siguientes documentos:

- nombres de enums y restricciones `CHECK`, `UNIQUE` y claves foráneas exactas;
- política concreta de borrado o restricción por relación;
- orden de bloqueos, aislamiento y límites de cada transacción;
- índices, vistas, modelos de lectura y estrategia del dashboard;
- diagrama ER y mapeo físico a Prisma/PostgreSQL;
- proveedor y ciclo de vida concreto de imágenes y comprobantes.

Aceptar este modelo no confirma automáticamente esos detalles.
