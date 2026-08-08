# Usuarios y permisos

> Estado: alcance funcional de la Fase 2 confirmado. Documento vivo.


### User Story IAM-001 — Administrar cuentas de colaboradores

- **Estado:** Confirmada
- **Como** administrador
- **quiero** crear, activar y desactivar cuentas
- **para** controlar quién utiliza el sistema sin perder la autoría histórica.

#### Criterios de aceptación

- **Escenario:** Creación de cuenta con rol inicial
- **Dado:** que proporcioné los datos requeridos de un colaborador
- **Cuando:** creo su cuenta como administrador o empleado
- **Entonces:** la cuenta queda disponible con los permisos correspondientes al rol elegido.

- **Escenario:** Desactivación de una cuenta con sesiones activas
- **Dado:** que un colaborador tiene una o más sesiones activas
- **Cuando:** desactivo su cuenta
- **Entonces:** todas sus sesiones quedan revocadas sin alterar la autoría de sus operaciones históricas.

### User Story IAM-002 — Aplicar permisos de los roles iniciales

- **Estado:** Confirmada para dos roles; perfiles personalizados fuera del MVP
- **Como** administrador
- **quiero** que las acciones estén protegidas según permisos
- **para** operar inicialmente con Administrador y Empleado y poder incorporar perfiles personalizados en el futuro.

#### Criterios de aceptación

- **Escenario:** Usuario intenta una acción no autorizada
- **Dado:** que su rol no posee el permiso requerido
- **Cuando:** intenta ejecutar la acción
- **Entonces:** el sistema la rechaza aunque la interfaz haya mostrado el acceso por error.

---

