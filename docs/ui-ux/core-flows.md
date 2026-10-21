# Flujos principales

**Estado:** primera priorización para wireframes y desarrollo frontend.

## Convenciones de flujo

- Cada paso muestra título, propósito y acción principal.
- Antes de una mutación con dinero o inventario se presenta un resumen revisable.
- Después de confirmar se muestra el resultado y la siguiente acción posible.
- Volver no repite una operación ya confirmada.
- Una respuesta conflictiva actualiza el estado visible antes de permitir reintentar.
- `Idempotency-Key` es una garantía técnica; la persona ve `Procesando`,
  `Confirmado` o una recuperación clara, nunca el identificador.

## 1. Primer acceso

```text
Iniciar sesión
   ↓ credencial temporal
Crear contraseña personal
   ↓ sesión temporal revocada
Iniciar sesión nuevamente
   ↓
Inicio correspondiente al perfil
```

- El error de credenciales no revela si el usuario existe.
- El límite temporal informa cuánto esperar sin hablar de bloqueo de cuenta.
- Una sesión activa lleva directamente al Inicio.

## 2. Consultar un producto

```text
Inventario → Buscar por código o nombre → Resultado → Detalle por ubicación
```

La fila muestra código, nombre, precio de venta y disponibilidad total. El detalle
separa Tienda y Almacén, distingue disponible, reservado y revisión, y ofrece el
historial de movimientos. Para el empleado nunca solicita ni reserva espacio para
costos; para el administrador enlaza la información financiera desde Reportes.

Estados esenciales: búsqueda inicial, sin coincidencias, producto encontrado sin
stock, varias coincidencias, imagen ausente y error recuperable.

## 3. Crear y confirmar una venta

```text
Nueva venta
   ↓
Agregar productos y cantidades
   ↓
Definir por línea: entregar, reservar o dejar pendiente
   ↓
Identificar cliente cuando quedará saldo
   ↓
Registrar pago inicial opcional
   ↓
Revisar acuerdo, stock y total
   ↓
Confirmar venta
   ↓
Resultado: cobro, entrega, reserva y saldo
```

Decisiones UX:

- El borrador se guarda antes de producir efectos reales.
- Cada línea mantiene visible ubicación, cantidad, precio acordado y distribución.
- Un precio bajo el mínimo explica que requiere aprobación administrativa y razón.
- Si falta cliente para una venta con saldo, el flujo ofrece buscar o crear uno sin
  perder el borrador.
- El resumen final distingue claramente `Total`, `Pagado ahora`, `Saldo` y
  `Productos que se lleva`.
- La confirmación exitosa ofrece `Ver venta`, `Registrar otro pago` cuando aplica e
  `Iniciar otra venta`.

## 4. Dar seguimiento a una deuda

```text
Clientes o Ventas → Filtrar pendientes/vencidas → Abrir venta
   ├── Registrar pago
   ├── Entregar reserva
   └── Administrador: ajustar, finalizar o cancelar
```

La cuenta del cliente muestra total original, total vigente, cobro neto y saldo por
venta. `Atrasada` es una etiqueta visual, no una amenaza de cancelación automática.
El historial separa quién creó la venta de quién registró cada pago.

Al registrar un pago se elige monto y método real. Un monto superior al saldo no se
recorta silenciosamente: se explica que primero debe ajustarse el acuerdo.

## 5. Entregar una reserva

```text
Venta → Productos reservados → Elegir cantidades → Revisar ubicación → Entregar
```

El flujo acepta entrega parcial y muestra qué permanece reservado. No exige registrar
un pago en el mismo momento. Si otra operación consumió la reserva, actualiza las
cantidades y pide revisar, sin duplicar la entrega.

## 6. Corregir o finalizar una venta

Las operaciones administrativas aparecen separadas de las acciones cotidianas:

- ajustar total;
- corregir pago;
- aprobar devolución;
- finalizar con saldo condonado;
- cancelar venta.

Cada flujo exige razón, resume efectos comerciales, financieros y físicos y utiliza
una confirmación específica. Cancelar nunca presupone el reembolso: el administrador
declara el importe real y el tratamiento de cada producto.

## 7. Administrar inventario

```text
Inventario → Producto y ubicación → Elegir operación
   ├── Trasladar
   ├── Ajustar conteo
   ├── Dar de baja
   └── Resolver revisión
```

- Trasladar presenta origen, destino, existencia disponible y cantidad resultante.
- Ajustar compara `Sistema`, `Conteo físico` y `Diferencia` antes de confirmar.
- Dar de baja exige categoría y razón; no se presenta como eliminar producto.
- Resolver revisión obliga a elegir `Disponible para venta` o `Dar de baja`.
- Un conflicto de versión vuelve a consultar la posición y conserva la intención
  para que el administrador decida de nuevo.

## 8. Registrar abastecimiento y gastos

Compras, anticipos y gastos usan flujos distintos aunque todos puedan mover caja.

- **Anticipo:** proveedor, importe, método, propósito opcional y saldo posterior.
- **Compra:** proveedor, líneas, destino, costos, anticipos aplicados y pago nuevo.
- **Gasto:** categoría, importe, método, fecha, descripción y comprobante opcional.

El resumen de compra advierte cambios de costo como sugerencia de revisar precios;
no ofrece aplicar cambios automáticos. El comprobante se carga después de crear el
gasto y explica formatos, peso y acceso protegido.

## 9. Carga inicial

```text
Descargar plantilla → Completar fuera de Nova → Subir → Corregir o previsualizar
   ↓ sin errores
Confirmar única carga → Ver resumen creado
```

La validación separa errores por fila y columna. La confirmación explica que es una
operación única y atómica. Si existe cualquier error no se habilita confirmar ni se
crea información parcial.

## Estados transversales que requieren wireframe

Para cada módulo se diseñarán, como mínimo:

- carga inicial mediante skeleton;
- contenido normal mínimo, típico y extenso;
- vacío de primera vez y vacío por filtros;
- error de validación local;
- problema de negocio `422`;
- conflicto por cambio concurrente `409`;
- sesión vencida o revocada;
- permiso insuficiente;
- servicio opcional de archivos no disponible;
- operación en proceso, confirmada y reintentada sin duplicación;
- conectividad interrumpida antes y después de enviar una mutación.

## Siguiente nivel de detalle

Los primeros wireframes cubrirán Primer acceso, Inicio por perfil, Consulta de
producto, Nueva venta y Seguimiento de deuda. Los demás flujos reutilizarán sus
patrones después de validar navegación, formularios, resumen y rastro operativo.
