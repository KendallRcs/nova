# Historial del levantamiento funcional


| Fecha | Cambio |
| --- | --- |
| 2026-08-06 | Creación del backlog inicial a partir del descubrimiento y levantamiento funcional. |
| 2026-08-06 | Se confirmaron aplicaciones y reembolsos parciales de anticipos, múltiples compras por anticipo y múltiples anticipos por compra. |
| 2026-08-06 | Se confirmó el catálogo mínimo, el límite de dos imágenes y se incorporó la importación inicial de productos como historia en definición. |
| 2026-08-06 | Se descartó la importación de ventas históricas y se limitó la importación a la primera carga del catálogo. |
| 2026-08-06 | Se confirmó que la misma plantilla inicial incluirá costo y cantidades de tienda y almacén. |
| 2026-08-06 | Se cerró la importación como proceso atómico de un solo uso; después de completarlo, Excel deja de formar parte de la operación. |
| 2026-08-06 | Se confirmó acceso con cuenta individual, nombre de usuario y contraseña, sesión persistente en dispositivo personal y revocación al desactivar la cuenta. |
| 2026-08-06 | Se confirmó recuperación administrativa mediante contraseña temporal, revocación de sesiones y cambio obligatorio en el siguiente acceso. |
| 2026-08-06 | Se confirmó la política de contraseñas sin expiración ni bloqueo de cuenta por intentos fallidos. |
| 2026-08-06 | Se confirmó la administración de categorías y etiquetas mediante creación, renombrado y desactivación con historial. |
| 2026-08-07 | Se confirmó la consistencia mínimo ≤ sugerido ≤ máximo para los precios presentes. |
| 2026-08-07 | Se cerró la Fase 2 con reglas de edición y ajuste de ventas, límites de pago y devolución, reembolsos y conteos individuales de inventario. |
| 2026-08-08 | Se aclaró que las deudas de clientes de confianza son acuerdos informales de pago; se excluyeron pagarés y títulos valores del modelo. |
| 2026-08-16 | Se confirmó que cada pago pertenece a una sola venta y se preparó el mapa inicial de bounded contexts. |
| 2026-08-26 | PROD-007 inició implementación: creación y consulta de categorías atraviesan dominio, aplicación, Prisma y HTTP; renombrado, desactivación y etiquetas permanecen pendientes. |
| 2026-09-15 | INV-001 e INV-002 completaron su backend: consulta de disponibilidad por ubicación y traslados atómicos, auditables e idempotentes. |
| 2026-09-15 | INV-003 e INV-004 completaron su backend: bajas categorizadas y ajustes de conteo actualizan stock y costo promedio de forma atómica, auditable e idempotente. |
| 2026-09-15 | CUS-001 y CUS-002 completaron su backend de identidad: registro, búsqueda y actualización con teléfono canónico único, datos opcionales y versión optimista. |
| 2026-09-15 | CUS-004 completó su backend: la fusión de clientes es atómica, idempotente, versionada y conserva el registro histórico de los datos resueltos. |
