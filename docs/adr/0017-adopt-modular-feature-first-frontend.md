# ADR-0017: Adoptar un frontend modular por capacidades con cliente REST directo

**Date**: 2026-10-21
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

Nova necesita una interfaz operativa mobile-first que consuma una API REST ya
desplegable de forma independiente, con sesiones opacas, CSRF, permisos, Problem
Details, concurrencia e idempotencia resueltos en el backend. El frontend debe
mantener flujos complejos como ventas y compras sin duplicar reglas de negocio ni
adoptar la arquitectura hexagonal del backend donde no aporta el mismo valor.

## Decision

Nova usa Next.js App Router con módulos organizados por capacidades del producto.
El navegador consume directamente la API REST mediante un cliente compartido y
tipado desde OpenAPI; TanStack Query administra estado remoto, React Hook Form los
formularios y React el estado visual local. No se incorpora un store global ni un
BFF de Next.js inicialmente.

## Alternatives Considered

### Server Actions o Route Handlers como BFF obligatorio

- **Pros**: oculta la URL del API al navegador y concentra llamadas en el servidor
  de Next.js.
- **Cons**: crea una segunda frontera de mutación, duplica contratos y complica la
  propagación de sesión, CSRF, errores e idempotencia ya implementados por el API.
- **Why not**: Nova ya posee un backend independiente y endurecido; el BFF no
  resuelve una necesidad actual proporcional a su complejidad.

### React Server Components para toda consulta autenticada

- **Pros**: reduce JavaScript inicial y permite obtener datos durante el render del
  servidor.
- **Cons**: requiere reenviar de forma segura la sesión hacia el API y ofrece menos
  valor en pantallas operativas con mutaciones y actualización frecuente.
- **Why not**: se conservan Server Components para estructura estática, pero el
  trabajo autenticado interactivo se beneficia de un cliente remoto explícito.

### Store global desde el inicio

- **Pros**: acceso cómodo al estado desde cualquier componente y persistencia
  cliente centralizada.
- **Cons**: duplica caché remota, estado de formulario y estado de URL; aumenta el
  riesgo de fuentes de verdad divergentes.
- **Why not**: TanStack Query, React Hook Form, parámetros de URL y estado React
  local cubren las necesidades confirmadas del MVP.

### Componentes y tipos compartidos directamente con el backend

- **Pros**: reduce inicialmente la escritura de tipos.
- **Cons**: acopla despliegues, expone detalles internos y viola la frontera del
  monorepo.
- **Why not**: OpenAPI es el contrato público y permite generar tipos sin importar
  código desde `apps/api`.

## Consequences

### Positive

- Las carpetas expresan capacidades reconocibles del negocio.
- Sesión, CSRF, Problem Details e idempotencia tienen un único adaptador frontend.
- El estado remoto, los formularios y el estado visual tienen propietarios claros.
- Web y API conservan despliegues y evolución independientes.
- La solución comienza pequeña y permite incorporar herramientas solo con evidencia.

### Negative

- Las superficies operativas envían más JavaScript que una interfaz completamente
  resuelta mediante Server Components.
- El contrato OpenAPI debe exportarse y mantenerse apto para generación.
- La comunicación directa exige configurar orígenes compatibles, CORS y cookies en
  cada entorno.
- El equipo debe distinguir caché remota, borrador de formulario y estado visual.

### Risks

- **Duplicar datos remotos en estado local**: las features no copian respuestas de
  consultas salvo que creen un borrador explícito.
- **Exponer datos administrativos**: el API limita sus DTO y el frontend solo
  muestra capacidades de `/auth/me`; el backend sigue autorizando cada operación.
- **Inconsistencia tras una mutación**: cada comando declara qué consultas invalida
  o actualiza a partir de la respuesta confirmada.
- **Necesitar estado transversal complejo**: se reevaluará un store cuando exista
  evidencia repetida de coordinación cliente que no pertenezca al servidor, URL,
  formulario o árbol React.
