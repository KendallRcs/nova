# Modelo táctico de Finanzas Operativas

**Estado:** versión inicial confirmada el 2026-08-16.

Finanzas Operativas registra entradas y salidas reales de dinero. No es autoridad sobre la venta, compra, devolución o anticipo que las causa, pero conserva una referencia causal inequívoca.

## Agregado Movimiento de caja

`Movimiento de caja` es una raíz pequeña e individual. Mantiene:

- dirección: ingreso o egreso;
- monto positivo y moneda;
- método: efectivo, Yape, Plin o POS;
- fecha efectiva;
- tipo de causa;
- identificador de la operación causante;
- registrador;
- estado vigente o anulado;
- referencia al movimiento compensatorio cuando exista.

### Tipos causales iniciales

| Dirección | Tipo | Causa |
| --- | --- | --- |
| Ingreso | Cobro de venta | Pago perteneciente a una venta |
| Ingreso | Reembolso de proveedor | Recuperación de un anticipo |
| Egreso | Compra de inventario | Saldo pagado al confirmar una compra |
| Egreso | Anticipo a proveedor | Dinero entregado antes de una compra |
| Egreso | Reembolso a cliente | Devolución comercial |
| Egreso | Gasto operativo | Gasto consumido por el negocio |

### Invariantes

1. Todo movimiento posee dirección, monto positivo, método, fecha, actor y causa.
2. Una misma operación causal no crea dos veces el mismo efecto monetario; se utiliza una clave idempotente.
3. Aplicar un anticipo a una compra no genera movimiento porque no mueve dinero en ese momento.
4. Reconocer una pérdida de anticipo tampoco genera movimiento; el egreso ocurrió al registrarlo.
5. Un movimiento confirmado no se edita ni elimina.
6. Un registro incorrecto se anula con razón, responsable y fecha, conservando el original.
7. Si ocurre una devolución real de dinero, se registra un movimiento opuesto nuevo; no se simula únicamente cambiando el estado anterior.
8. Los métodos reflejan el medio realmente utilizado y no tienen que coincidir entre entrada y devolución posterior.

## Agregado Gasto operativo

`Gasto operativo` representa el consumo que explica un egreso, no el movimiento monetario mismo.

Mantiene:

- categoría;
- monto;
- fecha;
- método;
- descripción obligatoria;
- comprobante opcional;
- creador;
- movimiento de caja asociado;
- estado confirmado o anulado.

### Invariantes

1. Categoría activa, monto positivo, fecha, método y descripción son obligatorios.
2. El comprobante es opcional y se referencia mediante un valor neutral al proveedor de archivos.
3. Confirmar el gasto crea exactamente un egreso causal en la misma transacción.
4. Las compras de inventario y anticipos no se registran como gastos operativos.
5. Los gastos recurrentes se crean manualmente cada mes; no existe recurrencia automática en el MVP.
6. Anular exige administrador, razón y fecha y deja de incluir el gasto en totales vigentes.
7. La anulación del registro incorrecto anula consistentemente su movimiento de caja sin borrar ninguno de los dos.
8. Si el dinero realmente retorna al negocio, se registra además un ingreso con su propia causa.

## Agregado Categoría de gasto

`Categoría de gasto` conserva identidad, nombre normalizado y estado activo o inactivo.

- El nombre activo no se duplica.
- Una categoría usada se renombra o desactiva, no se elimina.
- Una categoría inactiva permanece en el historial, pero no admite gastos nuevos.

## Flujo de caja

El flujo de caja es una proyección por período, dirección, método y tipo causal. No es un agregado mutable ni se confunde con utilidad.

```text
flujo neto = ingresos de caja vigentes - egresos de caja vigentes
```

La compra completa aparece como costo de mercancía adquirida en Abastecimiento, mientras solo el dinero nuevo pagado aparece como egreso del momento. Así los anticipos aplicados no se duplican.

## Resultado económico

Finanzas Operativas aporta gastos y pérdidas, pero Analítica calcula el resultado combinándolos con ventas y costos históricos. Se mantienen separados:

- flujo de caja;
- ingresos comerciales;
- costo de venta;
- gastos operativos;
- bajas y pérdidas;
- margen y resultado estimado.

## Eventos de Finanzas Operativas

| Evento | Hecho representado |
| --- | --- |
| `IngresoDeCajaRegistrado` | Ocurrió una entrada real de dinero |
| `EgresoDeCajaRegistrado` | Ocurrió una salida real de dinero |
| `MovimientoDeCajaAnulado` | Un registro monetario incorrecto dejó de afectar totales vigentes |
| `MovimientoDeCajaCompensado` | Un movimiento opuesto real quedó vinculado al original |
| `GastoOperativoRegistrado` | Un consumo operativo y su egreso fueron confirmados |
| `GastoOperativoAnulado` | El gasto dejó de afectar totales sin perder historia |
| `CategoriaDeGastoCreada`, `CategoriaDeGastoRenombrada`, `CategoriaDeGastoDesactivada` | Cambió su ciclo administrativo |

Los eventos monetarios no contienen datos completos del cliente o proveedor; conservan causa e identidades necesarias.
