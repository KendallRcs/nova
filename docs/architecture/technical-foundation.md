# Base técnica del monorepo

**Estado:** Confirmada el 2026-08-24.

**Investigación verificada:** 2026-08-24.

Esta propuesta selecciona una base estable para crear Nova sin introducir
herramientas que todavía no aportan valor. Las versiones exactas de parche se
bloquearán en el primer `package.json` y lockfile; este documento define las ramas
mayores que deben utilizarse.

## Stack recomendado

| Área | Elección | Motivo |
| --- | --- | --- |
| Runtime | Node.js 24 LTS | Rama LTS vigente, compatible con Next, Nest y Prisma; Node 26 continúa como Current. |
| Lenguaje | TypeScript 5.x estricto | Requisito común del stack y protección necesaria para dominio y contratos. |
| Gestor | pnpm 11 estable | Workspaces nativos, instalación eficiente y compatibilidad con Node 24. Se evita pnpm 12 mientras siga RC. |
| Monorepo | pnpm workspaces, sin Turborepo inicialmente | Dos aplicaciones y ningún paquete compartido aún no justifican otra capa de orquestación. |
| Frontend | Next.js 16.3, App Router, React 19 | Rama estable actual; frontend desplegable como servidor Node independiente. |
| Backend | NestJS 11 con Express 5 | Nest 11 es la rama estable documentada; Express es el adaptador predeterminado y suficiente para el volumen previsto. |
| ORM | Prisma ORM 7 | Rama recomendada para producción; Prisma 8 continúa en Early Access. |
| Base de datos | PostgreSQL 18 | Mayor estable actual con soporte hasta 2030. |
| Desarrollo local | Aplicaciones locales + PostgreSQL 18 en Docker Compose | Iteración rápida en TypeScript y paridad reproducible de base. |
| Producción | Frontend y backend construidos/desplegados por separado | Respeta el ADR-0002 y permite actualizar o escalar cada aplicación de forma independiente. |

No se instala `latest` sin registrar el resultado. Al crear el esqueleto se fijan
versiones exactas compatibles y el campo `packageManager` fija pnpm. La versión de
Node se conserva mediante un archivo reconocido por gestores de runtime y el campo
`engines`.

## Evidencia de compatibilidad

- Node recomienda producción sobre ramas LTS; al 2026-08-24 Node 24 es LTS y Node
  26 permanece Current.
- Next.js 16 requiere como mínimo Node 20.9 y TypeScript 5.1; Node 24 satisface
  ambos requisitos.
- NestJS 11 requiere Node 20 o superior y recomienda la LTS más reciente.
- Prisma 7 admite Node 24 y es la versión recomendada para producción mientras
  Prisma 8 continúa en desarrollo/EA.
- pnpm 11 requiere Node 22 o superior y soporta Node 24.
- PostgreSQL 18 recibe soporte comunitario hasta noviembre de 2030.

## Decisiones de simplicidad

### pnpm sin Turborepo

pnpm ya proporciona workspaces, resolución local explícita mediante `workspace:*`
y comandos filtrados. Para dos aplicaciones, scripts raíz como los siguientes son
suficientes conceptualmente:

```text
pnpm --filter @nova/web dev
pnpm --filter @nova/api dev
pnpm -r build
pnpm -r test
```

Turborepo se evaluará cuando aparezca al menos una de estas señales:

- CI invierte tiempo significativo en repetir builds y pruebas sin cambios;
- existen varios paquetes compartidos con un grafo de tareas no trivial;
- se necesita caché remota entre desarrolladores o pipelines;
- los scripts pnpm dejan de expresar claramente dependencias entre tareas.

No introducirlo ahora mantiene menos configuración, menos conceptos para aprender
y una fuente única de verdad para la ejecución de scripts.

### Express como adaptador HTTP de Nest

Nova no tiene evidencia de que el rendimiento del adaptador HTTP sea un cuello de
botella. Express 5 es el predeterminado de NestJS 11, posee un ecosistema amplio y
reduce decisiones de integración. La aplicación dependerá de abstracciones Nest
en el borde, evitando APIs exclusivas de Express salvo necesidad explícita.

Esto mantiene abierta una migración a Fastify: los controladores y el núcleo no
deben asumir objetos `Request`/`Response` concretos para comportamiento normal.

### Prisma 7 en vez de Prisma 8 EA

Prisma 7 es la línea recomendada para producción. Prisma 8 promete cambios
importantes en schema, migraciones y extensibilidad, pero su estado actual no
justifica usarlo para la base inicial. La arquitectura hexagonal limita el costo de
una actualización futura porque Prisma permanece dentro del adaptador.

## Estructura física propuesta

```text
nova/
├── apps/
│   ├── web/                  # Next.js desplegable
│   └── api/                  # NestJS desplegable
├── docs/                     # fuentes de verdad ya existentes
├── infra/
│   └── compose.yaml          # PostgreSQL local y servicios futuros justificados
├── package.json              # scripts y herramientas raíz
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── AGENTS.md
```

No se crea inicialmente `packages/`. El ADR-0002 exige paquetes compartidos solo
cuando haya propiedad y reutilización justificadas. Si aparece un contrato público
estable, configuración reutilizable o design system real, se extraerá entonces.

Frontend y backend no comparten entidades de dominio. Compartir tipos directamente
desde `apps/api` queda prohibido; los contratos externos se diseñarán como una
frontera independiente.

## Estructura propuesta del backend

```text
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.*
├── src/
│   ├── modules/
│   │   ├── catalog/
│   │   │   ├── hexagon/
│   │   │   │   ├── domain/
│   │   │   │   └── application/
│   │   │   ├── adapters/
│   │   │   │   ├── driving/http/
│   │   │   │   └── driven/prisma/
│   │   │   └── catalog.module.ts
│   │   └── ...
│   ├── composition/
│   └── main.ts
└── test/
```

Esta estructura hace visible la frontera hexagonal sin crear un hexágono por cada
clase:

- `hexagon/domain`: TypeScript puro, invariantes y eventos;
- `hexagon/application`: capacidades y puertos necesarios;
- `adapters/driving`: HTTP, validación de wire format y traducción de respuesta;
- `adapters/driven`: Prisma, almacenamiento y servicios externos;
- archivo `*.module.ts`: composición NestJS del módulo, fuera del núcleo;
- `composition`: coordinación técnica transversal, configuración y transacciones.

Los bounded contexts siguen siendo módulos dentro de un único backend, no
microservicios ni paquetes npm independientes.

## Estructura propuesta del frontend

```text
apps/web/src/
├── app/                      # rutas, layouts y límites de Next.js
├── features/                 # capacidades de producto
├── components/               # componentes reutilizables reales
├── lib/                      # clientes y utilidades técnicas acotadas
└── styles/                   # tokens y estilos globales
```

La estructura detallada del frontend se confirmará en la fase UI/UX. Antes de
modificar código Next.js, los agentes deben leer la documentación relevante
instalada en `node_modules/next/dist/docs/`, conforme a `AGENTS.md`.

No se seleccionan todavía librería de componentes, formularios, estado cliente ni
data fetching adicional. Next.js y React ya proporcionan capacidades que deben
evaluarse antes de añadir dependencias.

## TypeScript y fronteras

Se habilita modo estricto en ambas aplicaciones. La configuración común inicial
puede vivir en el root sin convertirse de inmediato en un paquete publicable.

El backend añade verificaciones automatizadas para impedir:

- imports de NestJS, Prisma o PostgreSQL desde `hexagon/`;
- imports de adaptadores desde dominio o aplicación;
- imports directos entre internos de módulos que evadan su superficie pública;
- DTO HTTP dentro del dominio;
- acceso a Prisma desde controladores.

La herramienta concreta para verificar imports se decidirá durante el scaffolding
comparando reglas ESLint y una prueba de arquitectura dedicada.

## Dependencias iniciales mínimas

### Root

- pnpm workspace;
- TypeScript y herramientas de lint/formato cuando su configuración sea realmente
  compartida;
- scripts de build, lint, typecheck y test.

### Web

- Next.js, React y React DOM;
- TypeScript y ESLint según la configuración oficial;
- ninguna librería global de estado o UI todavía.

### API

- NestJS core, common, platform-express, reflect-metadata y RxJS;
- Prisma CLI, Prisma Client y adaptador PostgreSQL requerido por Prisma 7;
- driver PostgreSQL requerido por el adaptador;
- validación del borde, autenticación y OpenAPI después de definir sus decisiones.

No se instala una dependencia solo porque probablemente se utilice después.

## Entorno local inicial

Docker Compose ejecutará únicamente PostgreSQL 18 al principio:

- volumen nombrado y explícito;
- healthcheck;
- usuario y base exclusivos de Nova;
- puerto configurable;
- credenciales locales documentadas en `.env.example`, nunca secretos reales;
- versión de imagen fijada al minor probado, no `latest`;
- comando de reinicio no destructivo por defecto.

Frontend y backend se ejecutan localmente mediante pnpm para conservar recarga
rápida. Contenedores de aplicación se añadirán al validar builds de producción y
antes del despliegue, no como requisito para editar una línea de TypeScript.

## Calidad inicial

La primera iteración debe incluir desde el esqueleto:

- lint ejecutado explícitamente; Next.js 16 ya no lo ejecuta durante `next build`;
- typecheck separado para cada aplicación;
- pruebas unitarias del dominio y aplicación;
- pruebas de integración del adaptador Prisma con PostgreSQL real;
- pruebas de contrato HTTP del backend;
- validación manual acotada para los primeros flujos visibles, sin instalar una
  suite E2E de navegador en la etapa inicial;
- una prueba automatizada de las fronteras hexagonales.

La estrategia confirmada utiliza Vitest en el backend, Testcontainers con
PostgreSQL real, Supertest para el contrato HTTP y dependency-cruiser para las
fronteras, conforme al ADR-0012 y a la documentación de Calidad.

## Política de versiones

- Node y pnpm se fijan para reproducibilidad del entorno.
- Dependencias se instalan con versión exacta en el lockfile.
- Frontend y backend pueden actualizar dependencias de forma independiente, pero
  el lockfile del monorepo se revisa como una unidad.
- No se usan ramas canary, beta, RC o Early Access en el camino crítico.
- Actualizaciones menores/de parche requieren CI verde; mayores requieren leer
  guía de migración y evaluar ADR si cambian arquitectura o contratos.
- PostgreSQL conserva el major 18 y actualiza minors de seguridad después de
  respaldar y probar restauración/migraciones.

## Orden de scaffolding propuesto

1. Crear root pnpm con versión fijada y scripts vacíos coherentes.
2. Crear `apps/api` con NestJS 11 estricto y sin lógica de ejemplo sobrante.
3. Crear `apps/web` con Next.js 16.3, App Router y TypeScript estricto.
4. Añadir PostgreSQL 18 mediante Compose y `.env.example`.
5. Integrar Prisma 7 dentro de `apps/api` y validar una migración mínima.
6. Configurar lint, typecheck, pruebas y regla de fronteras.
7. Verificar builds independientes de web y API.
8. Implementar una primera capacidad vertical pequeña.

## Primera capacidad vertical recomendada

Comenzar con **crear y consultar categorías**, no con ventas:

- posee una regla simple de unicidad y estado;
- permite demostrar permiso administrativo;
- atraviesa controlador, capacidad, dominio, puerto, Prisma y PostgreSQL;
- habilita después la creación/importación de productos;
- permite enseñar la arquitectura hexagonal sin mezclar todavía transacciones de
  inventario, caja y costo.

Después se implementaría producto básico e importación inicial, antes de abordar
el flujo transaccional de venta.

## Decisiones pendientes de esta fase

- lint, formato y configuración TypeScript compartida;
- estrategia de pruebas específica del frontend;
- librería UUIDv7;
- configuración frontend, CSS y design system;
- proveedor de archivos y almacenamiento de comprobantes;
- CI/CD y destino de despliegue.

La aprobación de esta base confirma el stack y la estructura descritos. No
confirma las decisiones diferidas de esta sección, que se resolverán y
documentarán por separado.

## Fuentes oficiales

- [Ciclo de versiones de Node.js](https://nodejs.org/en/about/previous-releases).
- [Instalación y requisitos de Next.js](https://nextjs.org/docs/app/getting-started/installation).
- [Next.js 16.3](https://nextjs.org/blog).
- [Migración y requisitos de NestJS 11](https://docs.nestjs.com/migration-guide).
- [Requisitos de Prisma](https://docs.prisma.io/docs/orm/reference/system-requirements).
- [Prisma 7 recomendado mientras Prisma 8 evoluciona](https://www.prisma.io/blog/the-next-evolution-of-prisma-orm).
- [Soporte y versiones de PostgreSQL](https://www.postgresql.org/support/versioning/).
- [Instalación y compatibilidad de pnpm](https://pnpm.io/installation).
- [Workspaces de pnpm](https://pnpm.io/workspaces).
