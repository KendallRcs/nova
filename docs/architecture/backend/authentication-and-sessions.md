# Autenticación y seguridad de sesiones

**Estado:** Confirmada el 2026-08-24.

**Investigación verificada:** 2026-08-24.

Esta propuesta concreta técnicamente las historias AUTH-001 a AUTH-005 y el modelo
de Identidad y Acceso. No modifica la regla funcional: cada colaborador usa su
cuenta y una sesión de negocio continúa hasta cierre o revocación explícita.

## Recomendación resumida

Nova usará autenticación propia mediante nombre de usuario y contraseña, sesiones
opacas persistidas en PostgreSQL y una cookie segura administrada por el backend.
No usará JWT ni almacenará credenciales en `localStorage` o `sessionStorage`.

Para un sistema interno con unas seis cuentas, la sesión de servidor ofrece una
revocación inmediata y sencilla: cerrar sesión, cambiar contraseña o desactivar
una cuenta invalida el acceso consultando el estado persistido. JWT añadiría
complejidad para reconstruir justamente esa capacidad de revocación.

## Flujo propuesto

```text
Usuario + contraseña
        │
        ▼
adaptador HTTP ── capacidad de iniciar sesión ── cuenta y verificador de hash
        │                                            │
        └── cookie opaca ◀── sesión PostgreSQL ◀─────┘

Petición posterior ── cookie ── autenticar sesión ── ActorAutenticado
                                                       │
                                                       ▼
                                             capacidad de negocio
```

1. `POST /api/v1/auth/sessions` recibe usuario y contraseña.
2. La aplicación busca el nombre normalizado y verifica la credencial mediante un
   puerto criptográfico.
3. Si la cuenta es válida, genera un secreto aleatorio de al menos 256 bits y crea
   una sesión asociada con la versión de seguridad vigente.
4. PostgreSQL conserva únicamente un hash del secreto; el valor original se
   entrega en una cookie.
5. En cada endpoint protegido, un guard/adaptador valida cookie, sesión, cuenta,
   versión de seguridad y perfil activo.
6. El caso de uso recibe un `ActorAutenticado` proveedor-independiente con usuario
   y permisos; nunca recibe cookies, tokens ni objetos NestJS.

## Cookie de sesión

En producción se utilizará conceptualmente:

```http
Set-Cookie: __Host-nova-session=<secreto-opaco>;
  Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=<persistente>
```

- `Secure`: solo se transmite mediante HTTPS.
- `HttpOnly`: JavaScript no puede leer el secreto.
- `SameSite=Strict`: reduce envíos desde contextos externos; Nova no necesita
  conservar autenticación al llegar desde enlaces de terceros.
- prefijo `__Host-`: exige `Secure`, `Path=/` y ausencia de `Domain`, evitando que
  otro subdominio establezca esa cookie para la API.
- CORS permite únicamente el origen exacto del frontend y credenciales; nunca usa
  `*` junto con cookies.

En desarrollo local sobre HTTP se usa temporalmente `nova-session` sin `Secure`,
porque los navegadores no aceptarían una cookie `__Host-` fuera de HTTPS. Esta
excepción depende de `NODE_ENV=development|test`; producción siempre aplica el
nombre y los atributos seguros descritos arriba.

La cookie pertenece al host del API. Web y API pueden desplegarse por separado,
pero deberán usar HTTPS y orígenes configurados explícitamente. Si el proveedor de
despliegue impide una relación segura entre ambos, se evaluará un BFF antes de
debilitar los atributos de la cookie.

## Persistencia hasta cerrar sesión

La sesión de negocio no tiene expiración absoluta automática. La credencial y la
cookie tienen una duración técnica de 365 días. Cuando restan 30 días o menos, una
petición autenticada extiende su vigencia otros 365 días sin crear una nueva
sesión de negocio.

Por ello:

- el uso normal no pide autenticarse repetidamente;
- cerrar sesión revoca esa sesión y elimina la cookie;
- cambiar/restablecer contraseña o desactivar la cuenta incrementa
  `securityVersion` y revoca todas sus sesiones;
- una cookie perdida por limpieza del navegador, cambio de dispositivo o límites
  técnicos exige iniciar sesión otra vez, aunque la fila histórica permanezca;
- la cuenta puede tener varias sesiones, una por dispositivo o navegador.

La renovación inicial conserva el mismo secreto y actualiza la vigencia de forma
idempotente para tolerar peticiones simultáneas de varias pestañas. Una rotación
futura deberá aceptar una ventana segura entre credenciales y nunca crear dos
sesiones de negocio.

## Contraseñas

Las contraseñas se almacenarán mediante **Argon2id**, usando una librería mantenida
y nunca una implementación criptográfica propia. Cada hash incluye salt único y
parámetros; no se cifra una contraseña para recuperarla.

El piso inicial será el recomendado actualmente por OWASP —19 MiB de memoria, dos
iteraciones y paralelismo uno— o un costo superior obtenido por benchmark en el
entorno de producción sin perjudicar el inicio de sesión. Los parámetros se
versionan de forma implícita en el hash y se puede aplicar rehash después de un
login válido cuando queden obsoletos.

Se mantienen las reglas funcionales confirmadas:

- mínimo diez caracteres;
- puede ser una frase;
- no puede coincidir con el nombre de usuario;
- no expira periódicamente;
- el administrador no puede consultar una contraseña personal.

## Credenciales temporales y recuperación

Nova no tendrá recuperación automática por correo en el MVP. Un administrador
crea o restablece una credencial temporal y su valor se muestra solamente durante
esa acción para comunicarlo al colaborador.

- En base de datos solo queda su hash Argon2id.
- Restablecer incrementa `securityVersion` y revoca sesiones anteriores.
- El login con credencial temporal solo habilita consultar la identidad actual,
  cerrar sesión y establecer una contraseña personal.
- No se permite acceder a ventas, clientes, stock u otros módulos antes del cambio.
- La nueva contraseña personal reemplaza la temporal y vuelve a revocar cualquier
  credencial técnica emitida durante el proceso.

### Inicialización del primer administrador

La primera cuenta se crea una sola vez con `pnpm admin:initialize`. El comando
recibe `NOVA_INITIAL_ADMIN_USERNAME` y `NOVA_INITIAL_ADMIN_PASSWORD` desde el
entorno, protege la contraseña antes de persistirla y nunca imprime su valor. La
cuenta comienza con credencial temporal y debe establecer una contraseña personal.

La operación usa una transacción y un bloqueo asesor de PostgreSQL para que dos
ejecuciones concurrentes no creen dos administradores. Si ya existe cualquier
cuenta, termina sin modificar datos. El perfil Administrador utiliza un UUID
estable; su catálogo de permisos se completa mediante la semilla técnica
versionada, no mediante privilegios implícitos en el código.

## Protección frente a intentos abusivos

No se bloquea la cuenta por cantidad de intentos fallidos. El endpoint de login
aplica rate limiting técnico con contadores combinados por IP y nombre de usuario
normalizado, más una cuota global defensiva.

- La respuesta no revela si falló el usuario, la contraseña, el estado o el perfil.
- Un límite excedido devuelve `429` y `Retry-After`.
- Los contadores expiran automáticamente y no crean un estado de “cuenta
  bloqueada” ni una acción administrativa de desbloqueo.
- Los límites exactos serán configurables y se fijarán con pruebas para no afectar
  al local cuando varias cuentas compartan la misma conexión.
- Los intentos exitosos e inválidos generan telemetría técnica sin registrar
  contraseñas ni secretos.

Para el MVP, un limitador en memoria solo sería correcto con una única instancia
del API. Si el despliegue escala horizontalmente, el contador deberá moverse a un
almacén compartido; esta condición quedará documentada en Operaciones.

## CSRF, CORS y métodos HTTP

Una cookie es enviada automáticamente por el navegador, por lo que Nova aplicará
defensa CSRF en todas las operaciones que cambian estado:

- `SameSite=Strict` como defensa en profundidad;
- comprobación exacta de `Origin` contra una lista configurada;
- rechazo de `Sec-Fetch-Site: cross-site` en métodos no seguros;
- token CSRF ligado a la sesión para solicitudes `POST`, `PUT`, `PATCH` y `DELETE`;
- ningún `GET`, `HEAD` u `OPTIONS` modifica estado;
- CORS mínimo, con origen exacto, métodos/headers necesarios y credenciales.

El token CSRF puede ser leído por el frontend, pero no es una credencial de sesión.
Su mecanismo concreto se decidirá durante el scaffolding y deberá estar cubierto
por pruebas de transporte.

## Endpoints iniciales

```text
POST   /api/v1/auth/sessions             iniciar sesión
DELETE /api/v1/auth/sessions/current     cerrar la sesión actual
GET    /api/v1/auth/me                   obtener actor y capacidades actuales
PUT    /api/v1/auth/password             establecer/cambiar contraseña propia
POST   /api/v1/users/{userId}/password-reset  restablecimiento administrativo
POST   /api/v1/users/{userId}/session-revocations revocar todas sus sesiones
```

Los nombres definitivos se reflejarán en OpenAPI. Las respuestas nunca exponen
hashes, secreto de sesión, `securityVersion` interno ni causas específicas del
fallo de login.

## Separación hexagonal

| Responsabilidad | Ubicación |
| --- | --- |
| Parsear cookie, CORS, CSRF y rate limiting | adaptador de entrada HTTP |
| Verificar hash Argon2id y generar secretos | adaptador criptográfico detrás de puertos |
| Cargar y persistir cuenta/sesión | adaptador Prisma detrás de repositorios |
| Estado de cuenta, contraseña temporal y revocación | Identidad y Acceso |
| Comprobar permisos de una capacidad | aplicación/dominio del módulo protegido |
| Convertir rechazos a `401`, `403`, `409` o `429` | adaptador HTTP |

La autenticación determina quién es el actor; no autoriza automáticamente cada
operación. Ocultar un botón en Next.js mejora la experiencia, pero el backend
comprueba el permiso en cada capacidad.

## Pruebas mínimas

- hash y verificación contra vectores/uso real de la librería;
- login válido e inválido sin enumeración de cuentas;
- sesión revocada, cerrada, de cuenta inactiva y con versión obsoleta;
- cambio obligatorio de contraseña temporal;
- cookies y headers de seguridad en pruebas HTTP;
- CSRF/CORS para orígenes permitidos y rechazados;
- rate limiting sin bloqueo persistente de cuenta;
- autorización servidor para Administrador y Empleado;
- ausencia de secretos y hashes en logs, OpenAPI y respuestas.

## Decisiones aún diferidas

- valores exactos y almacén del rate limiter;
- librería o implementación acotada de sesiones/guards;
- dominios de despliegue y configuración de proxy confiable;
- mecanismo exacto del token CSRF;
- política futura para cerrar sesiones desde otros dispositivos;
- autenticación multifactor, fuera del MVP.

## Fuentes

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- [OWASP Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- [RFC 9106: Argon2](https://www.rfc-editor.org/rfc/rfc9106.html).
