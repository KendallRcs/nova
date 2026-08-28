# ADR-0014: Usar tokens CSRF firmados y vinculados a la sesión

**Date**: 2026-08-27
**Status**: accepted
**Deciders**: Propietario de Nova y Codex

## Context

Nova autentica mediante una cookie opaca enviada automáticamente por el navegador.
`SameSite=Strict` reduce ataques CSRF, pero no sustituye una validación explícita.
La API y el frontend se despliegan por separado y no queremos consultar otra fila
de PostgreSQL por cada operación mutable.

## Decision

Usamos CORS y `Origin` exactos, rechazamos contextos `cross-site` y exigimos un
token double-submit HMAC-SHA256 vinculado al secreto de sesión. El token viaja en
una cookie `__Host-` legible y en `X-CSRF-Token`; el login valida origen, pero queda
exento del token porque aún no existe sesión.

## Alternatives Considered

### Confiar solo en SameSite

- **Pros**: no añade estado ni protocolo frontend.
- **Cons**: depende de comportamiento del navegador y no prueba intención.
- **Why not**: ofrece una única barrera para operaciones sensibles.

### Token sincronizador persistido

- **Pros**: revocación y rotación explícitas en PostgreSQL.
- **Cons**: añade persistencia o lectura adicional por sesión.
- **Why not**: el HMAC ya vincula el token a una sesión opaca revocable.

### Librería CSRF externa

- **Pros**: solución empaquetada.
- **Cons**: dependencia y abstracción adicionales para una política pequeña.
- **Why not**: Node ofrece HMAC y comparación constante de forma nativa.

## Consequences

### Positive

- No añadimos consultas ni columnas para CSRF.
- Cada token deja de ser válido al cambiar el secreto de sesión.
- Origen, Fetch Metadata y token forman defensas independientes.

### Negative

- El frontend debe copiar la cookie CSRF al header en operaciones mutables.
- Cada entorno necesita `FRONTEND_ORIGIN` y un `CSRF_SECRET` fuerte.

### Risks

- Una mala configuración del origen bloqueará el frontend; el arranque valida la
  variable y las pruebas cubren orígenes permitidos y rechazados.
- Rotar `CSRF_SECRET` invalida tokens existentes; el frontend podrá recuperarlos
  mediante una nueva autenticación.
