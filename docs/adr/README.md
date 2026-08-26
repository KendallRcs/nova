# Architecture Decision Records

| ADR | Título | Estado | Fecha |
| --- | --- | --- | --- |
| [0001](0001-adopt-hexagonal-backend.md) | Adoptar arquitectura hexagonal en el backend | accepted | 2026-08-07 |
| [0002](0002-use-monorepo.md) | Organizar Nova como monorepo | accepted | 2026-08-07 |
| [0003](0003-use-time-ordered-uuids.md) | Usar UUID ordenables para identidades persistentes | accepted | 2026-08-23 |
| [0004](0004-store-money-as-integer-cents.md) | Representar dinero transaccional mediante céntimos enteros | accepted | 2026-08-23 |
| [0005](0005-use-global-moving-average-cost.md) | Usar costo promedio móvil global por producto | accepted | 2026-08-23 |
| [0006](0006-use-hybrid-concurrency-control.md) | Usar control de concurrencia híbrido en el borde hexagonal | accepted | 2026-08-24 |
| [0007](0007-use-postgresql-enums-for-closed-vocabularies.md) | Usar enums PostgreSQL para vocabularios cerrados | accepted | 2026-08-24 |
| [0008](0008-adopt-stable-typescript-stack.md) | Adoptar una base TypeScript estable para el monorepo | accepted | 2026-08-24 |
| [0009](0009-use-pnpm-workspaces-without-task-orchestrator.md) | Usar pnpm workspaces sin orquestador de tareas inicialmente | accepted | 2026-08-24 |
| [0010](0010-use-versioned-rest-api-with-openapi.md) | Exponer una API REST versionada y documentada con OpenAPI | accepted | 2026-08-24 |
| [0011](0011-use-server-side-opaque-sessions.md) | Usar sesiones opacas persistidas en el servidor | accepted | 2026-08-24 |
| [0012](0012-test-backend-boundaries-without-browser-e2e.md) | Verificar el backend por fronteras sin E2E de navegador inicialmente | accepted | 2026-08-26 |

Los ADR registran decisiones costosas de revertir. Una decisión reemplazada no se elimina: cambia a `superseded` y enlaza su reemplazo.
