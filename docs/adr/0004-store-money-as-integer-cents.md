# ADR-0004: Representar dinero transaccional mediante céntimos enteros

**Date**: 2026-08-23
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

Nova suma y compara precios, pagos, reembolsos, gastos, anticipos y costos. Estos importes deben ser exactos y el núcleo no debe depender de los tipos `Decimal` de Prisma ni permitir fracciones monetarias que el negocio no cobra o paga.

## Decision

Nova representa los importes transaccionales en PEN mediante enteros de 64 bits expresados en céntimos. El objeto de valor `Dinero` encapsula moneda y operaciones, y toda distribución conserva exactamente el total mediante una regla determinista para los residuos.

## Alternatives Considered

### Coma flotante

- **Pros**: soporte nativo y operaciones directas en JavaScript.
- **Cons**: introduce errores binarios de precisión y comparaciones inestables.
- **Why not**: no es aceptable para movimientos monetarios ni cálculos auditables.

### `NUMERIC` y Decimal en todas las capas

- **Pros**: aritmética decimal exacta y escalas configurables.
- **Cons**: permite fracciones de céntimo innecesarias y puede filtrar tipos del ORM hacia el dominio.
- **Why not**: los importes reales de Nova operan a dos decimales y el dominio debe ser independiente de Prisma.

## Consequences

### Positive

- Sumas, restas y comparaciones exactas.
- No existen importes transaccionales con fracciones invisibles de céntimo.
- El dominio monetario se prueba sin ORM ni librería decimal.

### Negative

- API e interfaz deben convertir explícitamente entre céntimos y representación decimal.
- Promedios y distribuciones requieren manejar residuos.

### Risks

- **Pérdida de céntimos al dividir**: utilizar una distribución determinista y comprobar que las partes sumen el total.
- **Desbordamiento o conversión insegura en JavaScript**: usar `bigint` en el núcleo y serializar importes mediante contratos explícitos.
