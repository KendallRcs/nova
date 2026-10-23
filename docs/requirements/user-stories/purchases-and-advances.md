# Compras y anticipos a proveedores

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story PUR-001 — Registrar una compra con varios productos

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend y frontend completos mediante una confirmación
  atómica e idempotente. Registra proveedor con identidad estable, líneas, ingreso
  físico por ubicación, costo promedio global y únicamente el nuevo egreso pagado.
  El historial administrativo permite filtrar por proveedor o producto y consultar
  el detalle económico, físico y de anticipos de cada compra. La interfaz permite
  construir una compra multilínea, elegir el destino de cada producto y revisar el
  resultado después de confirmarla.
- **Como** administrador
- **quiero** registrar una compra pagada al contado con varios productos
- **para** ingresar mercancía y conservar sus costos reales.

#### Criterios de aceptación

- **Escenario:** Compra con proveedor registrado u ocasional
- **Dado:** que indiqué la identidad estable de un proveedor registrado u ocasional
- **Y dado:** que cada línea contiene producto, cantidad, costo y ubicación de ingreso
- **Cuando:** confirmo la compra y su método de pago
- **Entonces:** se conserva el costo de cada línea, se incrementa el inventario y se registra el egreso de caja como una sola operación consistente.

- **Escenario:** Revisar el historial y detalle de una compra
- **Dado:** que existen compras confirmadas con líneas, ubicaciones y anticipos aplicados
- **Cuando:** consulto el historial por proveedor o producto y abro una compra
- **Entonces:** veo sus importes, cantidades, costos históricos, aplicaciones de anticipos y responsables sin modificar sus efectos.

### User Story PUR-002 — Sugerir revisión de precios tras un cambio de costo

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend y frontend completos. Cada línea compara su costo
  entrante con el costo promedio disponible anterior y devuelve una sugerencia no
  vinculante que se muestra en el detalle; ningún precio del catálogo se modifica
  automáticamente.
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
- **Trazabilidad de implementación:** backend completo para registrar y buscar la
  identidad estable de proveedores registrados u ocasionales, crear el anticipo
  idempotente junto con su salida de caja y consultar después su saldo y versión.
  El frontend administrativo permite registrar proveedores y anticipos, filtrarlos
  y consultar su saldo. El detalle esperado permanece flexible y no genera
  inventario ni gasto operativo.
- **Como** administrador
- **quiero** registrar dinero adelantado a un proveedor
- **para** controlar la reserva de mercancía y el saldo entregado antes de la compra.

#### Criterios de aceptación

- **Escenario:** Anticipo con detalle flexible
- **Dado:** que identifiqué un proveedor registrado u ocasional
- **Y dado:** que los productos pueden ser existentes, nuevos o todavía no estar definidos con exactitud
- **Cuando:** registro monto, fecha y método de pago del anticipo
- **Entonces:** se registra un egreso de caja pendiente de aplicar sin reconocer todavía un gasto operativo ni una entrada de inventario.

- **Escenario:** Consulta de anticipos para continuar su seguimiento
- **Dado:** que registré anticipos pendientes o resueltos para uno o más proveedores
- **Cuando:** consulto los anticipos filtrando opcionalmente por proveedor y estado
- **Entonces:** veo el monto original, saldo vigente, estado y versión necesarios para aplicarlos o resolverlos con seguridad.

### User Story PUR-004 — Aplicar un anticipo al completar una compra

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend y frontend completos con control optimista de
  versión. Una compra puede consumir varios anticipos del mismo proveedor, un
  anticipo conserva el saldo no aplicado y solo el remanente pagado crea caja. La
  aplicación de cada saldo es manual y la interfaz envía la versión observada.
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
- **Trazabilidad de implementación:** backend y frontend completos para devolver o
  reconocer como pérdida una parte o todo el saldo. Ambas operaciones son
  versionadas, auditables e idempotentes; solo el dinero realmente devuelto genera
  ingreso de caja y el anticipo se marca resuelto al llegar a saldo cero.
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

