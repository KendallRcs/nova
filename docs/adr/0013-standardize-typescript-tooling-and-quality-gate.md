# ADR-0013: Estandarizar herramientas TypeScript y puerta de calidad

**Date**: 2026-08-26
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

Nova necesita criterios reproducibles para dos aplicaciones TypeScript sin
confundir compilación, lint, formato y reglas arquitectónicas. Next.js 16 ya no
ejecuta lint durante el build y ESLint 10 eliminó la configuración heredada, por
lo que el monorepo debe declarar explícitamente su puerta de calidad.

## Decision

Nova usa TypeScript 5.9 estricto, ESLint 9.39.5 con flat config y typed linting,
Prettier 3.9 como proceso separado y dependency-cruiser para fronteras. Scripts
root ejecutan formato, lint, typecheck, arquitectura y pruebas sin hooks Git
obligatorios en la etapa inicial.

ESLint 10 se evaluó inicialmente, pero se descartó durante el scaffolding: los
plugins que integra `eslint-config-next` 16.3.3 (`eslint-plugin-import`,
`eslint-plugin-jsx-a11y` y `eslint-plugin-react`) declaran compatibilidad hasta
ESLint 9. Se fija la última versión 9.x disponible en vez de forzar una combinación
fuera de sus rangos soportados.

## Alternatives Considered

### Biome como linter y formateador único

- **Pros**: alta velocidad, instalación simple y una sola configuración.
- **Cons**: reemplaza parte del ecosistema oficial de reglas Next.js y ofrece una
  superficie distinta para typed linting avanzado.
- **Why not**: ESLint tiene integración oficial directa con Next.js y
  typescript-eslint cubre las comprobaciones tipadas requeridas.

### Ejecutar Prettier como regla de ESLint

- **Pros**: un solo comando informa todos los problemas.
- **Cons**: ralentiza lint y presenta diferencias de formato como diagnósticos de
  código, mezclando responsabilidades.
- **Why not**: comandos separados producen errores más claros y permiten a CI
  comprobar formato sin alterar archivos.

### ESLint 10 antes de que los plugins oficiales de Next.js lo soporten

- **Pros**: adopta inmediatamente la versión mayor más reciente.
- **Cons**: instala plugins fuera de sus rangos de compatibilidad declarados y
  deja resultados del lint sin garantías del ecosistema oficial.
- **Why not**: Nova prioriza una puerta de calidad reproducible; se actualizará a
  ESLint 10 cuando toda la configuración oficial seleccionada declare soporte.

### Añadir hooks Git obligatorios desde el inicio

- **Pros**: detecta algunos problemas antes de crear commits.
- **Cons**: duplica configuración, puede omitirse y añade fricción antes de existir
  un flujo de equipo estable.
- **Why not**: la fuente obligatoria será `check` y posteriormente CI; los hooks se
  reevaluarán si existe evidencia de que aportan valor.

## Consequences

### Positive

- Web y API usan una versión coherente de TypeScript y comandos predecibles.
- Formato, defectos, tipos y arquitectura producen diagnósticos independientes.
- Las fronteras hexagonales no dependen de convenciones humanas.
- El scaffold evita herramientas y aliases que todavía no son necesarios.

### Negative

- Typed linting consume más tiempo que reglas puramente sintácticas.
- El flat config debe integrar con cuidado reglas generales y de Next.js.
- Los desarrolladores deben ejecutar más de un comando al diagnosticar la puerta
  completa.

### Risks

- **Conflictos entre configs ESLint**: aplicar patrones por aplicación y
  `eslint-config-prettier` al final, con pruebas sobre ambas apps.
- **Reglas demasiado estrictas para archivos técnicos**: usar overrides acotados y
  comentados, sin desactivar typed linting para el producto entero.
- **Deriva de versiones**: fijar versiones exactas y validar el lockfile como una
  unidad.
- **ESLint 9 fuera de soporte general**: mantenerlo como compatibilidad temporal,
  vigilar el soporte ESLint 10 de los plugins oficiales de Next.js y actualizar el
  conjunto completo en una sola revisión, no paquetes aislados.
- **Build verde con lint rojo**: ejecutar siempre lint explícitamente porque
  Next.js no lo incluye en `next build`.
