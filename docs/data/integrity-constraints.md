# Restricciones e integridad referencial

**Estado:** Versión inicial confirmada el 2026-08-24.

Este documento define qué invariantes del modelo relacional debe proteger
PostgreSQL y cuáles requieren coordinación transaccional desde los casos de uso.
La base de datos es la última barrera de integridad, pero no contiene la lógica de
negocio completa ni sustituye al dominio.

## Niveles de protección

| Nivel | Responsabilidad | Ejemplos |
| --- | --- | --- |
| Estructural | `NOT NULL`, tipos, claves foráneas, `UNIQUE` y `CHECK` | código único, importes positivos, máximo dos imágenes |
| Transaccional | Caso de uso, repositorios y bloqueos dentro de una transacción | no sobrepagar, no vender stock insuficiente, confirmar compra completa |
| Reconciliación | Verificaciones periódicas o administrativas | posición actual contra libro de movimientos, métricas reconstruibles |

Una regla que dependa de varias filas, del tiempo actual o de permisos no se
simula con un `CHECK` frágil. Se valida en el dominio y se persiste atómicamente;
cuando sea útil, se añade además una protección SQL diferible o un bloqueo.

## Reglas comunes

- Todo identificador principal es `NOT NULL` y único.
- Todo importe monetario es entero. Los importes de operaciones son mayores que
  cero; saldos, totales y valores acumulados pueden ser cero, nunca negativos.
- Toda cantidad operativa es mayor que cero. Cantidades de posición y saldos son
  mayores o iguales a cero.
- Los textos obligatorios se validan después de eliminar espacios exteriores y no
  pueden quedar vacíos.
- `created_at` es obligatorio; `updated_at >= created_at` cuando exista.
- Una fecha efectiva puede ser anterior a `created_at` para registrar una
  operación omitida, pero nunca se reescribe sin historial administrativo.
- `version` y `security_version` comienzan en un valor positivo y solo aumentan.
- Los vocabularios cerrados se representan mediante enums de aplicación y una
  restricción equivalente en PostgreSQL. Su representación física se decidirá al
  mapear Prisma.

## Identidad y acceso

### Unicidad y obligatoriedad

- `access_profiles.name`, `permissions.code` y `user_accounts.username_normalized`
  son únicos sin distinguir mayúsculas y minúsculas.
- `profile_permissions` es único por `(profile_id, permission_id)`.
- Toda cuenta pertenece a un perfil y contiene un hash de credencial no vacío.
- Una sesión pertenece a una sola cuenta y su credencial de renovación protegida
  no puede repetirse.
- Una sesión finalizada tiene `ended_at`; una sesión activa no lo tiene.
- La versión de seguridad emitida por una sesión no puede superar la versión
  vigente de la cuenta.

### Reglas transaccionales

- Solo una cuenta activa con perfil activo puede iniciar o renovar sesión.
- Cambiar contraseña, desactivar la cuenta o ejecutar “cerrar todas las sesiones”
  incrementa `security_version`; las sesiones con una versión anterior dejan de
  ser válidas aunque aún no hayan expirado.
- No hay bloqueo automático por cantidad de intentos fallidos.
- Los permisos se comprueban en cada caso de uso; una clave foránea no sustituye
  la autorización del actor.

## Catálogo

### Restricciones estructurales

- `products.code_normalized` es único globalmente, incluso si el producto está
  inactivo. Un código histórico no se reutiliza.
- Nombre, categoría y `minimum_price_cents` son obligatorios.
- Todos los precios presentes son mayores o iguales a cero.
- Si existe precio sugerido: `minimum <= suggested`.
- Si existe precio máximo: `minimum <= maximum`.
- Si existen sugerido y máximo: `suggested <= maximum`.
- `product_tags` es único por `(product_id, tag_id)`.
- `product_images.position` solo admite 1 o 2 y es único por producto. Esto limita
  estructuralmente cada producto a dos imágenes.
- El `storage_key` de una imagen es único.

### Ciclo de vida

- Un producto, categoría o tag referenciado por historia operativa se desactiva;
  no se elimina físicamente.
- Un producto inactivo puede consultarse en historia, pero no añadirse a nuevas
  compras o ventas sin reactivación administrativa.
- Cambiar el costo promedio nunca cambia automáticamente los precios del catálogo.

## Clientes

### Restricciones estructurales

- Nombre y teléfono normalizado son obligatorios para todo cliente persistido.
- DNI y dirección son opcionales.
- El teléfono es único entre clientes canónicos, es decir, aquellos sin
  `merged_into_customer_id`. Un cliente fusionado conserva su registro histórico
  sin impedir que el principal posea el teléfono resuelto.
- Un cliente no puede fusionarse consigo mismo.
- `customer_merges.duplicate_customer_id` es único: un duplicado solo se absorbe
  una vez.
- El cliente principal y el duplicado de `customer_merges` son distintos y deben
  coincidir con la relación `customers.merged_into_customer_id`.

### Reglas transaccionales

- El cliente principal debe estar activo y no puede ser, a su vez, un cliente ya
  fusionado.
- La fusión no puede formar ciclos.
- Las ventas históricas conservan su referencia original. Las consultas resuelven
  el cliente canónico sin reasignar silenciosamente las ventas.

## Ventas

### Cabecera y líneas

- Una venta pertenece a exactamente un creador.
- Una venta confirmada tiene al menos una línea.
- `sale_lines` es único por `(sale_id, product_id)`.
- Cantidad, precio unitario y subtotal de línea son no negativos donde cero tenga
  sentido comercial; la cantidad siempre es mayor que cero.
- El subtotal original de línea debe coincidir con cantidad por precio unitario.
  Esta igualdad se verifica al escribir porque puede involucrar reglas de redondeo.
- El total original y el vigente no pueden ser negativos.
- Una instantánea confirmada tiene código y nombre no vacíos, precios de referencia
  y una política de costeo conocida.
- Un precio acordado inferior al mínimo congelado exige razón y aprobador
  administrativo. En los demás casos ambos campos de excepción quedan vacíos.
- Después de confirmar, productos, cantidades, precios e instantáneas no se
  actualizan ni eliminan; los cambios se representan con operaciones posteriores.

### Cliente, vencimiento y total

- Una venta confirmada con saldo pendiente requiere un cliente.
- Una fecha de vencimiento es opcional y no puede cancelar, recargar ni modificar
  por sí sola una venta.
- Cada ajuste conserva total anterior, nuevo total, diferencia, razón, actor y
  fecha; `difference = new_total - previous_total`.
- Un ajuste no puede dejar el total vigente por debajo del neto ya cobrado que no
  haya sido reembolsado o compensado.
- `sales.current_total_cents` debe coincidir con el total original más la secuencia
  ordenada de ajustes. Esta es una proyección reconciliable.

### Pagos y correcciones

- Cada pago referencia exactamente una venta, un registrador y uno de los métodos
  iniciales: efectivo, Yape, Plin o POS.
- El importe de cada pago es mayor que cero.
- Un pago confirmado no se actualiza ni se elimina.
- La suma de pagos vigentes no puede superar el saldo disponible al confirmar un
  nuevo pago. Se protege bloqueando la venta dentro de la transacción.
- Un empleado solo puede registrar pagos en ventas creadas por él; un administrador
  puede hacerlo en cualquier venta.
- Toda corrección exige razón y actor administrativo.
- La suma compensada de un pago nunca puede superar su importe original.
- Una corrección monetaria y su movimiento financiero se confirman atómicamente.

### Entregas y reservas

- Una línea de entrega pertenece a la misma venta que su cabecera de entrega.
- Su ubicación debe coincidir con la ubicación desde la que se consume inventario.
- La cantidad acumulada entregada de una línea, descontando retornos pertinentes,
  nunca puede superar la cantidad confirmada.
- La suma de cantidades activas reservadas por línea no puede superar su cantidad
  pendiente de entrega.
- Entregar una reserva reduce existencia física y reserva en la misma cantidad;
  entregar directamente reduce existencia disponible.
- No se confirma una entrega si la ubicación carece de la cantidad física o
  reservada correspondiente.

### Devoluciones

- Toda devolución tiene una razón no vacía y aprobación administrativa.
- Una devolución confirmada tiene al menos una línea y exactamente un reembolso.
- Cantidad e importe reembolsado son mayores que cero.
- La suma devuelta por línea no puede superar la cantidad efectivamente entregada
  y todavía no devuelta.
- El reembolso acumulado no puede superar el importe comercial atribuible a las
  cantidades seleccionadas, salvo un ajuste administrativo explícito del acuerdo.
- Si `product_returns` es verdadero, la ubicación de retorno es obligatoria; si es
  falso, debe estar vacía y no se genera entrada física.
- El método de reembolso refleja la salida real y no necesita coincidir con el
  método de pago original.
- Devolución, reembolso, efecto comercial, costo y eventual retorno de inventario
  se confirman en una sola transacción.

### Cierre y cancelación

- `sale_closures.sale_id` y `sale_cancellations.sale_id` son únicos.
- Un cierre incompleto exige razón e importe condonado mayor que cero.
- Un cierre completo exige saldo cero y no condona importe.
- Una venta no puede estar cerrada y cancelada a la vez.
- La cancelación exige razón y una decisión para cada cantidad reservada o
  entregada afectada.
- Por línea cancelada: `released + returned + not_returned` no puede exceder la
  cantidad pendiente de resolver.
- Todo reembolso de cancelación tiene importe positivo y método real.
- La cancelación, liberaciones, retornos, costo y movimientos monetarios se
  confirman atómicamente.

## Inventario y costos

### Posiciones

- `locations.code` es único; los tipos iniciales son tienda y almacén.
- `inventory_positions` es único por `(product_id, location_id)`.
- Existencia física, reservada y en revisión son no negativas.
- `reserved_quantity + review_quantity <= physical_quantity`.
- El stock disponible no se persiste: se deriva de la posición.
- `product_cost_positions.product_id` es único.
- Cantidades y valores disponibles, reservados y en revisión son no negativos.
- Si una cantidad de costo es cero, su valor correspondiente también debe ser
  cero. El redondeo residual se resuelve en la última unidad de la operación.

### Movimientos y reservas

- Todo movimiento tiene producto, ubicación, tipo, actor o actor de sistema, fecha
  efectiva y una única causa válida.
- Un movimiento conserva deltas, saldo anterior y saldo resultante; la igualdad
  `resultante = anterior + delta` aplica a cada dimensión afectada.
- Los movimientos confirmados son inmutables.
- Una reserva tiene cantidad inicial positiva y cantidad activa entre cero y la
  inicial.
- Solo puede existir una reserva activa por `(sale_line_id, location_id)`; las
  reservas terminadas permanecen como historia.
- Baja, traslado o entrega nunca consumen unidades reservadas mediante una
  operación de stock disponible.
- Una transferencia exige ubicaciones distintas y produce exactamente una salida
  y una entrada de igual producto y cantidad dentro de la misma transacción.
- Un conteo o ajuste que descubra una diferencia crea movimientos auditables; no
  sobrescribe silenciosamente la posición.

### Costo

- La política inicial válida es `MOVING_AVERAGE_V1`; cada asignación y movimiento
  conserva la política utilizada.
- El costo de compra por línea y el valor que ingresa son mayores o iguales a cero.
- Al confirmar una venta, la cantidad y valor asignados salen del costo disponible.
- La cantidad reservada restante de una asignación se encuentra entre cero y su
  cantidad asignada; su valor se reduce proporcionalmente con reglas de redondeo
  deterministas.
- Entregar una unidad ya reservada no recalcula el costo congelado de la venta.
- Liberar una reserva reincorpora cantidad y valor al promedio disponible.
- Un retorno físico entra primero a revisión o directamente a disponible según la
  decisión administrativa documentada.
- Las posiciones de costo y de inventario deben reconciliar las unidades físicas
  disponibles, reservadas y en revisión, aunque el costo sea global y el stock se
  distribuya por ubicación.

## Compras y adelantos a proveedores

### Compras

- Una compra confirmada identifica un proveedor registrado o conserva un nombre
  no vacío como instantánea del proveedor ocasional, además de al menos una línea,
  autor, confirmador y fecha efectiva. Esas dos formas de identificación son
  mutuamente excluyentes.
- Cada línea tiene producto, ubicación de destino, cantidad positiva, costo
  unitario no negativo y subtotal consistente.
- Una misma compra puede repetir producto solo cuando cambia la ubicación; el par
  `(purchase_id, product_id, destination_location_id)` es único.
- El total de compra coincide con la suma de sus líneas.
- `advance_applied_cents + newly_paid_cents = total_cents`.
- Una compra de proveedor ocasional no puede utilizar adelantos.
- Confirmar compra, aplicaciones de adelanto, nuevo egreso, inventario y costo es
  atómico.

### Adelantos

- Todo adelanto tiene proveedor, importe original positivo, método, registrador y
  fecha efectiva.
- Su saldo vigente está entre cero y el importe original y se reconcilia con
  aplicaciones, devoluciones y pérdidas.
- Una aplicación es única por `(advance_id, purchase_id)` y tiene importe positivo.
- Solo se aplica un adelanto a una compra del mismo proveedor.
- La suma aplicada, devuelta y reconocida como pérdida no supera el importe del
  adelanto.
- Aplicar un adelanto no crea otra salida de efectivo; la salida ocurrió al
  registrarlo. Una devolución del proveedor sí crea una entrada.
- Reconocer una pérdida no crea un nuevo movimiento de caja porque el dinero ya
  salió; afecta los reportes de gasto mediante su causa contable.

## Finanzas y gastos

### Libro de caja

- Todo movimiento de caja tiene dirección, importe positivo, método, fecha,
  registrador e `idempotency_key` único.
- Cada movimiento tiene exactamente una referencia de origen no nula. Las demás
  referencias de origen permanecen nulas.
- La dirección debe corresponder al origen: pagos de clientes y devoluciones de
  proveedor son entradas; compras, adelantos, reembolsos y gastos son salidas; las
  correcciones usan la dirección compensatoria correspondiente.
- Una operación monetaria y su movimiento de caja se insertan en la misma
  transacción.
- Los movimientos confirmados no se editan ni eliminan. Una corrección crea otro
  movimiento enlazado y no puede compensar más que el importe pendiente.

La referencia causal explícita se aplica también a movimientos de inventario y de
costo. Se prefieren claves foráneas opcionales con una regla “exactamente una” a
un par polimórfico `origin_type/origin_id`, porque este último no permite verificar
la existencia del origen mediante integridad referencial nativa.

### Gastos independientes

- Un gasto tiene categoría, importe positivo, método, registrador y fecha efectiva.
- Descripción y comprobante son opcionales.
- Un comprobante usa una referencia de almacenamiento no vacía y neutral al
  proveedor.
- Un gasto confirmado tiene exactamente un movimiento de caja de salida.
- Una cancelación de gasto es única por gasto, exige razón y genera el movimiento
  compensatorio correspondiente cuando existe devolución real de dinero.
- Compras y adelantos no se duplican como `operating_expenses`; los reportes los
  integran por su origen financiero.

## Importación inicial

- Solo puede existir una importación con estado confirmado mediante un índice
  único parcial.
- El checksum del archivo, cantidad de filas, solicitante y fechas son obligatorios
  según el estado alcanzado.
- Confirmada implica `confirmed_at` presente y un resumen sin errores.
- Fallida implica al menos un error y ausencia de `confirmed_at`.
- La confirmación valida que no existan códigos repetidos dentro del archivo ni
  contra el catálogo.
- Productos, categorías necesarias, posiciones, movimientos y costos iniciales se
  insertan en una sola transacción. Ante cualquier error no se persiste ninguno.
- La carga inicial no crea compras, ventas ni movimientos de caja históricos.

## Política de claves foráneas y eliminación

La política predeterminada es `ON DELETE RESTRICT` y `ON UPDATE RESTRICT`. Los UUID
no cambian y la historia nunca debe quedar huérfana.

Se admite eliminación en cascada únicamente para componentes sin identidad de
negocio propia y antes de que su padre tenga historia operativa, por ejemplo:

- `profile_permissions` al eliminar un perfil nunca utilizado;
- `product_tags` e imágenes al eliminar un producto que nunca participó en una
  operación;
- líneas de un borrador descartado que todavía no generó movimientos.

Las entidades confirmadas se anulan, compensan, fusionan o desactivan. No se
eliminan físicamente usuarios autores, clientes con ventas, productos con
movimientos, ventas, pagos, devoluciones, compras, adelantos ni libros de
movimientos.

## Invariantes que requieren transacción

Las siguientes reglas no quedan suficientemente protegidas por restricciones de
una sola fila:

- confirmar una venta y reservar o retirar inventario;
- impedir pagos por encima del saldo;
- ajustar el total contra cobros y reembolsos vigentes;
- sumar cantidades entregadas, reservadas, devueltas o canceladas por línea;
- actualizar posición y libro de inventario sin divergencias;
- asignar costo y actualizar el promedio global;
- confirmar compras con adelantos, caja, inventario y costo;
- fusionar clientes sin ciclos ni referencias canónicas ambiguas;
- garantizar una sola causa financiera, física o de costo cuando intervienen
  documentos creados en la misma operación.

El próximo paso definirá límites transaccionales, orden de bloqueos, control
optimista y nivel de aislamiento para estas invariantes.

## Decisiones todavía no implícitas

Este documento no fija todavía:

- si los vocabularios se implementarán como enums nativos, tablas catálogo o
  restricciones de texto;
- nombres definitivos de constraints e índices;
- duración de sesiones o parámetros criptográficos;
- tolerancia de fechas retroactivas y necesidad de periodos contables cerrados;
- estrategia exacta de triggers o tareas de reconciliación;
- implementación Prisma de índices parciales y restricciones no representables en
  su schema.
