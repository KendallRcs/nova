# Arquitectura de la aplicación web

**Estado:** confirmada para el MVP.

## Objetivo

Mantener una interfaz rápida para el trabajo cotidiano sin trasladar reglas de
negocio al navegador. Next.js compone navegación y presentación; la API REST sigue
siendo la fuente autoritativa de sesión, permisos, inventario, ventas y finanzas.

## Estructura física

```text
apps/web/src/
├── app/                       # rutas, layouts y límites Next.js
│   ├── (auth)/                # acceso y contraseña temporal
│   └── (workspace)/           # shell autenticado y rutas del negocio
├── features/                  # capacidades verticales
│   ├── auth/
│   ├── inventory/
│   ├── sales/
│   ├── customers/
│   ├── catalog/
│   ├── procurement/
│   ├── expenses/
│   ├── analytics/
│   └── users/
├── shared/
│   ├── api/                   # transporte, tipos generados y Problem Details
│   ├── auth/                  # sesión y comprobación visual de capacidades
│   ├── ui/                    # primitivas reutilizadas y accesibles
│   ├── lib/                   # formato PEN, fecha Lima y utilidades puras
│   └── styles/                # tokens y estilos globales
└── test/                      # soporte compartido para pruebas
```

Una feature puede contener `api/`, `model/`, `ui/` y `lib/` cuando los necesite; no
se crean carpetas vacías para cumplir una plantilla. Las rutas importan la
superficie pública de una feature y no sus internos arbitrariamente.

## Fronteras

```text
Ruta Next.js
    ↓ compone
Feature de producto
    ↓ usa
Cliente REST compartido ──→ API /api/v1
    ↓ traduce
Problem Details / sesión / conflicto / idempotencia
```

- `app/` no contiene reglas de dominio ni llamadas `fetch` dispersas.
- `features/` conoce términos y flujos de negocio, pero no Prisma ni entidades
  internas del backend.
- `shared/api/` conoce HTTP, credenciales, CSRF, OpenAPI y Problem Details; no toma
  decisiones de producto.
- `shared/ui/` no importa features.
- Una feature no importa internos de otra. La coordinación se hace desde la ruta o
  mediante superficies públicas pequeñas.

## Render y acceso al API

- Layouts, ayuda y estructura no interactiva permanecen como Server Components.
- Las superficies autenticadas que consultan, mutan o se actualizan durante el
  trabajo usan Client Components acotados.
- El navegador llama directamente al API con credenciales incluidas.
- No se crean Route Handlers o Server Actions como espejo de cada endpoint.
- Un BFF solo se reconsidera ante una necesidad demostrada de agregación, secretos
  exclusivamente server-side o incompatibilidad de despliegue que no deba resolver
  el API.

El despliegue debe mantener web y API bajo contextos compatibles con la política de
cookie confirmada. Los dominios concretos siguen diferidos hasta la fase de
operaciones.

## Contrato y transporte

Los tipos de request y response se generan desde el documento OpenAPI publicado
por NestJS. El código generado pertenece al frontend y no se edita a mano. Nunca se
importan DTO, entidades o módulos desde `apps/api`.

El cliente compartido es responsable de:

- prefijo y URL base por entorno;
- `credentials: include`;
- token CSRF en métodos no seguros;
- `Idempotency-Key` estable durante reintentos de una misma intención;
- `Accept` y `Content-Type` correctos;
- traducción tipada de `application/problem+json`;
- correlación diagnóstica cuando el API la exponga;
- tratamiento uniforme de `401`, `403`, `409`, `422` y `429`.

Las features traducen esos problemas técnicos a mensajes y recuperaciones del
flujo específico conforme a la documentación UI/UX.

## Propiedad del estado

| Estado | Propietario | Ejemplos |
| --- | --- | --- |
| Remoto | TanStack Query | productos, disponibilidad, clientes, ventas, reportes |
| Formulario | React Hook Form | venta en curso, compra, gasto, pago |
| Navegable | URL de Next.js | búsqueda, filtros, página, identificador seleccionado |
| Visual local | `useState` o `useReducer` | menú abierto, paso visible, confirmación local |
| Sesión pública | consulta de `/auth/me` | actor, perfil y capacidades |
| Regla de negocio | backend | autorización, stock, saldo, costo, cierre e idempotencia |

No se añade Zustand, Redux ni un equivalente en el MVP inicial. Un estado no debe
copiarse desde TanStack Query hacia un store para facilitar su lectura: se consume
desde su consulta o se convierte deliberadamente en borrador de formulario.

### Venta multipaso

La venta móvil usa una sola ruta y un único formulario provisto mediante
`FormProvider`. Cambiar de paso no desmonta el borrador. Cuando el borrador se
persiste en el backend pasa a ser un recurso remoto versionado; el formulario
mantiene únicamente los cambios todavía no confirmados.

### Criterios para reevaluar un store local

Se evaluará un gestor dedicado solo si aparece al menos una necesidad repetida que
no pueda expresarse limpiamente mediante servidor, URL, formulario o árbol React:

- edición cliente compleja compartida entre rutas simultáneas;
- historial `undo/redo` transversal;
- eventos locales de alta frecuencia entre ramas distantes;
- estado persistente offline, si ese alcance se aprueba en el futuro;
- Context provoca renders o acoplamiento medidos y no corregibles con composición.

La reevaluación requiere un ADR; la popularidad de una librería no es evidencia.

## Formularios y mutaciones

- React Hook Form administra campos, arreglos dinámicos, errores y foco.
- La validación cliente mejora la respuesta inmediata, pero no reemplaza al `422`
  del API.
- Al enviar se desactiva la acción equivalente para impedir doble intención.
- Las escrituras financieras o de inventario no se reintentan automáticamente.
- Una respuesta incierta conserva la clave de idempotencia; una intención editada
  genera una nueva.
- Una mutación exitosa actualiza o invalida únicamente las consultas afectadas.
- Un `409` conserva el borrador, obtiene la versión vigente y pide revisión.

## Estilos y componentes

- CSS Modules encapsula estilos de componente sin dependencia adicional.
- `shared/styles` declara tokens globales de color, tipografía, espacio, radios,
  elevación, movimiento y puntos de adaptación.
- No se adopta Tailwind ni una librería de componentes en el MVP inicial.
- Las primitivas propias priorizan semántica HTML, foco visible, teclado, lectores
  de pantalla y objetivos táctiles de 44 píxeles.
- `DESIGN.md` se extraerá del sistema visual probado tras construir la primera
  vertical, conforme al plan UI/UX.

## Pruebas

- Vitest verifica utilidades, adaptadores de Problem Details y estado de features.
- Testing Library verifica componentes desde acciones y resultados observables.
- Las llamadas HTTP se simulan en la frontera del cliente, no dentro de cada
  componente.
- Se prueban carga, vacío, validación, permisos, sesión vencida y conflictos.
- Playwright permanece fuera del alcance por decisión confirmada; los flujos
  visibles iniciales se validan manualmente en móvil y escritorio.

## Dependencias previstas

La implementación requerirá aprobación manual de instalación para:

- `@tanstack/react-query`;
- `react-hook-form`;
- `openapi-fetch`;
- `openapi-typescript` como herramienta de desarrollo;
- Vitest y Testing Library para la base de pruebas frontend.

No se instala ninguna dependencia hasta indicar al propietario el comando exacto.
