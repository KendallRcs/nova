# Gastos operativos

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story EXP-001 — Registrar un gasto operativo

- **Estado:** Confirmada
- **Trazabilidad de implementación:** backend completo para registrar el gasto y
  su egreso de caja en una transacción idempotente, con fecha efectiva manual,
  método real, descripción y comprobante opcionales.
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

