# Gastos operativos

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story EXP-001 — Registrar un gasto operativo

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo para registrar el gasto y
  su egreso de caja en una transacción idempotente. El comprobante opcional se
  adjunta, reemplaza, consulta y elimina mediante almacenamiento protegido.
- **Como** administrador
- **quiero** registrar manualmente los gastos del negocio
- **para** conocer las salidas operativas y el resultado del período.

#### Criterios de aceptación

- **Escenario:** Registro de gasto mensual
- **Dado:** que indiqué categoría, monto, fecha, método y descripción
- **Cuando:** confirmo el gasto con comprobante opcional
- **Entonces:** el egreso aparece en el flujo de caja y en los gastos operativos del período.

- **Escenario:** Registro sin comprobante
- **Dado:** que no dispongo de evidencia digital del gasto
- **Cuando:** confirmo el gasto sin adjuntar un archivo
- **Entonces:** el gasto y su egreso quedan registrados normalmente sin comprobante.

- **Escenario:** Carga protegida de un comprobante válido
- **Dado:** que existe un gasto y tengo una imagen o PDF válido de hasta 5 MiB
- **Cuando:** adjunto el comprobante como administrador
- **Entonces:** queda asociado de forma privada y las imágenes se almacenan optimizadas sin metadatos.

- **Escenario:** Consulta temporal del comprobante
- **Dado:** que el gasto posee un comprobante protegido
- **Cuando:** solicito verlo como administrador autenticado
- **Entonces:** recibo un acceso firmado que vence en cinco minutos sin conocer su clave interna.

- **Escenario:** Sustitución o eliminación del comprobante
- **Dado:** que el gasto posee un comprobante incorrecto
- **Cuando:** lo reemplazo o elimino como administrador
- **Entonces:** cambia únicamente su evidencia adjunta y el hecho financiero permanece intacto.

### User Story EXP-002 — Administrar categorías de gastos

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo para crear, listar,
  renombrar y desactivar categorías sin eliminar su historial. Una categoría
  inactiva no admite gastos nuevos.
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
- **Trazabilidad de implementación:** backend completo mediante una operación
  idempotente y auditable. Excluye el gasto de los totales operativos y registra
  un ingreso solo cuando se declara la devolución total.
- **Decisión funcional:** la anulación admite devolución nula o total, nunca
  parcial. Sin devolución, el egreso histórico permanece en caja; con devolución
  total se registra un ingreso por el mismo importe y el método real. Una futura
  corrección de gasto resolverá devoluciones parciales.
- **Como** administrador
- **quiero** anular un gasto incorrecto indicando una razón
- **para** corregir los reportes sin eliminar evidencia de la operación.

#### Criterios de aceptación

- **Escenario:** Anulación de gasto confirmado
- **Dado:** que existe un gasto confirmado
- **Y dado:** que escribí la razón de anulación
- **Cuando:** confirmo la anulación
- **Entonces:** el gasto deja de afectar los totales vigentes y permanece visible con su estado, responsable y fecha.

- **Escenario:** Anulación sin devolución de dinero
- **Dado:** que el dinero del gasto no regresó al negocio
- **Cuando:** anulo el gasto sin devolución
- **Entonces:** deja de afectar gastos operativos, pero su egreso real permanece en el flujo de caja.

- **Escenario:** Anulación con devolución total
- **Dado:** que el dinero completo del gasto regresó al negocio
- **Cuando:** anulo el gasto indicando el método real de devolución
- **Entonces:** se registra un ingreso por el importe total y el efecto neto en caja es cero.

---

