# Gastos operativos

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


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

