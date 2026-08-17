# Cierre de la Fase 3 — Modelo de dominio

**Estado:** cerrada el 2026-08-16.

## Resultado

Nova posee un modelo inicial confirmado para el dominio central y los contextos de soporte. El modelo es independiente de NestJS, Prisma, PostgreSQL, HTTP y Cloudinary.

Se completaron:

- lenguaje ubicuo;
- clasificación estratégica y dominio central;
- bounded contexts y mapa de relaciones;
- entidades y objetos de valor;
- agregado `Venta` e invariantes;
- estados y transiciones;
- eventos de dominio sin event sourcing;
- modelos tácticos de todos los contextos;
- diagramas conceptuales y coordinaciones atómicas.

## Decisiones que pasan a la Fase 4

- modelo relacional, cardinalidades y nulabilidad;
- tipo y estrategia de generación de identificadores;
- precisión y redondeo de dinero;
- método de costeo histórico;
- atribución de costo y pago en devoluciones parciales;
- restricciones únicas y de integridad;
- concurrencia optimista o bloqueos por operación;
- límites concretos de transacciones PostgreSQL;
- índices, vistas y consultas analíticas;
- zona horaria y representación de fechas;
- conservación y retención de auditoría;
- persistencia de eventos internos, si aporta valor sin introducir infraestructura innecesaria.

Estas decisiones no están implícitamente resueltas por el modelo de dominio.

## Criterio de entrada a Datos

La Fase 4 puede comenzar porque cada dato persistente candidato puede asignarse a una autoridad de dominio, las invariantes críticas están explícitas y las operaciones que necesitan atomicidad están identificadas.

El modelo continuará siendo un documento vivo. Si el diseño relacional revela una contradicción real, se corrige primero el lenguaje o la frontera afectada y se registra la razón.
