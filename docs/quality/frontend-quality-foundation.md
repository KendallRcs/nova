# Base de calidad del frontend

**Estado:** implementada el 2026-10-21.

Esta base verifica comportamiento observable de la aplicación web sin acoplar las
pruebas a detalles internos de React ni incorporar una suite E2E de navegador.

## Herramientas y fronteras

| Área | Elección |
| --- | --- |
| Runner | Vitest 4.1 en entorno `jsdom` |
| Componentes | Testing Library y `user-event` |
| Assertions DOM | `@testing-library/jest-dom` |
| Estado servidor | `QueryClient` nuevo y sin reintentos por prueba |
| HTTP | el adaptador compartido `apiClient` se sustituye en la frontera |
| Cobertura | V8 con reporte de texto y HTML |
| E2E | fuera del alcance inicial por decisión confirmada |

Las pruebas de componente interactúan mediante roles, etiquetas y texto visible.
No inspeccionan estado interno, clases CSS ni implementación de hooks. El cliente
HTTP se simula como frontera completa; los componentes siguen ejecutando sus
adaptadores de feature, manejo de Problem Details y React Query reales.

## Cobertura inicial

La primera suite protege:

- formato monetario y suma de disponibilidad entre ubicaciones;
- carga, resultados, búsqueda por URL, estado vacío y error recuperable del catálogo;
- detalle comercial y desglose de stock de tienda y almacén;
- diferenciación entre producto inexistente y fallo de conexión;
- validación de credenciales y redirección de cuentas con contraseña temporal;
- listado de ventas con alcance del servidor, filtros de deuda y estados de carga,
  vacío y error;
- detalle histórico de productos y cronología de cobros de una venta;
- armado de una venta, total derivado, deuda asociada a cliente y confirmación de
  borrador con identificador UUID v7 idempotente;
- registro posterior de pagos y entregas con límites de saldo o reserva, permisos
  por cuenta y claves idempotentes enviadas al backend.

Cada nueva vertical debe agregar pruebas alrededor de sus decisiones y estados de
mayor riesgo. No se persigue una cifra global aislada: una línea cubierta sin una
afirmación observable no constituye evidencia suficiente.

## Ejecución

Desde la raíz del monorepo:

```bash
pnpm test:web
pnpm --filter @nova/web test:watch
pnpm --filter @nova/web test:coverage
```

`pnpm test` ejecuta las suites de todos los paquetes que declaran pruebas. El
chequeo general conserva formato, lint, tipos, arquitectura backend y pruebas.

## Convenciones

- Los datos reutilizables viven en archivos `*.test-fixtures.ts` junto a la feature.
- La configuración global se limita a limpieza del DOM y matchers compartidos.
- Cada prueba crea su propio `QueryClient` para impedir contaminación entre casos.
- Los errores HTTP usan respuestas equivalentes a Problem Details.
- Los flujos completos se revisan manualmente en móvil y escritorio mientras no
  exista evidencia suficiente para reconsiderar una herramienta E2E.
