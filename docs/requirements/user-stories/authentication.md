# Autenticación y acceso

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story AUTH-001 — Acceder de forma segura al sistema

- **Estado:** Confirmada
- **Como** administrador o empleado
- **quiero** iniciar sesión con mis propias credenciales
- **para** acceder únicamente a las operaciones autorizadas para mi cuenta.

#### Criterios de aceptación

- **Escenario:** Inicio de sesión con credenciales válidas
- **Dado:** que mi cuenta está activa
- **Y dado:** que proporcioné mi nombre de usuario y contraseña válidos
- **Cuando:** solicito iniciar sesión
- **Entonces:** accedo al sistema con las capacidades correspondientes a mi rol.

- **Escenario:** Rechazo de credenciales inválidas
- **Dado:** que proporcioné credenciales inválidas
- **Cuando:** solicito iniciar sesión
- **Entonces:** el sistema rechaza el acceso sin revelar cuál dato es incorrecto.

- **Escenario:** Intentos fallidos repetidos
- **Dado:** que una cuenta activa recibió intentos de acceso con credenciales inválidas
- **Cuando:** su titular proporciona posteriormente credenciales válidas
- **Entonces:** puede acceder sin requerir un desbloqueo administrativo.

### User Story AUTH-002 — Bloquear el acceso de una cuenta desactivada

- **Estado:** Confirmada
- **Como** administrador
- **quiero** desactivar la cuenta de un colaborador
- **para** impedir nuevos accesos sin perder el historial de sus operaciones.

#### Criterios de aceptación

- **Escenario:** Intento de acceso de una cuenta desactivada
- **Dado:** que una cuenta conserva ventas o movimientos históricos
- **Y dado:** que un administrador la desactivó
- **Cuando:** esa cuenta intenta iniciar sesión
- **Entonces:** el acceso es rechazado y sus operaciones históricas permanecen atribuidas a ella.

### User Story AUTH-003 — Mantener una sesión activa en un dispositivo personal

- **Estado:** Confirmada
- **Como** administrador o empleado
- **quiero** conservar mi sesión hasta cerrarla explícitamente
- **para** utilizar la aplicación sin autenticarme repetidamente.

#### Criterios de aceptación

- **Escenario:** Regreso a una sesión válida
- **Dado:** que inicié sesión en mi dispositivo personal
- **Y dado:** que no cerré sesión y mi cuenta continúa activa
- **Cuando:** vuelvo a abrir la aplicación
- **Entonces:** recupero mi sesión mediante credenciales renovables sin escribir nuevamente la contraseña.

### User Story AUTH-004 — Cerrar mi propia sesión

- **Estado:** Confirmada
- **Como** administrador o empleado
- **quiero** cerrar mi sesión
- **para** impedir que otra persona utilice mi cuenta desde ese dispositivo.

#### Criterios de aceptación

- **Escenario:** Cierre voluntario de sesión
- **Dado:** que mantengo una sesión activa
- **Cuando:** selecciono cerrar sesión
- **Entonces:** esa sesión deja de permitir acceso y debo autenticarme nuevamente.

### User Story AUTH-005 — Restablecer la contraseña de un colaborador

- **Estado:** Confirmada
- **Como** administrador
- **quiero** restablecer el acceso de un colaborador que olvidó su contraseña
- **para** permitirle recuperar su cuenta sin crear otra identidad.

#### Criterios de aceptación

- **Escenario:** Restablecimiento administrativo
- **Dado:** que existe una cuenta activa del colaborador
- **Cuando:** inicio el restablecimiento de su contraseña
- **Entonces:** el colaborador recibe una credencial temporal y las sesiones anteriores de su cuenta quedan revocadas.

- **Escenario:** Primer acceso con contraseña temporal
- **Dado:** que un administrador restableció mi contraseña
- **Cuando:** inicio sesión con la credencial temporal
- **Entonces:** debo definir una contraseña personal nueva antes de acceder a las funciones del sistema.

---

