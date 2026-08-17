# Bounded contexts de Nova

**Estado:** versión inicial confirmada el 2026-08-16.

Los bounded contexts son límites de lenguaje y autoridad del modelo dentro del monolito modular. No representan microservicios ni obligan a utilizar bases de datos separadas.

## Operaciones Comerciales

**Clasificación:** dominio central.

Es dueño de:

- ventas y líneas de venta;
- precios y total acordados históricamente;
- separaciones comerciales;
- entregas solicitadas;
- pagos asociados a una venta;
- acuerdos informales de pago;
- saldo y vencimiento;
- cierre incompleto y monto condonado;
- anulaciones y devoluciones comerciales.

### Lenguaje propio

`Venta`, `Línea de venta`, `Separación`, `Pago`, `Saldo pendiente`, `Acuerdo de pago`, `Cuenta por cobrar`, `Cierre incompleto` y `Devolución`.

### Regla de frontera confirmada

Cada pago pertenece exactamente a una venta. Nova no acepta pagos generales de cliente pendientes de distribución ni reparte un pago entre varias ventas.

La cuenta por cobrar es una vista consolidada de saldos de ventas, no una deuda independiente ni un agregado adicional.

## Inventario

**Clasificación:** soporte crítico.

Es dueño de:

- ubicaciones;
- existencia física;
- unidades reservadas y disponibles;
- movimientos de apertura, ingreso, reserva, liberación, entrega, retorno, traslado, baja y ajuste;
- decisión sobre si una cantidad puede reservarse, entregarse, trasladarse o retirarse.

Para este contexto, una reserva es un bloqueo de cantidad física. No contiene precios, pagos ni deuda del cliente.

## Catálogo

**Clasificación:** soporte.

Es dueño de:

- identidad y código vigente del producto;
- nombre y descripción;
- categorías y etiquetas;
- imágenes;
- precios de referencia vigentes;
- activación o desactivación comercial.

Otros contextos referencian el producto por identidad y conservan las copias históricas que necesiten. Una venta confirmada no recalcula sus importes cuando cambia el catálogo.

## Clientes

**Clasificación:** soporte.

Es dueño de:

- identidad del cliente;
- nombre y teléfono normalizado;
- DNI y dirección opcionales;
- activación y fusión de duplicados;
- tratamiento de sus datos personales.

No es dueño de ventas o saldos. El historial y la deuda consolidada son consultas que combinan su identidad con información de Operaciones Comerciales.

## Abastecimiento

**Clasificación:** soporte.

Es dueño de:

- proveedores registrados u ocasionales;
- compras y líneas de compra;
- costos de adquisición;
- anticipos a proveedores;
- aplicaciones, reembolsos y pérdidas de anticipos;
- confirmación de la adquisición de mercancía.

Solicita ingresos físicos a Inventario y efectos monetarios a Finanzas Operativas, pero no modifica directamente sus modelos.

## Finanzas Operativas

**Clasificación:** soporte.

Es dueño de:

- movimientos reales de entrada y salida de dinero;
- método de pago;
- gastos operativos y categorías;
- efecto de cobros, compras, anticipos y reembolsos sobre caja;
- flujo de caja por período.

No es dueño del acuerdo comercial, la compra o la devolución que origina un movimiento. Conserva su referencia causal.

## Identidad y Acceso

**Clasificación:** genérico con autorización de soporte.

Es dueño de:

- cuentas de colaboradores;
- nombres de usuario y credenciales;
- sesiones y restablecimientos;
- roles iniciales y asignación de permisos.

Proporciona la identidad del actor. Cada contexto protege además sus propias reglas de autorización de negocio.

## Analítica

**Clasificación:** soporte de lectura.

Es dueño de modelos de lectura para:

- ventas, cobros y saldos por período;
- cuentas por cobrar;
- flujo de caja y resultado estimado;
- productos vendidos y rentabilidad;
- disponibilidad de inventario;
- actividad por usuario.

No modifica operaciones fuente ni se convierte en autoridad de totales transaccionales.

## Límites deliberadamente no creados

- **Cobros separado de Ventas:** descartado por ahora porque cada pago pertenece a una venta y actualiza su saldo.
- **Devoluciones independiente:** permanece dentro de Operaciones Comerciales; coordina reembolso y retorno mediante otros contextos.
- **Cuenta por cobrar independiente:** es una proyección consolidada, no una obligación distinta de las ventas.
- **Reportes como dominio transaccional:** Analítica consume información; no origina operaciones.
- **Infraestructura como contexto:** Prisma, PostgreSQL, Cloudinary, HTTP y Excel son adaptadores o herramientas, no dominios del negocio.

## Regla de evolución

Si en el futuro un pago puede aplicarse a varias ventas, quedar sin asignar o renegociarse independientemente, se reevaluará la extracción de un contexto propio de Cobranza.
