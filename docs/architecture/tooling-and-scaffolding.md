# Herramientas de código y plan de scaffolding

**Estado:** Confirmada el 2026-08-26.

**Investigación verificada:** 2026-08-26.

Esta propuesta cierra lint, formato, configuración TypeScript y el orden exacto
para crear el monorepo ejecutable. Todavía no instala dependencias ni genera las
aplicaciones.

## Selección confirmada

| Área                    | Elección                                                               |
| ----------------------- | ---------------------------------------------------------------------- |
| TypeScript              | 5.9 estable, una sola versión exacta para el workspace                 |
| Lint                    | ESLint 9.39.5 mediante CLI y flat config                               |
| TypeScript lint         | versión estable de `typescript-eslint`, con typed linting              |
| Next.js lint            | `eslint-config-next/core-web-vitals` y `eslint-config-next/typescript` |
| Formato                 | Prettier 3.9 exacto                                                    |
| Arquitectura            | dependency-cruiser, ya confirmado por ADR-0012                         |
| Configuración de editor | `.editorconfig` mínimo                                                 |
| Hooks Git               | ninguno inicialmente                                                   |

ESLint 9 utiliza flat config y es compatible con Node 24. Next.js 16 eliminó
`next lint` y el lint dentro de `next build`, por lo que Nova ejecutará ESLint
directamente y conservará `lint` como paso independiente y obligatorio.

## Responsabilidades sin solapamientos

```text
TypeScript          tipos y errores de compilación
ESLint              defectos y prácticas peligrosas
dependency-cruiser  dirección de dependencias y fronteras
Prettier            formato mecánico
```

- ESLint no reemplaza `tsc --noEmit`.
- Prettier no se ejecuta como regla de ESLint.
- dependency-cruiser es la fuente de verdad del grafo hexagonal.
- No se añaden reglas de estilo a ESLint si Prettier ya decide ese formato.
- `eslint-config-prettier` se aplica al final para desactivar reglas incompatibles.
- No se instala `eslint-plugin-prettier`: mezclar ambos procesos vuelve el lint más
  lento y produce errores de formato poco claros.

## TypeScript compartido

El root tendrá `tsconfig.base.json` con garantías comunes, pero no intentará
forzar el mismo sistema de módulos o librerías a Next.js y NestJS:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

### Motivo de las opciones adicionales

- `noUncheckedIndexedAccess`: leer un índice o clave puede producir ausencia; es
  relevante para líneas de venta, mapas y resultados agrupados.
- `exactOptionalPropertyTypes`: distingue un campo omitido de un campo presente
  con `undefined`, importante en actualizaciones parciales y DTO.
- `noImplicitOverride`: evita reemplazar accidentalmente comportamiento heredado
  en clases de adaptadores o framework.
- `noImplicitReturns` y `noFallthroughCasesInSwitch`: obligan a tratar resultados
  y estados de negocio de forma completa.
- `skipLibCheck`: evita gastar tiempo revisando declaraciones de terceros; el
  código de Nova sigue comprobándose estrictamente.

No se activa `allowJs`. `noEmit`, `module`, `moduleResolution`, `jsx`, `lib`,
decoradores y rutas pertenecen a cada aplicación porque sus hosts son diferentes.

### API NestJS

`apps/api/tsconfig.json` extiende la base y conserva inicialmente el sistema de
módulos soportado por el scaffold oficial de NestJS 11. No se fuerza una migración
a ESM durante la creación del proyecto: Prisma permanece detrás del adaptador y
la modernización del host puede evaluarse cuando exista un beneficio concreto.

Se habilitan los metadatos/decoradores requeridos exclusivamente por NestJS en el
host y los adaptadores. Que el compilador los permita no autoriza su uso dentro de
`hexagon/`; dependency-cruiser y las revisiones protegen esa frontera.

No se crean aliases TypeScript para el API inicialmente. Los imports relativos
dentro de un módulo y las superficies públicas explícitas evitan configurar
resolución distinta para Node, Vitest, Nest y dependency-cruiser. Se añadirá un
alias solo si la profundidad real perjudica la lectura y todas las herramientas
pueden resolverlo de la misma manera.

### Web Next.js

`apps/web/tsconfig.json` será generado por Next.js 16 y extenderá las garantías
compatibles de la base sin borrar opciones administradas por el framework. Podrá
usar `@/*` hacia `apps/web/src/*`, porque Next.js soporta ese alias de forma nativa
y no atraviesa la frontera entre aplicaciones.

Antes de crear o modificar archivos Next.js se leerán las guías correspondientes
instaladas en `node_modules/next/dist/docs/`, conforme a `AGENTS.md`.

En Next.js 16.3 se configura `experimental.useTypeScriptCli: false`. Con Node
24.20, el comprobador CLI predeterminado finaliza con éxito pero Next.js pierde
la salida capturada de `tsc --showConfig`; la API de TypeScript 5.9 realiza la
misma comprobación completa durante `next build`. No se desactivan ni se ignoran
errores de tipos.

## ESLint flat config

El root tendrá un `eslint.config.mjs` explícito, organizado por patrones:

1. ignores generados (`.next`, `dist`, `coverage`, cliente Prisma y artefactos);
2. reglas recomendadas de JavaScript;
3. reglas `strictTypeChecked` y `stylisticTypeChecked` de typescript-eslint para
   fuentes TypeScript, con `projectService`;
4. configuración Next.js únicamente para `apps/web`;
5. excepciones justificadas para configuración, migraciones y pruebas;
6. `eslint-config-prettier` al final.

Las reglas tipadas detectan promesas ignoradas, condiciones innecesarias y usos
inseguros que el compilador por sí solo no siempre señala. Se aplicarán primero al
código fuente; si el costo en archivos de configuración no compensa, esos archivos
usan una configuración sin información de tipos en vez de desactivar la seguridad
del producto entero.

### Reglas de intención iniciales

- promesas flotantes y funciones async mal utilizadas: error;
- `any` explícito: error salvo adaptación documentada en un borde externo;
- variables no usadas: error, admitiendo prefijo `_` solo para parámetros
  exigidos por una firma;
- imports solo de tipos cuando corresponda: error con autofix;
- `switch` sobre uniones discriminadas: exhaustividad verificada;
- comentarios `@ts-ignore`: prohibidos; `@ts-expect-error` exige descripción;
- `console`: permitido únicamente en bootstrap/scripts acotados; la aplicación
  usa la estrategia de telemetría que se defina;
- ciclos y dependencias entre capas: no se duplican aquí, los comprueba
  dependency-cruiser.

Las configuraciones recomendadas pueden cambiar entre versiones. Al fijar la
versión se guardará el resultado y cualquier override tendrá un comentario que
explique el problema real que resuelve.

## Prettier y archivos de texto

Prettier 3.9 se fija sin rango, como recomienda su propio proyecto. Una sola
configuración root formatea TypeScript, JavaScript, JSON, YAML y CSS.

Los documentos Markdown se mantienen fuera del formateo automático: son fuentes
de verdad extensas y una actualización mecánica global ocultaría cambios
semánticos en revisiones. Su estructura se revisa editorialmente; Prettier cubre
código y configuración mantenidos a mano. `next-env.d.ts` y `*.tsbuildinfo` también
se excluyen por ser artefactos generados.

Configuración inicial deliberadamente pequeña:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

No se personaliza cada detalle. `.prettierignore` excluye lockfile, código
generado, builds, cobertura, imágenes y adjuntos. Los comandos son separados:

```text
format        prettier --write .
format:check  prettier --check .
```

El formato automático modifica archivos, por lo que CI usa solamente
`format:check`.

## EditorConfig

`.editorconfig` conservará UTF-8, LF, salto final y espacios. TypeScript,
JavaScript, JSON, YAML y Markdown usarán dos espacios; no se usarán reglas complejas
que compitan con Prettier.

## Scripts del monorepo

El `package.json` root será privado y actuará como punto de entrada. Los scripts
conceptuales son:

```text
dev:web              pnpm --filter @nova/web dev
dev:api              pnpm --filter @nova/api dev
build                pnpm -r build
lint                 eslint .
lint:fix             eslint . --fix
format               prettier --write .
format:check         prettier --check .
typecheck            pnpm -r typecheck
test                 pnpm --filter @nova/api test
test:architecture    dependency-cruiser sobre apps/api/src
check                lint + format:check + typecheck + test:architecture + pruebas rápidas
```

No se crea inicialmente un script que arranque dos procesos con una dependencia
adicional. Para trabajar se pueden abrir dos terminales; si se vuelve molesto se
añadirá una herramienta pequeña con ese propósito.

`check` no ejecuta una operación que reescriba archivos. Las integraciones con
PostgreSQL pueden tener un script separado por su mayor costo y requisito Docker,
pero son obligatorias antes de integrar cambios que afecten persistencia.

## Sin hooks Git inicialmente

No se instalan Husky, lint-staged ni commitlint en el primer scaffolding:

- duplican configuración antes de existir un flujo de equipo;
- los hooks pueden omitirse y no sustituyen CI;
- `lint:fix` y `format` siguen disponibles voluntariamente;
- los comandos obligatorios vivirán en `check` y posteriormente en CI.

Se reevaluarán si el repositorio acumula commits con fallos triviales o se
incorporan más colaboradores.

## Plan exacto de scaffolding

### Paso 0 — preservar y medir

1. Confirmar que el worktree contiene documentación del usuario y no sobrescribirla.
2. Registrar versiones instaladas de Node, Corepack/pnpm, Docker y Compose.
3. Resolver las versiones de parche estables compatibles y documentarlas antes de
   escribir el lockfile.

### Paso 1 — raíz reproducible

1. Crear `package.json` privado con `packageManager`, `engines` y scripts.
2. Crear `pnpm-workspace.yaml` limitado a `apps/*` y futuros `packages/*`.
3. Fijar Node 24 mediante `.nvmrc` y/o archivo compatible con el entorno elegido.
4. Añadir `.editorconfig`, `.gitignore`, `.prettierrc.json` y
   `.prettierignore`.
5. Crear `tsconfig.base.json`.

### Paso 2 — API NestJS

1. Generar NestJS 11 en un directorio temporal o mediante CLI sin inicializar Git.
2. Mover únicamente el scaffold necesario a `apps/api`.
3. Nombrar el paquete `@nova/api`, eliminar controlador/servicio de ejemplo y
   conservar un health endpoint mínimo fuera de los módulos de negocio.
4. Ajustar `tsconfig`, scripts de build/typecheck y Vitest.
5. Crear el esqueleto `modules/`, `composition/` y una prueba de arranque.

### Paso 3 — web Next.js

1. Instalar la versión Next.js confirmada y leer sus guías locales.
2. Generar `apps/web` con TypeScript, App Router, `src/`, ESLint y sin opciones de
   UI todavía no decididas.
3. Nombrar el paquete `@nova/web` y retirar contenido visual de demostración.
4. Conservar un layout y página mínimos que permitan validar el build.
5. Añadir scripts separados de build, lint y typecheck.

La decisión sobre Tailwind u otra estrategia CSS no se toma accidentalmente en el
CLI: se responde “no” hasta cerrar arquitectura frontend y design system.

### Paso 4 — herramientas comunes

1. Instalar TypeScript 5.9, ESLint 9.39.5, typescript-eslint, Prettier 3.9 y configs
   compatibles con versiones exactas.
2. Crear el flat config root y comprobar archivos de ambas aplicaciones.
3. Configurar dependency-cruiser con las prohibiciones del documento de Calidad.
4. Ejecutar formato una sola vez sobre el scaffold nuevo y revisar el diff.
5. Hacer pasar `format:check`, `lint`, `typecheck` y `test:architecture`.

### Paso 5 — PostgreSQL y Prisma

1. Crear `infra/compose.yaml` con PostgreSQL 18 fijado, healthcheck y volumen.
2. Añadir `.env.example` sin secretos y validación de configuración al arrancar.
3. Instalar Prisma 7 y su adaptador PostgreSQL dentro de `apps/api`.
4. Crear el schema base a partir del mapeo ya confirmado, sin inventar decisiones
   diferidas.
5. Generar y revisar la primera migración; nunca usar `db push` como historia de
   producción.
6. Añadir Testcontainers y demostrar una migración/prueba de integración mínima.

### Paso 6 — contrato y seguridad transversal

1. Configurar prefijo/versionado `/api/v1` y OpenAPI.
2. Añadir ValidationPipe y Problem Details.
3. Preparar correlation ID, idempotencia y configuración segura sin desarrollar
   aún toda la autenticación.
4. Verificar con Supertest el health endpoint y un error de validación.

### Paso 7 — puerta de calidad

Ejecutar y documentar resultados de:

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:architecture
pnpm --filter @nova/api test
pnpm --filter @nova/api test:integration
pnpm build
```

No se considera terminado el scaffolding si alguno falla o si web/API solo pueden
construirse juntos.

### Paso 8 — primera vertical

Implementar crear y consultar categorías atravesando dominio, aplicación, puerto,
fake, Prisma, HTTP y OpenAPI. La interfaz visible se incorpora después de demostrar
el backend vertical; se verifica manualmente conforme al ADR-0012.

## Entregables del scaffolding

- monorepo instalable mediante un solo `pnpm install`;
- web y API construibles y ejecutables por separado;
- PostgreSQL local reproducible;
- primera migración revisada;
- OpenAPI accesible en desarrollo;
- pruebas unitarias, de integración y contrato ejecutables;
- fronteras hexagonales bloqueantes;
- comandos de calidad documentados;
- ninguna dependencia UI, E2E o de orquestación no aprobada.

## Decisiones que permanecen abiertas

- CSS, componentes, formularios y estado del frontend;
- proveedor de archivos/comprobantes;
- librería UUIDv7;
- mecanismo exacto de CSRF, rotación de sesión y rate limiting;
- CI/CD y proveedor de despliegue;
- observabilidad y política de logs;
- estrategia de pruebas frontend más allá de la revisión manual inicial.

## Registro de la decisión

El ADR-0013 registra ESLint 9.39.5 con flat config, Prettier separado, TypeScript 5.9
estricto y scripts root como puerta de calidad. Los detalles triviales de formato
permanecen en este estándar y no en el ADR.

## Fuentes oficiales

- [ESLint 10 y eliminación de eslintrc](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/).
- [Compatibilidad de typescript-eslint](https://typescript-eslint.io/users/dependency-versions/).
- [Configuraciones de typescript-eslint](https://typescript-eslint.io/rules/).
- [TypeScript 5.9](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html).
- [TypeScript `exactOptionalPropertyTypes`](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html).
- [ESLint en Next.js 16](https://nextjs.org/docs/app/api-reference/config/eslint).
- [Prettier 3.9](https://prettier.io/blog/2026/06/27/3.9.0.html).
