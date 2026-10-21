# Estados y recuperación de la interfaz

**Estado:** reglas UX base confirmadas por los contratos backend; primera iteración
visual preparada el 2026-10-21.

Nova debe explicar qué ocurre y ofrecer el siguiente paso sin perder el trabajo de
la persona. Estos estados no sustituyen las reglas del backend: traducen sus
resultados a una experiencia operativa consistente.

## Lámina

- [Estados principales de la interfaz](wireframes/interface-states.svg)

## Principios

1. Conservar datos introducidos siempre que el servidor no haya confirmado la
   operación.
2. Mostrar el problema cerca del dato o acción que lo produjo.
3. Usar mensajes específicos y una recuperación concreta; evitar `Ocurrió un
   error` como única explicación.
4. No comunicar estados solo mediante color: cada estado combina texto, símbolo y
   jerarquía.
5. No simular éxito. Una venta, pago o ajuste solo se presenta como confirmado
   después de la respuesta exitosa del backend.
6. Desactivar la acción mientras se envía, pero conservar la misma clave de
   idempotencia al reintentar una operación cuyo resultado sea desconocido.

## Matriz de estados

| Estado | Presentación | Acción disponible | Conservación de contexto |
| --- | --- | --- | --- |
| Carga inicial | estructura estable con indicadores breves en las áreas que esperan datos | ninguna acción destructiva | conserva navegación y título |
| Actualización parcial | datos anteriores visibles con indicador `Actualizando` | permite seguir consultando | no reemplaza toda la pantalla |
| Lista vacía | explica qué contenido aparecerá y, si el perfil puede, ofrece crearlo | acción primaria contextual | conserva filtros relevantes |
| Búsqueda sin resultados | muestra el término y sugiere revisar código o nombre | limpiar búsqueda | no se trata como lista vacía global |
| Validación local o `422` | mensaje junto al campo y resumen al inicio si hay varios errores | corregir y volver a intentar | conserva todos los valores válidos |
| Sin autenticación `401` | avisa que la sesión terminó y dirige al acceso | `Volver a ingresar` | guarda solo un retorno seguro, nunca credenciales |
| Sin permiso `403` | explica que la cuenta no puede ejecutar esa acción | volver al detalle o solicitar al administrador fuera del sistema | no muestra controles administrativos accionables |
| No encontrado `404` | indica que el registro ya no está disponible | volver al listado | elimina referencias locales obsoletas |
| Conflicto `409` | explica que la información cambió y muestra qué debe revisarse | `Actualizar y revisar` | conserva el borrador y compara contra la versión vigente |
| Demasiadas solicitudes `429` | informa que debe esperarse antes de repetir | reintento habilitado al terminar la espera | evita reenvíos automáticos inmediatos |
| Error inesperado `500` o red | separa fallo de consulta de resultado incierto de escritura | reintentar o comprobar estado | una escritura incierta reutiliza su clave de idempotencia |
| Éxito | confirmación breve que nombra la acción terminada | siguiente acción natural | refleja la respuesta del servidor |

## Reglas por escenario crítico

### Nueva venta y cobros

- El borrador permanece intacto ante errores de red, validación o conflicto.
- Al confirmar, el botón cambia a `Confirmando venta…` y no admite un segundo
  envío simultáneo.
- Un `409` de stock o versión no descarta líneas: actualiza existencias, señala las
  afectadas y devuelve a revisión.
- Si se pierde la respuesta después de enviar, `Reintentar confirmación` conserva
  la misma `Idempotency-Key`; no genera otra venta ni otro cobro.
- El éxito nombra el resultado real: `Venta V-1043 confirmada` o `Pago de S/ 50.00
  registrado`.

### Inventario

- Una búsqueda sin coincidencias permite limpiar el término y revisar código o
  nombre; no invita a crear productos al empleado.
- El administrador puede ver `Crear producto` en el vacío general del catálogo.
- Un conflicto de traslado o ajuste obliga a recargar cantidades antes de volver a
  confirmar.
- Si falla una imagen, se conserva código, nombre y stock con un marcador neutro;
  la consulta no falla por completo.

### Permisos

- La navegación se construye con las capacidades devueltas por `/auth/me`.
- Ocultar una acción no se considera seguridad: el backend continúa rechazando
  operaciones no autorizadas.
- Si una capacidad cambia durante una sesión, el `403` actualiza el acceso visible
  y explica que la cuenta ya no tiene permiso.

### Sesión

- Un `401` durante una consulta conduce al acceso con el mensaje `Tu sesión terminó`.
- Una escritura interrumpida por sesión vencida no se repite automáticamente
  después del ingreso; se restaura su borrador y la persona confirma de nuevo.
- Nova no promete trabajo sin conexión en el MVP. Si no hay red, informa que los
  cambios todavía no se registraron y conserva el borrador local en memoria.

## Contenido y accesibilidad

- Los mensajes dinámicos importantes utilizan una región anunciable sin mover el
  foco de manera inesperada.
- Al enviar un formulario inválido, el foco se dirige al primer campo con error.
- Carga, error y estado vacío tienen texto comprensible para lector de pantalla.
- Las acciones mantienen objetivos táctiles de al menos 44 por 44 píxeles.
- Importes usan PEN y fechas se muestran con contexto de `America/Lima`.
- Nombres extensos envuelven o se truncan con acceso al valor completo; nunca
  empujan importes o acciones fuera de pantalla.

## Fuera del alcance actual

- Modo offline y sincronización posterior.
- Notificaciones push.
- Recuperación automática de contraseña por correo o SMS.
- Reintentos automáticos de escrituras financieras o de inventario.
