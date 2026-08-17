# Entidades y objetos de valor

**Estado:** versión inicial confirmada el 2026-08-16.

Este documento identifica los bloques tácticos iniciales del dominio. Todavía no define tablas, modelos Prisma, DTO HTTP ni fronteras definitivas de agregados.

## Criterio de clasificación

- Una **entidad** conserva identidad e historia aunque cambien sus atributos.
- Un **objeto de valor** se define por sus atributos, es inmutable y se reemplaza en lugar de modificarse.
- Las referencias a conceptos de otros bounded contexts se realizan mediante identidades, no compartiendo sus entidades.

## Operaciones Comerciales

### Entidades

#### Venta

Representa el acuerdo comercial completo con el cliente y conserva su identidad durante todo su ciclo de vida.

Responsabilidades candidatas:

- mantener sus líneas y el total acordado vigente;
- distinguir borrador, confirmación, finalización y cancelación;
- conservar al creador y, cuando corresponda, al cliente;
- registrar pagos que pertenezcan exclusivamente a ella;
- calcular total cobrado válido, saldo pendiente y monto condonado;
- impedir pagos superiores al saldo;
- impedir la edición directa de productos, cantidades y precios después de confirmarse;
- determinar su situación de pago sin confundirla con su situación de entrega.

#### Línea de venta

Es una parte identificable de una venta porque debe conservarse y referenciarse posteriormente en entregas, reservas, devoluciones y ajustes.

Conserva:

- identidad del producto;
- instantánea histórica de su descripción comercial y precios de referencia;
- cantidad vendida;
- precio unitario acordado;
- importes derivados de la línea.

La línea no modifica el producto del Catálogo ni el inventario. Esas acciones se coordinan mediante los respectivos contextos.

#### Pago

Es una entrada de dinero identificable, trazable y perteneciente exactamente a una venta.

Conserva monto, método, fecha efectiva, registrador y estado de vigencia. Un pago confirmado no se borra ni se sobrescribe; una corrección debe conservar la operación original y su compensación o anulación.

#### Ajuste de total acordado

Representa una modificación administrativa posterior del acuerdo económico. Tiene identidad e historia propias porque deben preservarse el total anterior, el nuevo total, la diferencia, la razón, el responsable y la fecha.

No modifica las líneas históricas ni puede dejar el total en conflicto con pagos y reembolsos vigentes.

#### Entrega

Representa un acto identificable mediante el cual una o más cantidades de la venta salen físicamente hacia el cliente. Permite que una línea se entregue en varios momentos y desde ubicaciones distintas sin sobrescribir su historia.

La entrega comercial solicita el movimiento correspondiente a Inventario, pero no altera directamente el stock.

#### Devolución

Representa una operación administrativa identificable que revierte total o parcialmente cantidades vendidas. Conserva razón, aprobador, fecha, líneas y cantidades afectadas, reembolso y decisión de retorno físico.

Una devolución no es lo mismo que un retorno: puede existir reembolso sin que el producto vuelva al negocio.

#### Línea de devolución

Identifica qué línea de venta y qué cantidad forman parte de una devolución. Su identidad permite controlar devoluciones parciales sucesivas sin superar lo efectivamente vendido y todavía no devuelto.

### Objetos de valor

#### Dinero

Cantidad monetaria expresada en una moneda. Para el MVP la moneda operativa es PEN. Encapsula precisión decimal, redondeo, suma, resta y comparación, e impide operar importes de monedas distintas.

Según el uso, un importe puede exigir valor positivo o permitir cero; esa restricción pertenece al concepto que lo utiliza y no a una variante mutable de `Dinero`.

#### Cantidad de unidades

Número entero no negativo de unidades. Las operaciones que representan una venta, pago físico, entrega, reserva o devolución exigen una cantidad mayor que cero.

#### Precio unitario acordado

Dinero acordado por una unidad en una línea de venta. Se conserva históricamente y no cambia cuando se actualizan los precios del Catálogo.

#### Instantánea comercial del producto

Copia inmutable de los datos necesarios para comprender una línea histórica, al menos código y nombre del producto. Incluye las referencias de precio vigentes utilizadas al acordar la venta, sin convertirse en el Producto del Catálogo.

#### Total acordado

Importe económico vigente del acuerdo de venta. Puede cambiar únicamente mediante un ajuste administrativo trazable; nunca por modificar silenciosamente líneas confirmadas.

#### Saldo de venta

Resultado monetario derivado del total acordado vigente, los pagos vigentes, reembolsos o compensaciones que afecten la cuenta y el monto condonado. No tiene identidad ni ciclo de vida independiente.

#### Fecha de vencimiento

Fecha opcional esperada para completar el pago. Permite determinar si un saldo está atrasado, pero no cancela la venta ni genera cargos automáticamente.

#### Acuerdo informal de pago

Condición opcional de una venta con saldo, compuesta por el vencimiento y observaciones del acuerdo cuando existan. No es un pagaré, cronograma legal ni deuda independiente.

#### Método de pago

Conjunto cerrado inicial: efectivo, Yape, Plin y POS. Describe el medio realmente utilizado por un pago o reembolso.

#### Distribución de cumplimiento

Cantidad de una línea que se entrega ahora y cantidad que queda separada. Ambas partes deben ser no negativas y su suma no puede superar la cantidad pendiente de cumplimiento.

#### Razón de operación sensible

Texto no vacío exigido para ajustes del total, cierre incompleto, cancelación, corrección de pagos y devoluciones. Expresa una justificación de negocio, no un comentario técnico.

#### Situación de pago

Valor derivado que distingue, como mínimo, sin pagos, pago parcial, pagada y cerrada con saldo condonado. `Atrasada` es un indicador adicional porque depende del saldo, vencimiento y fecha actual; no requiere una mutación automática.

#### Situación de entrega

Valor derivado independiente de la situación de pago. Distingue, como mínimo, pendiente, parcial y completa.

#### Indicadores de seguimiento

Valores derivados como `atrasada` o `con reserva activa`. Complementan los estados de cobro y entrega sin reemplazarlos ni provocar transiciones automáticas.

### Identidades referenciadas

Operaciones Comerciales utiliza objetos de valor tipados para impedir mezclar referencias:

- `VentaId`, `LineaVentaId`, `PagoId`, `EntregaId`, `DevolucionId` y `AjusteTotalId`;
- `ProductoId` proveniente conceptualmente de Catálogo;
- `ClienteId` proveniente conceptualmente de Clientes;
- `UbicacionId` proveniente conceptualmente de Inventario;
- `UsuarioId` proveniente conceptualmente de Identidad y Acceso.

El formato técnico de estas identidades se decidirá en la arquitectura de datos. En el dominio son valores inmutables y opacos.

## Conceptos deliberadamente no modelados como entidades

- **Cuenta por cobrar:** es una proyección de saldos de ventas de un cliente.
- **Saldo pendiente:** es un valor derivado de una venta, no una obligación separada.
- **Separación:** es una modalidad o situación comercial de la venta y origina reservas de inventario; por ahora no requiere identidad independiente.
- **Reserva de inventario:** pertenece al contexto Inventario, aunque sea solicitada por una venta.
- **Producto y Cliente:** son entidades de otros contextos y solo se referencian por identidad.
- **Pagaré:** está fuera del alcance de Nova.

## Preguntas resueltas por el diseño inicial de agregados

- `Pago`, `Entrega`, `Ajuste de total` y `Devolución` permanecen inicialmente dentro del agregado `Venta` para proteger saldo, cantidades e historia con consistencia fuerte.
- Inventario y movimientos de caja permanecen fuera del agregado y son coordinados por la capa de aplicación.
- Totales monetarios derivados y situaciones se calculan desde hechos vigentes; la persistencia podrá mantener proyecciones optimizadas sin convertirlas en otra fuente de verdad.

Estas fronteras se reevaluarán si el volumen de pagos, entregas o devoluciones por venta crece hasta provocar agregados grandes o conflictos frecuentes.
