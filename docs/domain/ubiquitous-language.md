# Lenguaje ubicuo

**Estado:** versión inicial confirmada el 2026-08-08; continuará evolucionando con el modelo.

El significado de un término pertenece a un contexto. No se utilizarán sinónimos indistintamente si representan operaciones diferentes.

| Término | Significado | Contexto | Evitar confundir con |
| --- | --- | --- | --- |
| Producto | Referencia comercial identificada mediante un código manual único | Catálogo | Unidad física |
| Unidad | Ejemplar físico de un producto; no posee identidad o número de serie propio | Inventario | Producto del catálogo |
| Stock físico | Unidades que se encuentran físicamente en una ubicación | Inventario | Stock disponible |
| Stock reservado | Unidades físicas comprometidas con una separación | Inventario | Unidades entregadas |
| Stock disponible | Unidades físicas que todavía pueden ofrecerse | Inventario | Stock físico total |
| Separación | Acuerdo comercial en el que el cliente deja un pago y todavía no recibe una o más unidades | Ventas | Reserva de inventario |
| Reserva de inventario | Bloqueo de unidades físicas como consecuencia de una separación | Inventario | Venta con saldo pendiente |
| Venta | Acuerdo comercial con uno o más productos y un total acordado | Ventas | Pago o entrega |
| Línea de venta | Producto, cantidad, precio y cumplimiento dentro de una venta | Ventas | Producto del catálogo |
| Venta con saldo pendiente | Venta cuyo total acordado todavía no fue cubierto completamente | Ventas y cobros | Separación |
| Acuerdo de pago | Condición informal acordada con un cliente de confianza para pagar una venta en uno o más momentos | Ventas y cobros | Pagaré legal |
| Entrega | Salida física de unidades hacia el cliente | Ventas e inventario | Pago |
| Pago | Entrada de dinero vinculada con una venta | Cobros | Total acordado |
| Total acordado | Valor vigente que el negocio y el cliente acuerdan para una venta | Ventas | Total cobrado |
| Saldo pendiente | Importe vigente que todavía se espera cobrar de una venta | Cobros | Monto condonado |
| Cuenta por cobrar | Posición consolidada de los saldos que un cliente todavía debe | Cobros | Una venta individual |
| Monto condonado | Parte del saldo que un administrador decide no cobrar | Cobros | Pago o descuento inicial |
| Completar pago | Cubrir totalmente el saldo vigente de una venta | Cobros | Anular venta |
| Anular venta | Dejar sin efecto una venta mediante una operación trazable | Ventas | Completar pago |
| Cerrar incompleta | Finalizar una venta aceptando que no se cobrará todo el saldo | Ventas y cobros | Venta pagada |
| Devolución | Operación comercial aprobada que revierte total o parcialmente una venta | Devoluciones | Retorno físico |
| Reembolso | Dinero entregado al cliente como parte de una devolución | Devoluciones y caja | Retorno físico |
| Retorno | Producto que vuelve físicamente al negocio | Devoluciones e inventario | Reembolso |
| Compra | Adquisición confirmada de mercancía a un proveedor | Compras | Gasto operativo |
| Ingreso de inventario | Movimiento que incorpora físicamente unidades a una ubicación | Inventario | Compra o egreso |
| Reposición | Propósito de recuperar stock mediante una compra | Compras | Tipo distinto de operación financiera |
| Anticipo a proveedor | Dinero entregado antes de concretar una o más compras | Compras y caja | Gasto operativo |
| Ingreso de caja | Entrada real de dinero al negocio | Caja y reportes | Venta acordada |
| Egreso de caja | Salida real de dinero del negocio | Caja y reportes | Gasto o costo de venta |
| Gasto operativo | Consumo relacionado con operar el negocio | Gastos | Compra de inventario |
| Margen esperado | Diferencia estimada entre el total acordado y el costo atribuible a los productos | Reportes | Dinero cobrado |
| Margen realizado | Resultado reconocido considerando cobros, costos, devoluciones y ajustes | Reportes | Flujo de caja |
| Resultado del período | Margen menos gastos y pérdidas del período | Reportes | Saldo de caja |
| Baja de inventario | Retiro trazable de unidades no vendibles por una causa conocida | Inventario | Eliminación de un producto |
| Ajuste de inventario | Corrección de una diferencia encontrada sin afirmar una causa inexistente | Inventario | Baja con causa conocida |

## Término excluido

### Pagaré

Nova no modela pagarés ni títulos valores. Los acuerdos con clientes de confianza son acuerdos informales de pago asociados con una venta con saldo pendiente. El sistema controla venta, pagos, vencimiento informativo, saldo y cuenta por cobrar, pero no atribuye efectos legales de pagaré a esos registros.
