# Backlog funcional — Nova

> Documento vivo. Debe actualizarse cuando cambie una regla de negocio o se descubra un nuevo caso de uso.

**Estado del levantamiento funcional:** Fase 2 cerrada el 2026-08-07. El alcance permanece vivo y cualquier cambio posterior debe actualizar historias, reglas e historial.

## Propósito

Este documento registra las historias de usuario descubiertas para el sistema de gestión de la juguetería. Las historias describen valor para el negocio; las decisiones puramente técnicas deberán registrarse como tareas de ingeniería o ADR, no como historias de usuario.

## Convenciones

- Formato de historia: Mike Cohn (`Como / quiero / para`).
- Criterios de aceptación: escenarios Gherkin con un solo `Cuando` y un solo `Entonces` por escenario.
- Estados: `Confirmada`, `Borrador` o `Fuera del MVP`.
- Los criterios describen comportamiento observable y no una implementación técnica.
- Los importes históricos no se recalculan cuando cambia el catálogo.
- Las operaciones financieras o de inventario confirmadas se anulan o compensan; no se eliminan silenciosamente.

## Actores

- **Administrador:** acceso operativo y financiero completo; autoriza operaciones sensibles.
- **Empleado:** consulta catálogo y stock, crea ventas y opera únicamente las ventas que creó, salvo las consultas de clientes permitidas.
- **Dueño/administrador:** consumidor principal de indicadores de negocio. En el MVP utiliza el rol Administrador.

## Índice del backlog

| Área | Historias | Estado general |
| --- | ---: | --- |
| Autenticación y acceso | AUTH-001 a AUTH-005 | Confirmada |
| Productos y precios | PROD-001 a PROD-007 | Confirmada |
| Inventario | INV-001 a INV-007 | Confirmada |
| Compras y anticipos | PUR-001 a PUR-005 | Confirmada |
| Clientes | CUS-001 a CUS-004 | Confirmada |
| Ventas, reservas y entregas | SAL-001 a SAL-009 | Confirmada |
| Pagos, cierres y cancelaciones | PAY-001 a PAY-005 | Confirmada |
| Devoluciones | RET-001 a RET-003 | Confirmada |
| Gastos | EXP-001 a EXP-003 | Confirmada |
| Dashboard | DASH-001 a DASH-004 | Confirmada |
| Usuarios y permisos | IAM-001 a IAM-002 | Confirmada para el MVP |
| Importación inicial | DATA-001 | Confirmada |

---

## Autenticación y acceso

### User Story AUTH-001 — Acceder de forma segura al sistema

- **Estado:** Confirmada
- **Como** administrador o empleado
- **quiero** iniciar sesión con mis propias credenciales
- **para** acceder únicamente a las operaciones autorizadas para mi cuenta.

#### Criterios de aceptación

- **Escenario:** Inicio de sesión con credenciales válidas
- **Dado:** que mi cuenta está activa
- **Y dado:** que proporcioné mi nombre de usuario y contraseña válidos
- **Cuando:** solicito iniciar sesión
- **Entonces:** accedo al sistema con las capacidades correspondientes a mi rol.

- **Escenario:** Rechazo de credenciales inválidas
- **Dado:** que proporcioné credenciales inválidas
- **Cuando:** solicito iniciar sesión
- **Entonces:** el sistema rechaza el acceso sin revelar cuál dato es incorrecto.

- **Escenario:** Intentos fallidos repetidos
- **Dado:** que una cuenta activa recibió intentos de acceso con credenciales inválidas
- **Cuando:** su titular proporciona posteriormente credenciales válidas
- **Entonces:** puede acceder sin requerir un desbloqueo administrativo.

### User Story AUTH-002 — Bloquear el acceso de una cuenta desactivada

- **Estado:** Confirmada
- **Como** administrador
- **quiero** desactivar la cuenta de un colaborador
- **para** impedir nuevos accesos sin perder el historial de sus operaciones.

#### Criterios de aceptación

- **Escenario:** Intento de acceso de una cuenta desactivada
- **Dado:** que una cuenta conserva ventas o movimientos históricos
- **Y dado:** que un administrador la desactivó
- **Cuando:** esa cuenta intenta iniciar sesión
- **Entonces:** el acceso es rechazado y sus operaciones históricas permanecen atribuidas a ella.

### User Story AUTH-003 — Mantener una sesión activa en un dispositivo personal

- **Estado:** Confirmada
- **Como** administrador o empleado
- **quiero** conservar mi sesión hasta cerrarla explícitamente
- **para** utilizar la aplicación sin autenticarme repetidamente.

#### Criterios de aceptación

- **Escenario:** Regreso a una sesión válida
- **Dado:** que inicié sesión en mi dispositivo personal
- **Y dado:** que no cerré sesión y mi cuenta continúa activa
- **Cuando:** vuelvo a abrir la aplicación
- **Entonces:** recupero mi sesión mediante credenciales renovables sin escribir nuevamente la contraseña.

### User Story AUTH-004 — Cerrar mi propia sesión

- **Estado:** Confirmada
- **Como** administrador o empleado
- **quiero** cerrar mi sesión
- **para** impedir que otra persona utilice mi cuenta desde ese dispositivo.

#### Criterios de aceptación

- **Escenario:** Cierre voluntario de sesión
- **Dado:** que mantengo una sesión activa
- **Cuando:** selecciono cerrar sesión
- **Entonces:** esa sesión deja de permitir acceso y debo autenticarme nuevamente.

### User Story AUTH-005 — Restablecer la contraseña de un colaborador

- **Estado:** Confirmada
- **Como** administrador
- **quiero** restablecer el acceso de un colaborador que olvidó su contraseña
- **para** permitirle recuperar su cuenta sin crear otra identidad.

#### Criterios de aceptación

- **Escenario:** Restablecimiento administrativo
- **Dado:** que existe una cuenta activa del colaborador
- **Cuando:** inicio el restablecimiento de su contraseña
- **Entonces:** el colaborador recibe una credencial temporal y las sesiones anteriores de su cuenta quedan revocadas.

- **Escenario:** Primer acceso con contraseña temporal
- **Dado:** que un administrador restableció mi contraseña
- **Cuando:** inicio sesión con la credencial temporal
- **Entonces:** debo definir una contraseña personal nueva antes de acceder a las funciones del sistema.

---

## Productos y precios

### User Story PROD-001 — Consultar un producto y sus precios autorizados

- **Estado:** Confirmada
- **Como** empleado
- **quiero** buscar un producto por código o nombre
- **para** informar su disponibilidad y utilizar un precio de venta autorizado.

#### Criterios de aceptación

- **Escenario:** Consulta de producto existente
- **Dado:** que existe un producto activo con código manual único
- **Cuando:** lo busco por código o nombre
- **Entonces:** veo sus precios mínimo, sugerido y máximo opcional, junto con el stock de tienda y almacén, sin ver costos ni márgenes.

### User Story PROD-002 — Administrar el catálogo de productos

- **Estado:** Confirmada
- **Como** administrador
- **quiero** crear y actualizar productos
- **para** mantener vigente el catálogo utilizado por ventas e inventario.

#### Criterios de aceptación

- **Escenario:** Creación con código disponible
- **Dado:** que el código manual no pertenece a otro producto
- **Y dado:** que indiqué nombre, categoría y precio mínimo
- **Cuando:** registro el producto con descripción, precio sugerido, precio máximo y etiquetas opcionales
- **Entonces:** el producto queda disponible para recibir inventario y participar en ventas.

- **Escenario:** Código duplicado
- **Dado:** que otro producto ya utiliza el código indicado
- **Cuando:** intento guardar el producto
- **Entonces:** el sistema rechaza la operación e identifica el conflicto de código.

- **Escenario:** Rango de precios inconsistente
- **Dado:** que informé uno o más precios opcionales
- **Y dado:** que los valores no cumplen mínimo menor o igual que sugerido y sugerido menor o igual que máximo entre los precios presentes
- **Cuando:** intento guardar el producto
- **Entonces:** el sistema rechaza el rango e indica qué precios deben corregirse.

### User Story PROD-003 — Desactivar un producto con historial

- **Estado:** Confirmada
- **Como** administrador
- **quiero** desactivar un producto que ya no se comercializa
- **para** impedir nuevas operaciones sin destruir su historial.

#### Criterios de aceptación

- **Escenario:** Desactivación de producto utilizado
- **Dado:** que el producto participa en compras, movimientos o ventas históricas
- **Cuando:** confirmo su desactivación
- **Entonces:** deja de estar disponible para nuevas operaciones y permanece visible en los registros históricos.

### User Story PROD-004 — Aprobar una venta debajo del precio mínimo

- **Estado:** Confirmada
- **Como** administrador
- **quiero** aprobar un precio inferior al mínimo con una razón
- **para** permitir acuerdos excepcionales sin perder control comercial.

#### Criterios de aceptación

- **Escenario:** Empleado propone un precio inferior al mínimo
- **Dado:** que una línea de venta tiene un precio inferior al mínimo vigente
- **Y dado:** que existe una razón escrita
- **Cuando:** un administrador aprueba la excepción
- **Entonces:** la línea puede confirmarse conservando precio de referencia, precio acordado, razón y aprobador.

- **Escenario:** Excepción sin aprobación
- **Dado:** que una línea de venta tiene un precio inferior al mínimo vigente
- **Cuando:** el empleado intenta confirmar la venta sin aprobación administrativa
- **Entonces:** el sistema impide confirmar la venta.

### User Story PROD-005 — Asociar imágenes a un producto

- **Estado:** Confirmada
- **Como** administrador
- **quiero** asociar hasta dos imágenes opcionales a un producto
- **para** reconocer visualmente la mercancía sin depender únicamente del código o nombre.

#### Criterios de aceptación

- **Escenario:** Producto sin imágenes
- **Dado:** que completé los datos obligatorios del producto
- **Cuando:** lo guardo sin adjuntar imágenes
- **Entonces:** el producto queda registrado normalmente con una representación visual predeterminada.

- **Escenario:** Producto con hasta dos imágenes
- **Dado:** que seleccioné una o dos imágenes válidas
- **Cuando:** guardo el producto
- **Entonces:** las imágenes quedan asociadas y disponibles en su consulta.

- **Escenario:** Producto supera el límite de imágenes
- **Dado:** que el producto ya tiene dos imágenes asociadas
- **Cuando:** intento añadir otra imagen
- **Entonces:** el sistema rechaza la operación e informa el límite permitido.

### User Story PROD-006 — Organizar productos mediante categorías y etiquetas

- **Estado:** Confirmada
- **Como** empleado
- **quiero** filtrar productos por categoría y etiquetas
- **para** encontrarlos aunque no recuerde su código o nombre exacto.

#### Criterios de aceptación

- **Escenario:** Producto clasificado
- **Dado:** que todo producto posee una categoría y puede tener varias etiquetas opcionales
- **Cuando:** filtro el catálogo por una categoría o etiqueta
- **Entonces:** veo los productos activos que coinciden con el criterio elegido.

### User Story PROD-007 — Administrar categorías y etiquetas sin perder historial

- **Estado:** Confirmada
- **Como** administrador
- **quiero** crear, renombrar y desactivar categorías y etiquetas
- **para** mantener organizada la búsqueda de productos sin romper clasificaciones históricas.

#### Criterios de aceptación

- **Escenario:** Creación de una clasificación
- **Dado:** que no existe una categoría o etiqueta equivalente activa
- **Cuando:** registro su nombre
- **Entonces:** queda disponible para clasificar productos.

- **Escenario:** Cambio de nombre
- **Dado:** que existe una categoría o etiqueta activa
- **Cuando:** actualizo su nombre
- **Entonces:** los productos asociados muestran el nuevo nombre sin perder su relación.

- **Escenario:** Desactivación de una clasificación utilizada
- **Dado:** que una categoría o etiqueta está asociada con productos
- **Cuando:** confirmo su desactivación
- **Entonces:** deja de estar disponible para nuevas asignaciones y permanece visible en el historial existente.

---

## Inventario

### User Story INV-001 — Consultar existencias por ubicación y disponibilidad

- **Estado:** Confirmada
- **Como** empleado
- **quiero** consultar el inventario de tienda y almacén
- **para** saber cuántas unidades pueden ofrecerse realmente.

#### Criterios de aceptación

- **Escenario:** Producto con unidades reservadas
- **Dado:** que un producto posee existencias físicas y algunas están reservadas
- **Cuando:** consulto su inventario
- **Entonces:** veo por ubicación las cantidades físicas, reservadas y disponibles.

### User Story INV-002 — Trasladar inventario entre ubicaciones

- **Estado:** Confirmada
- **Como** administrador
- **quiero** trasladar unidades entre tienda y almacén
- **para** reflejar dónde se encuentra físicamente la mercancía.

#### Criterios de aceptación

- **Escenario:** Traslado con disponibilidad suficiente
- **Dado:** que la ubicación de origen tiene suficientes unidades disponibles
- **Cuando:** confirmo el producto, cantidad, origen y destino
- **Entonces:** el movimiento reduce el origen, incrementa el destino y conserva responsable y fecha como una única operación.

- **Escenario:** Traslado sin disponibilidad suficiente
- **Dado:** que la cantidad solicitada supera las unidades disponibles en el origen
- **Cuando:** intento confirmar el traslado
- **Entonces:** el sistema rechaza la operación sin modificar ninguna ubicación.

### User Story INV-003 — Dar de baja mercancía no vendible

- **Estado:** Confirmada
- **Como** administrador
- **quiero** dar de baja unidades dañadas, perdidas o no vendibles
- **para** mantener el inventario real y conocer la pérdida asociada.

#### Criterios de aceptación

- **Escenario:** Baja de unidades disponibles
- **Dado:** que existen unidades disponibles en la ubicación indicada
- **Y dado:** que seleccioné una categoría y escribí una razón
- **Cuando:** confirmo la baja
- **Entonces:** disminuye el inventario físico y disponible y queda registrado su costo como pérdida de inventario.

- **Escenario:** Baja que afectaría unidades reservadas
- **Dado:** que la cantidad disponible no cubre la baja solicitada porque existen unidades reservadas
- **Cuando:** intento confirmar la baja
- **Entonces:** el sistema bloquea la operación e identifica las reservas que deben resolverse.

### User Story INV-004 — Ajustar una diferencia de conteo físico

- **Estado:** Confirmada
- **Como** administrador
- **quiero** registrar una diferencia encontrada durante un conteo
- **para** reconciliar el sistema con la existencia física sin inventar una causa.

#### Criterios de aceptación

- **Escenario:** Conteo distinto del stock esperado
- **Dado:** que conté físicamente un producto en una ubicación
- **Y dado:** que escribí la razón del ajuste
- **Cuando:** confirmo la cantidad física encontrada
- **Entonces:** el sistema registra la diferencia como ajuste auditable y actualiza la existencia de esa ubicación.

### User Story INV-005 — Reservar unidades sin retirarlas físicamente

- **Estado:** Confirmada
- **Como** empleado
- **quiero** reservar unidades de una venta para un cliente
- **para** evitar que se ofrezcan mientras permanecen en tienda o almacén.

#### Criterios de aceptación

- **Escenario:** Reserva con unidades disponibles
- **Dado:** que la ubicación elegida posee cantidad disponible suficiente
- **Cuando:** confirmo la reserva de la línea de venta
- **Entonces:** aumenta la cantidad reservada y disminuye la disponible sin cambiar la existencia física.

### User Story INV-006 — Liberar inventario de una reserva cancelada

- **Estado:** Confirmada
- **Como** administrador
- **quiero** liberar las unidades de una reserva cancelada que no fueron entregadas
- **para** ofrecerlas nuevamente a otros clientes.

#### Criterios de aceptación

- **Escenario:** Cancelación de una línea reservada y no entregada
- **Dado:** que las unidades siguen físicamente en su ubicación
- **Cuando:** confirmo la cancelación y su liberación
- **Entonces:** disminuye la cantidad reservada y aumenta la disponible en la misma ubicación.

### User Story INV-007 — Revisar mercancía devuelta antes de venderla

- **Estado:** Confirmada
- **Como** administrador
- **quiero** clasificar el estado de un producto que retorna
- **para** impedir que una unidad defectuosa vuelva accidentalmente al stock vendible.

#### Criterios de aceptación

- **Escenario:** Producto retornado pendiente de revisión
- **Dado:** que una devolución incluye retorno físico
- **Cuando:** marco la unidad como pendiente de revisión
- **Entonces:** el producto figura físicamente en la ubicación elegida pero no aumenta el stock disponible.

- **Escenario:** Producto retornado apto para venta
- **Dado:** que revisé una unidad retornada
- **Cuando:** la clasifico como apta para venta
- **Entonces:** la unidad se incorpora al stock disponible de la ubicación elegida.

---

## Compras y anticipos a proveedores

### User Story PUR-001 — Registrar una compra con varios productos

- **Estado:** Confirmada
- **Como** administrador
- **quiero** registrar una compra pagada al contado con varios productos
- **para** ingresar mercancía y conservar sus costos reales.

#### Criterios de aceptación

- **Escenario:** Compra con proveedor registrado u ocasional
- **Dado:** que indiqué un proveedor registrado o los datos de un proveedor ocasional
- **Y dado:** que cada línea contiene producto, cantidad, costo y ubicación de ingreso
- **Cuando:** confirmo la compra y su método de pago
- **Entonces:** se conserva el costo de cada línea, se incrementa el inventario y se registra el egreso de caja como una sola operación consistente.

### User Story PUR-002 — Sugerir revisión de precios tras un cambio de costo

- **Estado:** Confirmada
- **Como** administrador
- **quiero** recibir una sugerencia cuando cambia el costo de reposición
- **para** evaluar los precios de venta sin modificarlos automáticamente.

#### Criterios de aceptación

- **Escenario:** Nuevo costo diferente del costo anterior
- **Dado:** que confirmé una compra cuyo costo difiere del registrado anteriormente
- **Cuando:** finaliza el ingreso de inventario
- **Entonces:** el sistema informa qué productos deberían revisarse y conserva sus precios actuales hasta una decisión administrativa.

### User Story PUR-003 — Registrar un anticipo para reservar mercancía

- **Estado:** Confirmada
- **Como** administrador
- **quiero** registrar dinero adelantado a un proveedor
- **para** controlar la reserva de mercancía y el saldo entregado antes de la compra.

#### Criterios de aceptación

- **Escenario:** Anticipo con detalle flexible
- **Dado:** que identifiqué un proveedor registrado u ocasional
- **Y dado:** que los productos pueden ser existentes, nuevos o todavía no estar definidos con exactitud
- **Cuando:** registro monto, fecha y método de pago del anticipo
- **Entonces:** se registra un egreso de caja pendiente de aplicar sin reconocer todavía un gasto operativo ni una entrada de inventario.

### User Story PUR-004 — Aplicar un anticipo al completar una compra

- **Estado:** Confirmada
- **Como** administrador
- **quiero** aplicar anticipos existentes al registrar la compra definitiva
- **para** pagar únicamente el saldo restante sin duplicar egresos.

#### Criterios de aceptación

- **Escenario:** Compra completada con un anticipo previo
- **Dado:** que el proveedor tiene un anticipo pendiente de aplicar
- **Y dado:** que la compra definitiva puede contener productos o cantidades diferentes de los inicialmente previstos
- **Cuando:** aplico el anticipo a la compra
- **Entonces:** el costo total corresponde a la compra y el nuevo egreso de caja corresponde únicamente al saldo pagado en ese momento.

- **Escenario:** Un anticipo se distribuye entre varias compras
- **Dado:** que un anticipo conserva saldo pendiente
- **Y dado:** que el proveedor entrega la mercancía en momentos separados
- **Cuando:** aplico una parte del anticipo a una compra
- **Entonces:** la compra utiliza solo el monto indicado y el saldo restante continúa disponible para otra compra del mismo proveedor.

- **Escenario:** Una compra utiliza varios anticipos
- **Dado:** que existen varios anticipos con saldo pendiente para el proveedor de la compra
- **Cuando:** aplico importes de esos anticipos a la compra
- **Entonces:** el saldo por pagar de la compra disminuye por la suma aplicada sin generar un nuevo egreso por esos importes.

- **Escenario:** Aplicación superior al saldo disponible
- **Dado:** que el monto solicitado supera el saldo pendiente del anticipo
- **Cuando:** intento aplicarlo a una compra
- **Entonces:** el sistema rechaza la aplicación sin modificar el anticipo ni la compra.

### User Story PUR-005 — Resolver un anticipo no aplicado

- **Estado:** Confirmada
- **Como** administrador
- **quiero** registrar la resolución de un anticipo que no terminó en compra
- **para** reflejar si el dinero fue recuperado o se convirtió en una pérdida.

#### Criterios de aceptación

- **Escenario:** Proveedor devuelve el anticipo
- **Dado:** que existe un anticipo pendiente de aplicar
- **Cuando:** registro su devolución
- **Entonces:** el sistema registra el ingreso de caja asociado y actualiza el saldo pendiente del anticipo.

- **Escenario:** Proveedor devuelve parte del anticipo
- **Dado:** que existe un anticipo con saldo pendiente suficiente
- **Cuando:** registro un reembolso parcial
- **Entonces:** el sistema registra únicamente el dinero recuperado y conserva el saldo restante pendiente de aplicar, reembolsar o reconocer como pérdida.

- **Escenario:** Reembolso superior al saldo pendiente
- **Dado:** que el monto indicado supera el saldo pendiente del anticipo
- **Cuando:** intento registrar el reembolso
- **Entonces:** el sistema rechaza la operación sin modificar el anticipo.

- **Escenario:** Anticipo no recuperable
- **Dado:** que existe un anticipo que no será aplicado ni devuelto
- **Y dado:** que escribí una razón
- **Cuando:** lo marco como no recuperable
- **Entonces:** el saldo correspondiente queda registrado como pérdida con responsable y fecha.

---

## Clientes

### User Story CUS-001 — Identificar a un cliente con saldo pendiente

- **Estado:** Confirmada
- **Como** empleado
- **quiero** asociar una venta con deuda a un cliente identificable
- **para** saber quién debe pagar el saldo.

#### Criterios de aceptación

- **Escenario:** Venta con saldo y cliente identificado
- **Dado:** que registré nombre y un teléfono que no pertenece a otro cliente
- **Cuando:** confirmo una venta que conservará saldo pendiente
- **Entonces:** la venta queda vinculada al cliente y aparece en su deuda consolidada.

- **Escenario:** Teléfono ya utilizado
- **Dado:** que otro cliente posee el mismo teléfono normalizado
- **Cuando:** intento crear un nuevo cliente con ese número
- **Entonces:** el sistema evita el duplicado y me permite seleccionar al cliente existente.

### User Story CUS-002 — Registrar datos opcionales de un cliente

- **Estado:** Confirmada
- **Como** empleado
- **quiero** registrar dirección y DNI de manera opcional
- **para** identificar mejor al cliente cuando el negocio lo necesite.

#### Criterios de aceptación

- **Escenario:** Cliente sin documentos adicionales
- **Dado:** que proporcioné nombre y teléfono válidos
- **Cuando:** guardo al cliente sin dirección ni DNI
- **Entonces:** el cliente queda registrado sin exigir esos datos opcionales.

### User Story CUS-003 — Consultar historial y deuda consolidada

- **Estado:** Confirmada
- **Como** empleado
- **quiero** consultar las ventas, pagos y saldo total de un cliente
- **para** conocer su situación antes de acordar una nueva venta.

#### Criterios de aceptación

- **Escenario:** Cliente con varias operaciones
- **Dado:** que el cliente tiene ventas y pagos registrados por uno o más empleados
- **Cuando:** consulto su historial
- **Entonces:** veo sus operaciones, montos cobrados, saldos pendientes y estados sin acceder a costos ni márgenes.

### User Story CUS-004 — Fusionar clientes duplicados

- **Estado:** Confirmada
- **Como** administrador
- **quiero** fusionar dos registros de la misma persona
- **para** mantener un único historial comercial y financiero.

#### Criterios de aceptación

- **Escenario:** Fusión con cliente principal seleccionado
- **Dado:** que elegí el registro principal y resolví los datos en conflicto
- **Cuando:** confirmo la fusión
- **Entonces:** las operaciones quedan asociadas al cliente principal, el duplicado se desactiva y se conserva la trazabilidad de la fusión.

---

## Ventas, reservas y entregas

### User Story SAL-001 — Crear una venta con varios productos

- **Estado:** Confirmada
- **Como** empleado
- **quiero** registrar varios productos y cantidades en una sola venta
- **para** representar la operación completa realizada con el cliente.

#### Criterios de aceptación

- **Escenario:** Venta con múltiples líneas
- **Dado:** que cada línea tiene producto, cantidad, ubicación y precio acordado
- **Cuando:** confirmo una venta válida
- **Entonces:** se conserva el total acordado, el creador, la fecha y el detalle histórico de cada línea.

### User Story SAL-002 — Combinar entregas y reservas en una venta

- **Estado:** Confirmada
- **Como** empleado
- **quiero** indicar por producto y cantidad qué se entrega y qué queda reservado
- **para** atender operaciones con cumplimiento parcial.

#### Criterios de aceptación

- **Escenario:** Venta con líneas entregadas y reservadas
- **Dado:** que existe disponibilidad suficiente en las ubicaciones elegidas
- **Cuando:** confirmo las cantidades a entregar y reservar
- **Entonces:** las entregadas salen físicamente del inventario y las reservadas reducen solo la disponibilidad.

### User Story SAL-003 — Vender directamente desde el almacén

- **Estado:** Confirmada
- **Como** empleado
- **quiero** seleccionar el almacén como origen de una línea
- **para** registrar correctamente una venta atendida desde esa ubicación.

#### Criterios de aceptación

- **Escenario:** Entrega desde almacén
- **Dado:** que el almacén posee cantidad disponible suficiente
- **Cuando:** confirmo la entrega desde el almacén
- **Entonces:** el inventario físico disminuye únicamente en el almacén.

### User Story SAL-004 — Asignar fecha de vencimiento a un saldo

- **Estado:** Confirmada
- **Como** empleado
- **quiero** definir una fecha esperada de pago
- **para** identificar visualmente operaciones atrasadas.

#### Criterios de aceptación

- **Escenario:** Saldo supera la fecha esperada
- **Dado:** que una venta conserva saldo pendiente y tiene fecha de vencimiento
- **Cuando:** la fecha actual supera el vencimiento
- **Entonces:** la operación se muestra como atrasada sin cancelarse ni generar cargos automáticamente.

### User Story SAL-005 — Consultar mis ventas

- **Estado:** Confirmada
- **Como** empleado
- **quiero** consultar las ventas que registré
- **para** dar seguimiento a mis operaciones y pagos pendientes.

#### Criterios de aceptación

- **Escenario:** Consulta del empleado
- **Dado:** que existen ventas creadas por diferentes cuentas
- **Cuando:** consulto mi listado de ventas
- **Entonces:** el sistema muestra las ventas creadas por mi cuenta con sus estados de pago y entrega.

### User Story SAL-006 — Consultar cualquier venta como administrador

- **Estado:** Confirmada
- **Como** administrador
- **quiero** consultar ventas creadas por cualquier empleado
- **para** supervisar las operaciones del negocio.

#### Criterios de aceptación

- **Escenario:** Consulta administrativa
- **Dado:** que existen ventas creadas por diferentes cuentas
- **Cuando:** consulto el listado general de ventas
- **Entonces:** veo todas las ventas y el usuario responsable de cada una.

### User Story SAL-007 — Preservar el precio histórico de una venta

- **Estado:** Confirmada
- **Como** administrador
- **quiero** conservar los precios de referencia y acordados al vender
- **para** explicar el margen histórico aunque cambie el catálogo.

#### Criterios de aceptación

- **Escenario:** Cambio posterior de precios del producto
- **Dado:** que una venta fue confirmada con determinados precios
- **Cuando:** se actualizan los precios del catálogo
- **Entonces:** los importes y referencias de la venta histórica permanecen sin cambios.

### User Story SAL-008 — Editar una venta antes de confirmarla

- **Estado:** Confirmada
- **Como** empleado
- **quiero** modificar una venta mientras permanece en borrador
- **para** corregir productos, cantidades y precios antes de producir efectos financieros o de inventario.

#### Criterios de aceptación

- **Escenario:** Modificación de borrador
- **Dado:** que la venta todavía no fue confirmada
- **Cuando:** cambio sus líneas o condiciones
- **Entonces:** el borrador se actualiza sin generar movimientos de inventario, pagos ni auditoría financiera.

- **Escenario:** Edición directa de una venta confirmada
- **Dado:** que la venta ya fue confirmada
- **Cuando:** intento modificar directamente productos, cantidades o precios
- **Entonces:** el sistema rechaza la edición y orienta a utilizar una operación de ajuste, devolución o cancelación autorizada.

### User Story SAL-009 — Ajustar el total de una venta confirmada

- **Estado:** Confirmada
- **Como** administrador
- **quiero** ajustar justificadamente el total acordado de una venta confirmada
- **para** representar un acuerdo posterior sin sobrescribir su valor original.

#### Criterios de aceptación

- **Escenario:** Ajuste administrativo del total
- **Dado:** que existe una venta confirmada
- **Y dado:** que escribí una razón para el nuevo acuerdo
- **Cuando:** confirmo el ajuste de importe
- **Entonces:** se conserva el total anterior, el nuevo total, la diferencia, el responsable y la fecha, y se recalcula el saldo vigente.

- **Escenario:** Ajuste que produciría un total menor que lo ya reembolsado o aplicado
- **Dado:** que el nuevo total sería incompatible con los movimientos monetarios vigentes
- **Cuando:** intento confirmar el ajuste
- **Entonces:** el sistema rechaza la operación e informa qué movimientos deben resolverse primero.

---

## Pagos, cierres y cancelaciones

### User Story PAY-001 — Registrar un pago en una venta propia

- **Estado:** Confirmada
- **Como** empleado
- **quiero** registrar un pago posterior en una venta que creé
- **para** mantener actualizado el saldo del cliente.

#### Criterios de aceptación

- **Escenario:** Pago autorizado
- **Dado:** que soy el creador de la venta
- **Y dado:** que indiqué monto y método entre efectivo, Yape, Plin o POS
- **Cuando:** confirmo el pago
- **Entonces:** disminuye el saldo y se conserva el usuario, método, fecha y monto del movimiento.

- **Escenario:** Empleado intenta pagar una venta ajena
- **Dado:** que otro empleado creó la venta
- **Cuando:** intento registrar un pago en ella
- **Entonces:** el sistema rechaza la operación.

- **Escenario:** Pago superior al saldo vigente
- **Dado:** que el monto indicado supera el saldo pendiente de la venta
- **Cuando:** intento confirmar el pago
- **Entonces:** el sistema rechaza la operación y muestra el saldo máximo que puede registrarse.

### User Story PAY-002 — Registrar pagos en cualquier venta

- **Estado:** Confirmada
- **Como** administrador
- **quiero** registrar pagos en ventas de cualquier empleado
- **para** mantener correctos los saldos cuando atiendo al cliente.

#### Criterios de aceptación

- **Escenario:** Administrador cobra una venta ajena
- **Dado:** que la venta fue creada por otro usuario
- **Cuando:** registro un pago válido
- **Entonces:** el saldo se actualiza conservando por separado al creador de la venta y al registrador del pago.

### User Story PAY-003 — Finalizar una venta con saldo no cobrado

- **Estado:** Confirmada
- **Como** administrador
- **quiero** cerrar una venta sin cobrar todo el total acordado
- **para** representar un acuerdo informal sin ocultar la diferencia.

#### Criterios de aceptación

- **Escenario:** Cierre incompleto autorizado
- **Dado:** que la venta conserva saldo pendiente
- **Y dado:** que escribí una razón
- **Cuando:** confirmo el cierre incompleto
- **Entonces:** la venta queda finalizada y el saldo no cobrado se registra como monto condonado o pérdida comercial.

### User Story PAY-004 — Cancelar una venta conservando sus efectos reales

- **Estado:** Confirmada
- **Como** administrador
- **quiero** cancelar una venta indicando pagos, entregas y productos retornados
- **para** revertir únicamente los efectos que realmente correspondan.

#### Criterios de aceptación

- **Escenario:** Cancelación de venta con productos no entregados
- **Dado:** que la venta contiene unidades reservadas aún presentes en el negocio
- **Y dado:** que indiqué el tratamiento de los pagos recibidos
- **Cuando:** confirmo la cancelación con una razón
- **Entonces:** la venta queda cancelada, las unidades no entregadas se liberan y los movimientos monetarios permanecen trazables.

### User Story PAY-005 — Corregir un pago sin borrar su historia

- **Estado:** Confirmada
- **Como** administrador
- **quiero** anular o compensar un pago incorrecto con una razón
- **para** corregir el saldo sin ocultar la operación original.

#### Criterios de aceptación

- **Escenario:** Pago confirmado incorrectamente
- **Dado:** que existe un pago confirmado
- **Y dado:** que escribí una razón de corrección
- **Cuando:** confirmo su anulación o movimiento compensatorio
- **Entonces:** el saldo refleja la corrección y ambos movimientos permanecen asociados con sus responsables y fechas.

---

## Devoluciones

### User Story RET-001 — Aprobar una devolución total o parcial

- **Estado:** Confirmada
- **Como** administrador
- **quiero** devolver una o varias unidades de una venta
- **para** reembolsar al cliente sin cancelar productos que no forman parte de la devolución.

#### Criterios de aceptación

- **Escenario:** Devolución parcial de una venta
- **Dado:** que seleccioné líneas y cantidades previamente vendidas
- **Y dado:** que escribí una razón obligatoria
- **Cuando:** apruebo la devolución
- **Entonces:** se crea una devolución vinculada a la venta únicamente por las cantidades seleccionadas.

- **Escenario:** Reembolso superior a lo pagado por las unidades devueltas
- **Dado:** que el monto solicitado supera el importe neto efectivamente pagado y todavía no reembolsado por las unidades seleccionadas
- **Cuando:** intento aprobar la devolución
- **Entonces:** el sistema rechaza el reembolso e informa el máximo permitido.

### User Story RET-002 — Registrar reembolso y retorno físico por separado

- **Estado:** Confirmada
- **Como** administrador
- **quiero** indicar cuánto dinero se devuelve y si el producto retorna
- **para** reflejar correctamente el efecto financiero y físico de una devolución.

#### Criterios de aceptación

- **Escenario:** Reembolso sin retorno por producto defectuoso
- **Dado:** que la devolución fue aprobada con razón obligatoria
- **Y dado:** que indiqué que el producto no retorna
- **Cuando:** confirmo monto y método del reembolso
- **Entonces:** se registra la salida de dinero sin incrementar el inventario.

- **Escenario:** Reembolso con retorno físico
- **Dado:** que la devolución fue aprobada con razón obligatoria
- **Y dado:** que indiqué ubicación y condición de retorno
- **Cuando:** confirmo monto y método del reembolso
- **Entonces:** se registra la salida de dinero y la unidad retorna con la disponibilidad correspondiente a su condición.

- **Escenario:** Reembolso mediante un método diferente al pago original
- **Dado:** que la devolución fue aprobada y existe un importe reembolsable
- **Cuando:** selecciono efectivo, Yape, Plin o POS y confirmo el reembolso
- **Entonces:** el sistema registra el método realmente utilizado sin exigir que coincida con el pago original.

### User Story RET-003 — Impedir devoluciones no autorizadas

- **Estado:** Confirmada
- **Como** administrador
- **quiero** reservar la aprobación de devoluciones al rol administrativo
- **para** controlar salidas de dinero y alteraciones de inventario.

#### Criterios de aceptación

- **Escenario:** Empleado intenta aprobar una devolución
- **Dado:** que inicié sesión como empleado
- **Cuando:** intento confirmar una devolución
- **Entonces:** el sistema rechaza la operación.

---

## Gastos operativos

### User Story EXP-001 — Registrar un gasto operativo

- **Estado:** Confirmada
- **Como** administrador
- **quiero** registrar manualmente los gastos del negocio
- **para** conocer las salidas operativas y el resultado del período.

#### Criterios de aceptación

- **Escenario:** Registro de gasto mensual
- **Dado:** que indiqué categoría, monto, fecha, método y descripción
- **Cuando:** confirmo el gasto con comprobante opcional
- **Entonces:** el egreso aparece en el flujo de caja y en los gastos operativos del período.

### User Story EXP-002 — Administrar categorías de gastos

- **Estado:** Confirmada
- **Como** administrador
- **quiero** clasificar gastos con categorías mantenibles
- **para** analizar alquiler, servicios, movilidad, alimentación y otros conceptos sin cambiar el sistema.

#### Criterios de aceptación

- **Escenario:** Uso de una categoría activa
- **Dado:** que existe una categoría de gasto activa
- **Cuando:** registro un gasto con esa categoría
- **Entonces:** el gasto queda clasificado y puede incluirse en reportes por categoría.

### User Story EXP-003 — Anular un gasto conservando historial

- **Estado:** Confirmada
- **Como** administrador
- **quiero** anular un gasto incorrecto indicando una razón
- **para** corregir los reportes sin eliminar evidencia de la operación.

#### Criterios de aceptación

- **Escenario:** Anulación de gasto confirmado
- **Dado:** que existe un gasto confirmado
- **Y dado:** que escribí la razón de anulación
- **Cuando:** confirmo la anulación
- **Entonces:** el gasto deja de afectar los totales vigentes y permanece visible con su estado, responsable y fecha.

---

## Dashboard y reportes

### User Story DASH-001 — Consultar el flujo de caja mensual

- **Estado:** Confirmada
- **Como** administrador
- **quiero** comparar entradas y salidas reales de dinero del mes
- **para** saber cuánto efectivo ingresó y egresó del negocio.

#### Criterios de aceptación

- **Escenario:** Consulta de un período mensual
- **Dado:** que existen cobros, compras, anticipos, gastos y reembolsos en el período
- **Cuando:** consulto el flujo de caja del mes
- **Entonces:** veo cada categoría de entrada y salida y su flujo neto sin duplicar anticipos aplicados a compras.

### User Story DASH-002 — Consultar el resultado mensual

- **Estado:** Confirmada
- **Como** administrador
- **quiero** consultar ventas, costo vendido, gastos y pérdidas por separado
- **para** estimar correctamente la rentabilidad del negocio.

#### Criterios de aceptación

- **Escenario:** Resultado de un período
- **Dado:** que existen ventas, costos históricos, gastos, devoluciones, bajas y saldos condonados
- **Cuando:** consulto el resultado del mes
- **Entonces:** veo ingresos, costo de venta, margen bruto, gastos operativos, pérdidas y resultado estimado como conceptos diferenciados.

### User Story DASH-003 — Comparar desempeño por usuario

- **Estado:** Confirmada
- **Como** administrador
- **quiero** consultar ventas creadas y pagos registrados por cada cuenta
- **para** supervisar la actividad sin confundir quién vendió con quién cobró.

#### Criterios de aceptación

- **Escenario:** Venta creada por un empleado y cobrada por otro usuario
- **Dado:** que distintas cuentas participaron en la operación
- **Cuando:** consulto el reporte por usuario
- **Entonces:** la venta se atribuye a su creador y cada cobro a quien registró el pago.

### User Story DASH-004 — Identificar productos rentables y necesidades de stock

- **Estado:** Confirmada
- **Como** administrador
- **quiero** consultar productos más vendidos, más rentables y con baja disponibilidad
- **para** tomar decisiones de precio y reposición.

#### Criterios de aceptación

- **Escenario:** Consulta del rendimiento de productos
- **Dado:** que existen ventas e inventario en el período seleccionado
- **Cuando:** consulto los indicadores de productos
- **Entonces:** veo unidades vendidas, margen calculado con costos históricos y disponibilidad por ubicación como métricas separadas.

---

## Usuarios y permisos

### User Story IAM-001 — Administrar cuentas de colaboradores

- **Estado:** Confirmada
- **Como** administrador
- **quiero** crear, activar y desactivar cuentas
- **para** controlar quién utiliza el sistema sin perder la autoría histórica.

#### Criterios de aceptación

- **Escenario:** Creación de cuenta con rol inicial
- **Dado:** que proporcioné los datos requeridos de un colaborador
- **Cuando:** creo su cuenta como administrador o empleado
- **Entonces:** la cuenta queda disponible con los permisos correspondientes al rol elegido.

- **Escenario:** Desactivación de una cuenta con sesiones activas
- **Dado:** que un colaborador tiene una o más sesiones activas
- **Cuando:** desactivo su cuenta
- **Entonces:** todas sus sesiones quedan revocadas sin alterar la autoría de sus operaciones históricas.

### User Story IAM-002 — Aplicar permisos de los roles iniciales

- **Estado:** Confirmada para dos roles; perfiles personalizados fuera del MVP
- **Como** administrador
- **quiero** que las acciones estén protegidas según permisos
- **para** operar inicialmente con Administrador y Empleado y poder incorporar perfiles personalizados en el futuro.

#### Criterios de aceptación

- **Escenario:** Usuario intenta una acción no autorizada
- **Dado:** que su rol no posee el permiso requerido
- **Cuando:** intenta ejecutar la acción
- **Entonces:** el sistema la rechaza aunque la interfaz haya mostrado el acceso por error.

---

## Importación inicial

### User Story DATA-001 — Importar productos e inventario inicial desde una plantilla

- **Estado:** Confirmada
- **Como** administrador
- **quiero** importar productos, costos y cantidades desde una plantilla de Excel
- **para** dejar preparado el catálogo y el inventario inicial sin registrar aproximadamente 300 productos uno por uno.

#### Criterios de aceptación

- **Escenario:** Archivo preparado con la plantilla oficial
- **Dado:** que completé una plantilla con códigos, nombres, categorías, precios, costo y cantidades por ubicación
- **Cuando:** cargo el archivo para validarlo
- **Entonces:** veo una previsualización que diferencia filas válidas, advertencias y errores antes de modificar el catálogo o el inventario.

- **Escenario:** Confirmación de una importación validada
- **Dado:** que revisé el resumen de la importación
- **Y dado:** que las filas de productos, costos y cantidades cumplen las reglas definidas
- **Cuando:** confirmo la importación
- **Entonces:** el sistema registra los productos y movimientos de inventario inicial por ubicación, sin crear compras, egresos ni ventas históricas, y entrega un resumen del resultado.

- **Escenario:** El archivo contiene una o más filas inválidas
- **Dado:** que la validación encontró al menos un error en la plantilla
- **Cuando:** intento confirmar la importación
- **Entonces:** el sistema no registra ninguna fila y presenta los errores que deben corregirse.

- **Escenario:** Ya se completó la carga inicial
- **Dado:** que una importación inicial fue confirmada exitosamente
- **Cuando:** intento ejecutar otra carga inicial
- **Entonces:** el sistema impide repetirla mediante el flujo normal.

---

## Reglas de negocio transversales confirmadas

1. Existe una tienda y un almacén; el stock se controla por ubicación.
2. El código manual de producto es único y cada variante comercial se registra como producto diferente.
3. Una venta contiene múltiples productos y múltiples unidades por producto.
4. La reserva no reduce existencia física; reduce disponibilidad.
5. La entrega sí reduce existencia física en la ubicación seleccionada.
6. Una línea puede entregarse o reservarse parcialmente.
7. Las ventas con saldo requieren un cliente identificado por nombre y teléfono.
8. El teléfono normalizado pertenece a un solo cliente.
9. El vencimiento es informativo: marca atraso, pero no cancela ni aplica recargos automáticamente.
10. Un empleado registra pagos solo en ventas propias; un administrador puede hacerlo en cualquiera.
11. El creador de la venta y el registrador de cada pago se conservan por separado.
12. Solo un administrador aprueba precios inferiores al mínimo, devoluciones, bajas, ajustes y traslados.
13. Toda devolución exige razón y reembolso; el retorno físico puede o no ocurrir.
14. Las compras se pagan al contado en el MVP y pueden usar proveedores registrados u ocasionales.
15. Un nuevo costo de compra solo sugiere revisar precios; nunca los cambia automáticamente.
16. Las compras, anticipos, gastos, reembolsos y cobros son movimientos de caja diferenciados.
17. La compra de inventario no es gasto operativo; se convierte en costo cuando se vende o en pérdida cuando se da de baja.
18. Los gastos recurrentes se registran manualmente cada mes.
19. Las operaciones confirmadas se anulan o compensan conservando motivo, actor y fecha.
20. `created_at` y `updated_at` no sustituyen el historial de eventos sensibles.
21. Un anticipo puede aplicarse parcialmente a varias compras del mismo proveedor.
22. Una compra puede utilizar uno o varios anticipos del mismo proveedor.
23. Un anticipo puede reembolsarse total o parcialmente y siempre conserva un saldo explicable.
24. Todo producto pertenece a una categoría.
25. El código, nombre, categoría y precio mínimo son obligatorios.
26. La descripción, etiquetas, precio sugerido y precio máximo son opcionales.
27. Un producto puede tener como máximo dos imágenes opcionales.
28. El inventario se controla únicamente en unidades enteras.
29. La primera carga por Excel incluye costo inicial y cantidades físicas separadas para tienda y almacén.
30. La carga inicial genera movimientos de apertura de inventario, no compras ni egresos de caja.
31. La importación inicial es atómica: si una fila es inválida, no se registra ninguna.
32. La importación por Excel es una herramienta de inicialización de un solo uso y no forma parte de la operación habitual.
33. Cada colaborador utiliza una cuenta individual con nombre de usuario y contraseña.
34. La sesión permanece disponible hasta que el usuario cierre sesión, la cuenta sea desactivada o un administrador revoque el acceso.
35. Desactivar una cuenta revoca todas sus sesiones activas y conserva su historial.
36. El administrador solo asigna contraseñas temporales; no conoce la contraseña personal definitiva del colaborador.
37. Restablecer una contraseña revoca las sesiones anteriores y exige cambiar la credencial temporal en el siguiente acceso.
38. La contraseña tiene al menos diez caracteres, puede ser una frase y no puede coincidir con el nombre de usuario.
39. Las contraseñas no expiran periódicamente.
40. Los intentos fallidos no bloquean la cuenta; la API deberá limitar la frecuencia de solicitudes de autenticación sin exigir desbloqueo administrativo.
41. Solo el administrador gestiona categorías y etiquetas.
42. Las categorías y etiquetas utilizadas se desactivan en lugar de eliminarse.
43. Los precios presentes deben mantener el orden mínimo, sugerido y máximo; los dos últimos continúan siendo opcionales.
44. Una venta en borrador es editable y no produce movimientos financieros ni de inventario.
45. Los productos, cantidades y precios de una venta confirmada no se sobrescriben directamente.
46. Solo el administrador puede ajustar el total acordado de una venta confirmada y debe indicar una razón.
47. Un pago no puede superar el saldo vigente; si cambia el acuerdo, primero se registra un ajuste del total.
48. Una devolución puede realizarse en cualquier momento y no posee cancelación automática por antigüedad.
49. Un reembolso no puede superar el importe neto pagado y aún no reembolsado por las unidades devueltas.
50. El método del reembolso se registra según la salida real de dinero y puede diferir del pago original.
51. En el MVP, los conteos posteriores se resuelven por producto mediante ajustes auditables; no existe una jornada masiva de inventario.

## Decisiones diferidas a fases posteriores

No bloquean el cierre funcional:

- Formatos, peso, compresión y recorte de imágenes: arquitectura técnica y diseño UI.
- Método de costeo del inventario: modelo de dominio y base de datos.
- Estructura exacta de permisos: arquitectura de autorización.
- Diseño visual de estados, alertas y flujos: fase UI/UX.

## Fuera del MVP, pero previsto

- Roles y perfiles personalizados mediante una matriz administrable de permisos.
- Facturación electrónica SUNAT.
- Exportación a Excel y PDF.
- Notificaciones automáticas.
- Seguimiento de llamadas o promesas de pago.
- Auditoría genérica de todos los cambios.
- Automatización de gastos recurrentes.

## Historial del documento

| Fecha | Cambio |
| --- | --- |
| 2026-08-06 | Creación del backlog inicial a partir del descubrimiento y levantamiento funcional. |
| 2026-08-06 | Se confirmaron aplicaciones y reembolsos parciales de anticipos, múltiples compras por anticipo y múltiples anticipos por compra. |
| 2026-08-06 | Se confirmó el catálogo mínimo, el límite de dos imágenes y se incorporó la importación inicial de productos como historia en definición. |
| 2026-08-06 | Se descartó la importación de ventas históricas y se limitó la importación a la primera carga del catálogo. |
| 2026-08-06 | Se confirmó que la misma plantilla inicial incluirá costo y cantidades de tienda y almacén. |
| 2026-08-06 | Se cerró la importación como proceso atómico de un solo uso; después de completarlo, Excel deja de formar parte de la operación. |
| 2026-08-06 | Se confirmó acceso con cuenta individual, nombre de usuario y contraseña, sesión persistente en dispositivo personal y revocación al desactivar la cuenta. |
| 2026-08-06 | Se confirmó recuperación administrativa mediante contraseña temporal, revocación de sesiones y cambio obligatorio en el siguiente acceso. |
| 2026-08-06 | Se confirmó la política de contraseñas sin expiración ni bloqueo de cuenta por intentos fallidos. |
| 2026-08-06 | Se confirmó la administración de categorías y etiquetas mediante creación, renombrado y desactivación con historial. |
| 2026-08-07 | Se confirmó la consistencia mínimo ≤ sugerido ≤ máximo para los precios presentes. |
| 2026-08-07 | Se cerró la Fase 2 con reglas de edición y ajuste de ventas, límites de pago y devolución, reembolsos y conteos individuales de inventario. |
