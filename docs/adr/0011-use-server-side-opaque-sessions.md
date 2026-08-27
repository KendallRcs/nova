# ADR-0011: Usar sesiones opacas persistidas en el servidor

**Date**: 2026-08-24
**Status**: accepted
**Deciders**: propietario del producto y mentor técnico

## Context

Nova autentica aproximadamente seis cuentas propias mediante nombre de usuario y
contraseña. Necesita sesiones persistentes, cierre por dispositivo y revocación
inmediata al cambiar una contraseña o desactivar una cuenta, sin introducir un
proveedor externo de identidad en el MVP.

## Decision

Nova usa secretos de sesión opacos y aleatorios entregados mediante cookies
`Secure`, `HttpOnly`, `SameSite=Strict` y persistidos únicamente como hash en
PostgreSQL. Las contraseñas se protegen con Argon2id; el backend valida cada sesión
y aplica autorización por capacidad, sin JWT ni credenciales en almacenamiento
web accesible mediante JavaScript.

La sesión de negocio permanece activa hasta cierre o revocación. Su credencial
técnica y cookie duran 365 días y se renuevan por otros 365 días cuando restan 30
días o menos. La renovación extiende la misma sesión sin crear otra; perder o dejar
expirar la cookie exige autenticarse nuevamente.

## Alternatives Considered

### JWT de acceso y renovación

- **Pros**: validación local, interoperabilidad y menor consulta de sesión si se
  acepta su vigencia autocontenida.
- **Cons**: revocación inmediata requiere listas, versiones o consultas que
  eliminan la principal ventaja; agrega rotación y dos ciclos de tokens.
- **Why not**: el requisito central es revocar con sencillez y el volumen no exige
  validación distribuida sin estado.

### Tokens almacenados en `localStorage`

- **Pros**: integración sencilla desde JavaScript y control manual del header.
- **Cons**: cualquier XSS puede leer y exfiltrar la credencial completa.
- **Why not**: una cookie `HttpOnly` reduce esa exposición y el navegador ya puede
  administrar su envío de manera segura.

### Proveedor externo de identidad

- **Pros**: delega autenticación, recuperación y posibles factores adicionales.
- **Cons**: costo, dependencia externa y flujos innecesarios para seis cuentas
  administradas personalmente.
- **Why not**: no existe una necesidad de SSO, identidad pública o federación en el
  MVP; la frontera hexagonal permite reevaluarlo en el futuro.

## Consequences

### Positive

- Cerrar o revocar una sesión tiene efecto inmediato y auditable.
- Cambiar contraseña o desactivar una cuenta invalida accesos mediante
  `securityVersion`.
- El secreto no es accesible desde JavaScript ni se conserva en texto en la base.
- El dominio no depende de cookies, Argon2id, NestJS ni Prisma.

### Negative

- Cada autenticación de request necesita consultar o resolver estado de sesión.
- Las cookies requieren protección CSRF y configuración CORS/origin rigurosa.
- La persistencia técnica está limitada por el comportamiento del navegador.
- Una persona que no abra Nova durante 365 días debe volver a autenticarse aunque
  la sesión histórica todavía permita explicar por qué terminó el acceso técnico.

### Risks

- **Robo de cookie**: usar HTTPS, atributos seguros, rotación y revocación
  servidor; nunca registrar el secreto.
- **Enumeración o fuerza bruta**: responder genéricamente y aplicar rate limiting
  por IP, usuario y cuota global sin bloquear la cuenta.
- **Debilitamiento al separar despliegues**: exigir orígenes explícitos y evaluar
  un BFF antes de relajar cookies o CSRF.
- **Parámetros Argon2id obsoletos**: benchmark inicial y rehash oportunista después
  de una autenticación válida.
