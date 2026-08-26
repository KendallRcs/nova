# Base de calidad del backend

**Estado:** Confirmada el 2026-08-26.

**Investigación verificada:** 2026-08-24.

Esta base define cómo validar el borde HTTP, probar cada frontera hexagonal y
detectar dependencias prohibidas desde el inicio. El objetivo no es maximizar una
cifra de cobertura, sino obtener evidencia en la frontera correcta y proporcional
al riesgo de cada capacidad.

## Decisiones confirmadas

| Área | Elección |
| --- | --- |
| Validación HTTP | `ValidationPipe`, `class-validator` y `class-transformer` dentro del adaptador de entrada |
| Runner backend | Vitest 4.x en entorno Node |
| Pruebas HTTP | Nest testing utilities y Supertest contra la aplicación real |
| Integración Prisma | Testcontainers con PostgreSQL 18 y migraciones reales |
| Fronteras | dependency-cruiser con reglas bloqueantes en CI |
| E2E de navegador | No se incorpora en la etapa inicial; validación manual acotada de la interfaz |

Las versiones exactas se fijarán durante el scaffolding. La estrategia del
frontend se detallará en su propia fase después de leer la documentación instalada
de Next.js, como exige `AGENTS.md`.

## Validación de entrada

NestJS recomienda `ValidationPipe` con clases DTO concretas porque las interfaces
TypeScript desaparecen en runtime. Nova utilizará DTO y decoradores solamente en
`adapters/driving/http/`; el núcleo no importa `class-validator`,
`class-transformer` ni Swagger.

Configuración conceptual global:

```typescript
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  transform: false,
  validationError: { target: false, value: false },
  exceptionFactory: toProblemDetailsValidationException,
});
```

- `whitelist` y `forbidNonWhitelisted` rechazan propiedades inesperadas en vez de
  aceptarlas silenciosamente.
- `forbidUnknownValues` evita validar objetos de forma accidentalmente permisiva.
- No se activa conversión implícita global: IDs, enteros, booleanos y fechas se
  convierten con pipes o mapeadores explícitos para evitar coerciones sorpresivas.
- `target` y `value` no se exponen en errores, protegiendo datos sensibles.
- `exceptionFactory` traduce fallos al Problem Details acordado.

### Dos niveles de validación

```text
JSON no válido / tipo incorrecto ──▶ validación HTTP ──▶ 400 o 422
DTO válido pero negocio inválido ──▶ dominio/capacidad ──▶ resultado de negocio
```

El DTO comprueba forma: campos requeridos, UUID, entero seguro, longitud y formato.
El dominio comprueba significado: stock disponible, permisos, transición válida,
precio permitido o saldo pendiente. Una regla de negocio no se implementa solo en
un decorador HTTP, aunque duplicar una comprobación barata en el borde pueda
mejorar la respuesta.

Los DTO de respuesta también son explícitos. Un controlador no devuelve entidades
de dominio ni modelos Prisma; un presenter/mapeador construye la representación
OpenAPI y comprueba la conversión segura de `bigint` a céntimos JSON.

## Estrategia de pruebas hexagonales

### 1. Capacidades de aplicación — evidencia principal

Cada puerto de entrada se ejecuta directamente con fakes que implementan sus
puertos requeridos:

```text
test driver ──▶ ForCreatingCategories
                       │
                       ├── FakeCategoryRepository
                       ├── FixedClock
                       └── FixedIdGenerator
```

Estas pruebas demuestran el comportamiento completo dentro del hexágono y revisan
el estado observable de los fakes. Se prefieren fakes con memoria sobre mocks de
secuencias de llamadas. Un cambio interno no debe romper una prueba mientras el
comportamiento y los puertos permanezcan iguales.

### 2. Dominio — complemento para reglas densas

Las funciones, objetos de valor y agregados puros reciben pruebas directas para:

- transiciones de ventas, reservas y devoluciones;
- costo promedio móvil y asignación de costos;
- disponibilidad y movimientos de inventario;
- aplicaciones de pagos, saldo y finalizaciones incompletas;
- permisos y credenciales temporales.

Las tablas de decisión y escenarios Gherkin son insumos para los casos, no código
copiado mecánicamente. Los cálculos monetarios tendrán casos de borde y, cuando
aporte valor, pruebas basadas en propiedades.

### 3. Adaptadores Prisma — integración real

Los repositorios, queries, restricciones y transacciones se prueban contra
PostgreSQL 18 real levantado mediante `@testcontainers/postgresql`:

- se aplica el mismo historial de migraciones que en producción;
- no se sustituye PostgreSQL por SQLite ni por un repositorio en memoria;
- se comprueban mapeos de enums, `bigint`, UUID, timestamps y nullable;
- se prueban constraints e índices funcionales relevantes;
- concurrencia, bloqueos e idempotencia usan conexiones independientes reales;
- cada prueba parte de datos conocidos y no depende del orden de otras pruebas.

Para mantener un tiempo razonable, el contenedor se reutiliza dentro de una suite
controlada y los datos se aíslan por base/esquema o limpieza explícita. Las pruebas
de concurrencia pueden ejecutarse en un grupo serial si compiten deliberadamente
por filas; no se vuelve serial todo el conjunto sin medirlo.

Testcontainers es preferible al Compose de desarrollo para las pruebas porque el
test controla arranque, versión, puerto aleatorio y limpieza. En CI puede usarse
un servicio PostgreSQL equivalente si resulta más estable, siempre ejecutando la
misma suite y versión mayor.

### 4. Adaptador HTTP — contrato y transporte

Se inicia una aplicación Nest de prueba y Supertest la consume por HTTP. Se
verifican:

- ruta, método, código y headers;
- JSON exitoso y Problem Details;
- rechazo de campos desconocidos y tipos incorrectos;
- autenticación, permisos, cookie, CORS y CSRF;
- `Idempotency-Key` y `expectedVersion`;
- coherencia entre comportamiento y OpenAPI.

Estas pruebas no vuelven a demostrar todas las combinaciones del dominio: verifican
que el adaptador traduce correctamente una muestra representativa de resultados.

### 5. Interfaz — verificación proporcional

Nova no incorpora Playwright ni otra suite E2E de navegador durante la etapa
inicial, para reducir instalación, tiempo de ejecución y mantenimiento mientras
los flujos cambian con rapidez. La interfaz se verificará mediante una lista manual
breve por flujo terminado, además de pruebas unitarias o de componentes cliente
cuando aporten valor.

No se intentará compensar esta decisión forzando pruebas unitarias frágiles sobre
Server Components asíncronos. La estrategia frontend se definirá después de
concretar su arquitectura. Una suite E2E podrá reevaluarse si aparecen regresiones
repetidas entre web y API, varios navegadores críticos o un costo manual medible.

## Por qué Vitest en el backend

Vitest 4.x es estable, funciona con Node 24 y TypeScript moderno, posee API de
assertions, cobertura y mocks donde sean realmente necesarios. El núcleo
hexagonal no depende del runner y `@nestjs/testing` puede ejecutarse desde Vitest.

Frente a Jest, reduce la configuración ESM/TypeScript y deja abierta una herramienta
común para utilidades y componentes cliente del frontend. No se usará Browser Mode
en el backend. Si una incompatibilidad real con Nest o Prisma aparece durante el
scaffolding, se debe demostrar con una prueba mínima antes de reconsiderar Jest.

## PostgreSQL real en vez de dobles para persistencia

Un fake sirve para probar una capacidad, pero no demuestra que Prisma traduzca
correctamente ni que PostgreSQL aplique constraints, bloqueos o aislamiento. Por
eso existen ambas capas:

| Pregunta | Prueba adecuada |
| --- | --- |
| ¿La venta rechaza stock insuficiente? | capacidad con fake |
| ¿El repositorio mapea la venta completa? | integración Prisma/PostgreSQL |
| ¿Dos confirmaciones no consumen el mismo stock? | concurrencia con PostgreSQL real |
| ¿El endpoint responde el problema correcto? | contrato HTTP |
| ¿El empleado puede completar el flujo en pantalla? | checklist manual acotado en esta etapa |

## Cumplimiento de fronteras

dependency-cruiser analizará imports TypeScript y fallará con severidad `error`
ante, como mínimo:

1. imports desde `hexagon/` hacia `adapters/`, composición o módulos Nest;
2. imports de NestJS, Prisma, PostgreSQL, Swagger o validadores HTTP desde
   `hexagon/`;
3. imports desde `domain/` hacia `application/`;
4. imports directos entre internos de módulos sin atravesar una superficie pública
   expresamente definida;
5. imports desde producción hacia fakes, fixtures o archivos de pruebas;
6. ciclos entre módulos o capas.

Las reglas se complementan con una prueba pequeña que escanea los `package.json`
y asegura que el núcleo no declare dependencias de infraestructura. ESLint seguirá
atendiendo calidad local del código; dependency-cruiser será la fuente de verdad
para el grafo arquitectónico porque permite reglas de rutas y dependencias
transitivas con mensajes propios.

No se agregan excepciones silenciosas. Una excepción temporal debe indicar ruta,
motivo, responsable y condición de eliminación; una excepción permanente que
cambie la arquitectura exige revisar documentación o ADR.

## Política de cobertura y regresión

Nova no fijará inicialmente un porcentaje global arbitrario. Un 90 % puede ocultar
que la confirmación de una venta nunca fue probada y castigar, a la vez, mapeadores
triviales.

En su lugar, una capacidad no se considera terminada sin:

- escenarios felices y rechazos relevantes de sus criterios de aceptación;
- invariantes y transiciones modificadas cubiertas;
- fake para cada puerto requerido nuevo;
- prueba de integración para cada comportamiento nuevo del adaptador;
- prueba HTTP cuando cambia el contrato;
- prueba de regresión que falla antes del arreglo de cada defecto confirmado.

La cobertura de líneas y ramas se recopila como señal de revisión y tendencia. Un
umbral podrá fijarse después de observar la primera vertical, sin sustituir los
criterios anteriores.

## Ejecución y CI

Scripts conceptuales del API:

```text
test:unit           dominio y capacidades con fakes
test:integration    Prisma y PostgreSQL real
test:contract       Nest + Supertest + OpenAPI
test:architecture   dependency-cruiser y reglas adicionales
test                unitarias, integración, contrato y arquitectura
```

En CI, lint, typecheck, arquitectura y unitarias pueden ejecutarse en paralelo. Las
pruebas de integración esperan PostgreSQL y aplican migraciones; contrato puede
reutilizar ese servicio cuando el caso lo necesite. No existe un job E2E de
navegador en la etapa inicial.

## Primer corte para categorías

La primera vertical recomendada demostrará la estrategia completa:

- dominio: nombre normalizado, unicidad expresada como resultado y estado;
- aplicación: crear y consultar categorías mediante puertos de capacidad;
- fake: repositorio en memoria;
- Prisma: round-trip y constraint única con PostgreSQL real;
- HTTP: administrador autorizado, empleado rechazado y Problem Details;
- arquitectura: ningún import de framework dentro de `hexagon/`;
- OpenAPI: request, response y errores documentados.

Cuando exista una interfaz visible, el flujo de administración de categorías se
revisará con un checklist manual corto que confirme autorización, creación,
consulta y presentación de errores.

## Decisiones diferidas

- versión exacta de Vitest, Supertest, Testcontainers y dependency-cruiser;
- librería opcional de property-based testing;
- estrategia final de cobertura y mutation testing;
- configuración de pruebas frontend y React Testing Library;
- servicio PostgreSQL concreto del proveedor CI;
- pruebas E2E de navegador, visuales y de accesibilidad, que podrán reevaluarse en
  UI/UX y Calidad frontend si su beneficio supera el costo de mantenimiento.

## Fuentes oficiales

- [Validación en NestJS](https://docs.nestjs.com/techniques/validation).
- [Vitest 4](https://vitest.dev/blog/vitest-4).
- [Testcontainers PostgreSQL para Node.js](https://node.testcontainers.org/modules/postgresql/).
- [Pruebas de integración con Prisma](https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing).
- [Reglas de dependency-cruiser](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md).
- [Pruebas en Next.js y límite de Server Components asíncronos](https://nextjs.org/docs/app/guides/testing).
