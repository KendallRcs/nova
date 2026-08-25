# Concurrencia y límites transaccionales

**Estado:** Versión inicial confirmada el 2026-08-24.

Este documento define cómo Nova preservará las invariantes cuando sus seis
usuarios trabajen al mismo tiempo. La estrategia asume un único PostgreSQL para el
backend modular del MVP; no introduce transacciones distribuidas, sagas ni un
broker.

## Objetivos

- Ninguna operación crítica queda aplicada parcialmente.
- Dos usuarios no pueden vender, reservar, entregar ni dar de baja las mismas
  unidades simultáneamente.
- Dos cobros concurrentes no pueden superar el saldo de una venta.
- Las posiciones actuales y sus libros históricos cambian en el mismo commit.
- El núcleo hexagonal no depende de Prisma, PostgreSQL ni de tipos de transacción.
- Un conflicto esperado se informa como resultado recuperable, no como corrupción
  silenciosa ni como error HTTP dentro del dominio.

## Estrategia recomendada

Nova usa una estrategia híbrida:

1. `READ COMMITTED` como nivel de aislamiento predeterminado.
2. Bloqueo pesimista de las filas que representan recursos monetarios, físicos o
   de costo que serán consumidos.
3. Versiones optimistas para impedir que una edición basada en datos obsoletos
   sobrescriba cambios recientes.
4. Restricciones únicas y `CHECK` como última defensa ante carreras.
5. Reintentos técnicos breves y acotados solo para abortos transitorios seguros.

`READ COMMITTED` por sí solo no protege sumas entre filas. Por eso un pago bloquea
la cabecera de la venta antes de recalcular su saldo, y una salida de inventario
bloquea sus posiciones antes de validar disponibilidad. No se usa `SERIALIZABLE`
globalmente porque añadiría abortos y reintentos a lecturas y escrituras simples
sin reemplazar la necesidad de diseñar los recursos que cada operación consume.

## Frontera hexagonal de la transacción

La capacidad de negocio define el cambio completo, pero la transacción técnica es
responsabilidad exterior al núcleo:

```text
Controlador NestJS
        │
        ▼
Puerto conductor de la capacidad
        │
        ▼
Decorador/composición transaccional ── abre PostgreSQL transaction
        │
        ├── crea repositorios Prisma ligados a esa transacción
        ├── ejecuta la política de aplicación y dominio
        ├── commit o rollback
        └── después del commit despacha eventos internos
```

- El dominio recibe entidades, valores y resultados; nunca un cliente Prisma.
- La aplicación usa repositorios y capacidades con lenguaje de negocio; no llama
  `begin`, `commit`, `rollback` ni selecciona un nivel SQL.
- El adaptador transaccional implementa el mismo puerto conductor que la capacidad.
- Los repositorios ligados a una transacción no pueden confirmar por separado.
- NestJS compone el decorador, Prisma y los repositorios en el borde de la
  aplicación.
- Los fakes de aplicación simulan atomicidad a nivel de comportamiento; las
  pruebas de integración demuestran bloqueos y rollback con PostgreSQL real.

No se crea un `UnitOfWork` genérico que exponga todos los repositorios ni un puerto
`DatabaseTransaction` dentro del dominio. Si durante la implementación varias
capacidades necesitan reutilizar la misma envoltura, se puede crear un mecanismo
técnico interno del adaptador sin convertirlo en lenguaje del negocio.

## Tipos de protección

### Bloqueo pesimista

Se usa `SELECT ... FOR UPDATE` —oculto dentro del adaptador PostgreSQL— cuando una
operación decide basándose en un saldo o cantidad que inmediatamente consumirá:

- cabecera de venta al pagar, ajustar, devolver, cerrar o cancelar;
- posiciones de inventario al reservar, entregar, trasladar, dar de baja o contar;
- posición global de costo al comprar, vender, liberar, retornar o dar de baja;
- adelanto al aplicarlo, devolverlo o reconocer una pérdida;
- clientes involucrados en una fusión.

La fila se vuelve a leer después de adquirir el bloqueo. Nunca se valida con una
copia obtenida antes y luego se escribe suponiendo que sigue vigente.

### Control optimista

Las relaciones mutables con riesgo de edición obsoleta conservan `version`:

- ventas;
- posiciones de inventario;
- posiciones globales de costo;
- adelantos a proveedor;
- cuentas de usuario y su `security_version`.

Una escritura que nace de una versión conocida actualiza mediante una condición
equivalente a `WHERE id = ? AND version = ?` e incrementa la versión. Si no afecta
una fila, devuelve un conflicto de concurrencia y el caso de uso no reintenta una
decisión humana automáticamente.

En operaciones que ya poseen un bloqueo pesimista, la versión también aumenta.
Esto permite detectar que una pantalla quedó obsoleta aunque la escritura interna
haya sido serializada correctamente.

### Restricciones como última defensa

No se bloquea una tabla completa para crear códigos, usernames o teléfonos. Se
consulta para ofrecer una respuesta amable y la restricción única decide la
carrera final. El adaptador traduce la violación conocida a un resultado como
`codigo-ya-utilizado`, `telefono-ya-utilizado` o `username-ya-utilizado`.

## Orden global de bloqueos

Cuando una transacción necesita varias filas, las bloquea en este orden:

1. venta, si la operación pertenece a una venta;
2. clientes, ordenados por UUID;
3. adelantos, ordenados por UUID;
4. posiciones de inventario, ordenadas por `(product_id, location_id)`;
5. posiciones globales de costo, ordenadas por `product_id`;
6. filas históricas o movimientos que solo serán insertados.

Una operación omite niveles que no necesita, pero nunca invierte los restantes.
Antes de bloquear una colección se normalizan y ordenan sus identificadores. Una
transferencia, por ejemplo, no bloquea primero “origen” y luego “destino”; bloquea
ambas posiciones en el orden global, independientemente de su función.

Los adaptadores de repositorio no adquieren bloqueos sorpresa durante un `save`.
La variante de carga requerida por la capacidad expresa que el recurso será
modificado, aunque su contrato continúe usando lenguaje del negocio y no SQL.

## Matriz de operaciones atómicas

| Capacidad | Filas bloqueadas | Efectos dentro del mismo commit |
| --- | --- | --- |
| Confirmar venta | venta; posiciones de inventario y costo por producto | venta y líneas confirmadas, costo congelado, reservas o salidas, movimientos, pago inicial y caja si existe |
| Registrar pago | venta | pago, nuevo saldo derivable, movimiento de caja e historial del actor |
| Corregir pago | venta | corrección, compensación del cobro y movimiento de caja correspondiente |
| Ajustar total | venta | ajuste, total vigente y versión; se valida contra cobros netos |
| Entregar producto | venta; posiciones físicas implicadas | entrega, consumo físico/reserva y movimientos; el costo congelado no cambia |
| Aprobar devolución | venta; posiciones físicas y costo si retorna | devolución, reembolso, caja, retorno/revisión, costo e historial |
| Cerrar venta | venta | cierre completo o incompleto, importe condonado y versión |
| Cancelar venta | venta; posiciones físicas y costo implicadas | cancelación, liberaciones/retornos, reembolsos, caja, costo y movimientos |
| Trasladar stock | posiciones de origen y destino | transferencia, salida, entrada y ambas posiciones |
| Dar de baja | posición física y costo | baja, movimiento físico, pérdida de costo y auditoría |
| Ajustar por conteo | posición física y costo cuando corresponda | ajuste, posición, movimiento y razón administrativa |
| Confirmar compra | adelantos usados; posiciones físicas y costo por producto | compra, aplicaciones, nuevo egreso, caja, inventario, costo y sugerencias de revisión |
| Registrar adelanto | — o proveedor si se necesita validar vigencia | adelanto, saldo inicial y salida de caja |
| Aplicar/devolver/perder adelanto | adelanto; compra si corresponde | aplicación o cierre de saldo, entrada de caja solo si hay devolución |
| Registrar/cancelar gasto | gasto cuando ya existe | gasto o compensación y movimiento de caja |
| Fusionar clientes | ambos clientes ordenados | relación de fusión, estado del duplicado y datos resueltos |
| Confirmar importación inicial | exclusión global de importación; posiciones y costos ordenados | catálogo completo, aperturas físicas y de costo o ningún cambio |

“Saldo derivable” no implica una columna de deuda actualizada aisladamente. Todos
los hechos necesarios para recalcularlo quedan confirmados juntos.

## Secuencias críticas

### Confirmar una venta

1. Bloquear la venta en borrador y verificar su versión.
2. Validar líneas, cliente cuando quedará saldo, permisos y precio excepcional.
3. Ordenar y bloquear posiciones físicas y posiciones globales de costo.
4. Releer disponibilidad y costo después del bloqueo.
5. Aplicar reservas o salidas físicas y congelar el costo de cada línea.
6. Registrar pago inicial y movimiento de caja, si existe.
7. Insertar libros de inventario/costo, confirmar venta e incrementar versiones.
8. Confirmar la transacción.
9. Despachar `VentaConfirmada` y eventos derivados únicamente después del commit.

Si falla cualquier paso anterior al commit, no existe venta confirmada, reserva,
salida, costo ni cobro parcial.

### Registrar un pago

1. Bloquear la venta.
2. Recalcular pagos, compensaciones, reembolsos, ajustes y monto condonado vigentes.
3. Validar autorización y que el importe no supere el saldo actual.
4. Insertar pago y movimiento de caja con la misma clave idempotente.
5. Incrementar la versión de la venta y confirmar.

Dos pagos concurrentes se serializan sobre la venta. El segundo recalcula el saldo
después de que el primero confirme y se rechaza si ya no cabe.

### Confirmar una compra

1. Validar el borrador y ordenar los recursos involucrados.
2. Bloquear adelantos por UUID y verificar proveedor y saldo.
3. Bloquear posiciones físicas por `(product_id, location_id)`.
4. Bloquear posiciones de costo por producto.
5. Recalcular aplicaciones, totales y costo promedio con los valores bloqueados.
6. Insertar compra, líneas, aplicaciones, egreso restante y todos los movimientos.
7. Actualizar posiciones y versiones; confirmar.
8. Después del commit, emitir sugerencias no vinculantes de revisión de precio.

### Aprobar una devolución

1. Bloquear la venta y releer entregas, devoluciones y pago neto.
2. Validar cantidad aún retornable y calcular pago atribuible proporcional.
3. Si hay retorno, bloquear posiciones físicas y de costo ordenadas.
4. Crear devolución, líneas, reembolso y salida de caja.
5. Ingresar las unidades a revisión o disponible según la decisión; una devolución
   sin retorno no modifica inventario ni reincorpora costo.
6. Confirmar todos los efectos e incrementar versiones.

## Idempotencia

Toda orden monetaria o de inventario que el usuario pueda reenviar recibe un
`operation_id` UUID generado antes de ejecutar la capacidad. La base garantiza su
unicidad en el documento principal o movimiento causal.

- Repetir exactamente la misma orden devuelve el resultado ya confirmado.
- Reutilizar el mismo `operation_id` con datos diferentes se rechaza como conflicto.
- Un timeout del cliente no autoriza a crear un segundo pago, devolución, compra,
  adelanto, gasto, traslado, baja o confirmación de venta.
- La clave de `cash_movements` se deriva o enlaza con la operación para que el
  mismo hecho no produzca dos movimientos financieros.

La idempotencia no reemplaza el bloqueo: evita duplicar la misma solicitud; el
bloqueo resuelve solicitudes distintas que compiten por el mismo recurso.

## Reintentos y errores

El adaptador transaccional puede reintentar automáticamente un máximo pequeño y
configurable de veces cuando PostgreSQL informa un deadlock o aborto transitorio
y la orden posee `operation_id`. Cada intento crea una transacción y repositorios
nuevos, con espera breve y aleatoria.

No se reintentan automáticamente:

- violaciones de reglas o de unicidad esperadas;
- conflictos de versión causados por una decisión humana obsoleta;
- stock, saldo o costo insuficiente tras releer;
- fallos de validación;
- operaciones sin garantía idempotente.

Después de agotar reintentos, la aplicación devuelve un resultado técnico
recuperable equivalente a “operación temporalmente ocupada”. El adaptador HTTP lo
traduce al protocolo; el dominio no conoce códigos HTTP ni códigos SQL.

## Efectos externos y eventos

- No se mantiene una transacción PostgreSQL abierta durante una carga a Cloudinary,
  envío de red u otro efecto externo lento.
- Los archivos se preparan antes y su referencia neutral se confirma después; un
  fallo de base de datos deja un recurso huérfano recuperable mediante limpieza,
  no una transacción distribuida.
- Los eventos de dominio se acumulan durante el caso de uso y se despachan en
  proceso después del commit.
- Un listener de eventos no completa inventario, caja o costo críticos: esos
  efectos ya pertenecen a la transacción original.
- El MVP no requiere outbox. Si aparece un consumidor externo cuya entrega deba
  garantizarse, se evaluará una outbox transaccional mediante un ADR nuevo.
- Los eventos descartados por rollback nunca se publican.

## Lecturas y dashboards

Las consultas de solo lectura no bloquean filas de negocio ni cargan agregados
para construir dashboards. Usan consultas optimizadas CQRS-lite contra datos
confirmados.

Una consulta compuesta bajo `READ COMMITTED` puede observar commits ocurridos
entre sentencias. Para una pantalla ordinaria es aceptable; un reporte que necesite
una fotografía interna consistente ejecuta todas sus consultas en una transacción
de solo lectura `REPEATABLE READ`. Esto no cambia la fuente de verdad ni crea una
proyección transaccional nueva.

## Importación inicial

La importación de aproximadamente 300 productos se ejecuta en una única
transacción después de validar completamente la plantilla fuera de ella. Antes de
confirmar:

- se adquiere un bloqueo de exclusión específico de la importación inicial;
- se verifica nuevamente que no exista otra importación confirmada;
- se ordenan productos y ubicaciones antes de crear posiciones;
- se insertan catálogo, stock y costo de apertura como una unidad;
- cualquier error provoca rollback total.

El archivo Excel se analiza antes de abrir la transacción para no mantener
bloqueos mientras se procesa I/O o se prepara la vista previa.

## Pruebas de concurrencia requeridas

Los fakes prueban la política del caso de uso, pero no pueden demostrar semántica
real de bloqueo. PostgreSQL real debe cubrir, como mínimo:

- dos pagos simultáneos donde juntos superarían el saldo;
- dos ventas o reservas que compiten por la última unidad;
- entrega y cancelación simultáneas de la misma reserva;
- baja y venta simultáneas del mismo stock;
- dos compras concurrentes que actualizan el costo promedio del mismo producto;
- dos aplicaciones que intentan consumir el mismo saldo de adelanto;
- devolución concurrente duplicada sobre la misma cantidad;
- transferencia inversa simultánea sin deadlock permanente;
- dos confirmaciones de importación inicial;
- rollback completo al fallar caja, inventario o costo a mitad de una operación;
- idempotencia ante reenvío después de un timeout simulado;
- traducción estable de conflicto de versión, unicidad, deadlock y timeout.

## Observabilidad mínima

Los adaptadores registran métricas y trazas técnicas sin datos personales
innecesarios:

- duración de transacciones;
- tiempo esperando bloqueos;
- cantidad de reintentos, deadlocks y conflictos optimistas;
- rollbacks por tipo de capacidad;
- divergencias detectadas por reconciliación.

El dominio no importa un logger ni recibe trace IDs. Los eventos e historiales de
negocio conservan actor, razón y fecha porque eso sí forma parte del comportamiento.

## Decisiones todavía no implícitas

Este documento no fija aún:

- valor exacto de timeout de transacción o espera de bloqueo;
- cantidad exacta de reintentos y fórmula de espera;
- API concreta de Prisma para ejecutar cada bloqueo;
- estructura física del decorador transaccional y repositorios ligados;
- mecanismo de limpieza de archivos huérfanos;
- cuándo un reporte necesitará `REPEATABLE READ`;
- adopción futura de outbox, colas, sagas o múltiples bases de datos.

Estos parámetros se establecerán al implementar y medir, sin cambiar la estrategia
de consistencia aquí descrita.

## Decisión arquitectónica relacionada

- [ADR-0006: control de concurrencia híbrido en el borde hexagonal](../adr/0006-use-hybrid-concurrency-control.md).
