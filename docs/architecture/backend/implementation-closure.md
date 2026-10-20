# Cierre de implementación del backend MVP

**Estado:** cerrado el 2026-10-19.

## Resultado

El backend funcional definido para el MVP está implementado. La auditoría contrastó
las 56 historias y 125 escenarios de `docs/requirements/` con casos de uso, puertos,
adaptadores Prisma y Cloudinary, controladores HTTP, permisos, migraciones y pruebas.
Durante el cierre se detectó y corrigió la única brecha de contrato: la consulta
individual de un producto activo.

Este cierre significa que el frontend puede comenzar a consumir una API funcional
y versionada. No significa que el sistema esté preparado todavía para producción:
despliegue, copias de seguridad, observabilidad y endurecimiento de infraestructura
pertenecen a la fase de Operaciones.

## Cobertura funcional

| Capacidad | Historias | Implementación principal |
| --- | --- | --- |
| Identidad y acceso | AUTH-001 a AUTH-005, IAM-001 a IAM-002 | sesiones opacas, contraseñas, cuentas, perfiles y permisos |
| Catálogo | PROD-001 a PROD-007 | productos, precios, imágenes, categorías y etiquetas |
| Inventario | INV-001 a INV-008 | posiciones, traslados, bajas, ajustes, revisión e historial |
| Clientes | CUS-001 a CUS-004 | identidad, datos opcionales, cuenta consolidada y fusiones |
| Ventas y cobros | SAL-001 a SAL-009, PAY-001 a PAY-005 | borradores, confirmación, reservas, entregas, pagos, ajustes, cierres y cancelación |
| Devoluciones | RET-001 a RET-003 | devolución comercial, retorno físico, reembolso y permisos |
| Compras | PUR-001 a PUR-005 | proveedores, anticipos, resoluciones, compras e historial |
| Finanzas | EXP-001 a EXP-003, DASH-001 a DASH-004 | gastos, comprobantes protegidos, caja, resultado y desempeño |
| Inicialización | DATA-001 | plantilla, validación y confirmación atómica de la carga inicial |

## Arquitectura comprobada

- Los módulos se alinean con capacidades del dominio y conservan `hexagon/`,
  adaptadores de entrada/salida y composición NestJS explícita.
- `hexagon/` no depende de NestJS, Prisma, PostgreSQL, HTTP ni Cloudinary; la puerta
  de arquitectura lo verifica automáticamente.
- Las escrituras financieras o de stock son transaccionales e idempotentes; las
  mutaciones concurrentes relevantes usan versiones observadas y/o bloqueos.
- Las vistas que cruzan agregados usan CQRS-lite sin introducir un bus ni otro
  despliegue.
- Los costos y comprobantes están protegidos por capacidades específicas; el
  catálogo operativo no expone margen ni costo al empleado.

## Contrato disponible para el frontend

- REST/JSON bajo `/api/v1`, OpenAPI en desarrollo y Problem Details para errores.
- Autenticación mediante cookie HttpOnly, CORS con credenciales y protección CSRF
  para operaciones mutables.
- Paginación por cursor en listados crecientes y `Idempotency-Key` en operaciones
  con efectos monetarios o de inventario.
- Importes en céntimos enteros, instantes UTC y fechas civiles independientes.
- Endpoint de salud en `/health` y configuración validada al arrancar.

La lista y semántica vigentes de endpoints se mantienen en
[Contratos HTTP](http-api-contracts.md).

## Evidencia de calidad al cierre

La puerta rápida verifica formato, lint, tipos, fronteras hexagonales y pruebas
unitarias. Las suites de contrato levantan aplicaciones Nest aisladas con Supertest;
las de integración aplican las migraciones sobre PostgreSQL real mediante
Testcontainers.

Los comandos de cierre son:

```bash
pnpm check
pnpm --filter @nova/api test:contract
pnpm --filter @nova/api test:integration
pnpm build
```

Los conteos exactos pueden crecer después de este cierre; no se usan como sustituto
de la cobertura por riesgo y frontera definida en Calidad.

## Alcance que permanece deliberadamente fuera del cierre

- interfaz web, flujos visuales, accesibilidad y pruebas de frontend;
- perfiles personalizados distintos de Administrador y Empleado;
- FIFO o reconstrucción histórica de lotes;
- importación habitual desde Excel o importación de ventas históricas;
- pagarés, efectos legales, cuotas rígidas o recargos automáticos;
- CI/CD, proxy y dominio de producción, observabilidad, backups y restauración;
- MFA y administración visual de sesiones por dispositivo;
- pruebas E2E de navegador, excluidas por ADR-0012 y por decisión del proyecto.

Cloudinary solo es necesario para ejecutar las capacidades opcionales de imágenes y
comprobantes. Su credencial real, al igual que los secretos y URLs de producción,
no forma parte del repositorio.

## Criterio de salida

La siguiente fase puede diseñar y construir el frontend sin inventar reglas del
negocio ni acceder a tablas. Si durante esa fase aparece una necesidad nueva, se
actualizarán primero la historia o regla correspondiente y, si cambia una decisión
costosa, su ADR.
