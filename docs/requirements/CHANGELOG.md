# Historial del levantamiento funcional


| Fecha | Cambio |
| --- | --- |
| 2026-10-21 | PROD-001 e INV-001 incorporaron su primera vertical frontend: búsqueda paginada por código o nombre, detalle responsive, precios autorizados, imágenes y stock por ubicación sin exponer costos. |
| 2026-10-21 | AUTH-001, AUTH-003, AUTH-004 y AUTH-005 incorporaron frontend responsive para acceso, restauración y cierre de sesión, capacidades y cambio obligatorio de contraseña temporal. |
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
| 2026-09-15 | SAL-001 y SAL-008 incorporaron el backend de borradores multilínea, edición optimista, referencias activas y ausencia explícita de efectos antes de confirmar. |
| 2026-09-15 | SAL-002, SAL-003, SAL-007 e INV-005 completaron la confirmación backend de ventas con entrega, reserva, costo histórico, aprobación de precio e idempotencia atómica. |
| 2026-09-16 | PAY-001 y PAY-002 completaron su backend: cobros iniciales y posteriores actualizan saldo, versión y caja atómicamente, permiten ventas al contado sin cliente y evitan sobrepagos o duplicados por reintento. |
| 2026-09-16 | SAL-004, SAL-005 y SAL-006 completaron su listado backend: aplica alcance por cuenta, resuelve clientes canónicos y deriva saldos, estados de pago/entrega y atrasos con fecha de Lima. |
| 2026-10-18 | SAL-005 y SAL-006 incorporaron el detalle operativo backend con líneas, reservas, pagos, correcciones, ajustes y cierre, protegiendo el costo según capacidad. |
| 2026-10-18 | SAL-009, PAY-003 y PAY-005 completaron su backend: ajuste de total, cierre completo o con saldo condonado y corrección compensatoria de cobros se ejecutan con auditoría, versión, idempotencia y caja atómica. |
| 2026-10-18 | RET-001 y RET-002 aclararon el cálculo monetario: devolver unidades reduce el total comercial y solo genera un reembolso automático por el exceso entre pago neto y nuevo total; no se prorratean pagos por producto. |
| 2026-10-18 | RET-001, RET-002 y RET-003 completaron su backend: devolución parcial o total, reembolso exacto por exceso, retorno físico opcional, costo histórico, caja, permisos, versión e idempotencia se resuelven atómicamente. |
| 2026-10-18 | PAY-004 confirmó que el reembolso al cancelar una venta es un importe manual entre cero y el pago neto vigente, no un reembolso total automático. |
| 2026-10-18 | PAY-004 completó su backend: la cancelación administrativa trata cada línea, libera reservas, registra retornos o productos no retornados, conserva costo histórico y aplica únicamente el reembolso manual declarado con caja, versión e idempotencia atómicas. |
| 2026-10-18 | CUS-003 completó su backend: la cuenta consolidada resuelve identidades fusionadas y muestra ventas, pagos netos, deuda activa, atrasos y vencimientos sin revelar costos ni márgenes. |
| 2026-10-18 | SAL-002 e INV-005 completaron las entregas posteriores: consumen reservas, stock físico y costo congelado de forma parcial o total, idempotente y versionada, sin acoplar entrega y pago. |
| 2026-10-18 | INV-007 completó su backend: el administrador resuelve mercancía en revisión como apta o baja, preservando costo histórico, pérdida, razón, versión e idempotencia. |
| 2026-10-18 | PUR-003 completó su backend: proveedores registrados u ocasionales conservan identidad estable y cada anticipo crea una salida de caja atómica e idempotente sin generar inventario ni gasto operativo. |
| 2026-10-18 | PUR-005 completó su backend: reembolsos y pérdidas consumen de forma versionada e idempotente el saldo del anticipo; solo el reembolso real genera una entrada de caja. |
| 2026-10-18 | PUR-001, PUR-002 y PUR-004 completaron su backend: la compra se confirma atómica e idempotentemente con proveedor estable, múltiples líneas y anticipos, inventario, costo promedio, pago restante y sugerencias no vinculantes de precio. |
| 2026-10-18 | EXP-001, EXP-002 y EXP-003 completaron su backend: categorías mantenibles, gastos con egreso idempotente y anulaciones sin devolución o con devolución total conservan historia y caja real. |
| 2026-10-18 | DATA-001 completó su backend: valida una plantilla `.xlsx`, conserva la previsualización normalizada y confirma una única carga inicial de productos, costos y stock de forma atómica e idempotente. |
| 2026-10-19 | DASH-001 a DASH-004 completaron su backend CQRS-lite: flujo de caja, resultado mensual, desempeño por usuario y rentabilidad/disponibilidad por producto leen hechos confirmados con meses de Lima y permisos financieros. |
| 2026-10-19 | PROD-005 completó su contrato backend: admite dos posiciones reemplazables, valida JPEG/PNG/WebP de hasta 5 MiB y conserva en Cloudinary una versión optimizada de hasta 1600 × 1600 píxeles. |
| 2026-10-19 | EXP-001 protegió el comprobante opcional: admite imágenes optimizadas o PDF de hasta 5 MiB, almacenamiento autenticado, acceso firmado de cinco minutos y reemplazo o eliminación sin exponer claves internas. |
| 2026-10-19 | PUR-003 añadió la consulta administrativa de anticipos por proveedor y estado, exponiendo saldo y versión vigentes para poder aplicarlos, reembolsarlos o reconocer pérdidas desde la interfaz. |
| 2026-10-19 | DASH-004 incorporó la consulta administrativa de costos por producto: separa valor disponible, reservado, en revisión y total, calcula promedios sobre las unidades actuales y conserva el último costo de compra como referencia. |
| 2026-10-19 | PUR-001 incorporó el historial administrativo paginado de compras y su detalle con proveedor, productos, ubicaciones, costos, anticipos, pago y responsables. |
| 2026-10-19 | INV-008 incorporó el historial operativo de movimientos de inventario para rastrear cantidades, responsables y causas de negocio sin exponer costos al empleado. |
| 2026-10-19 | DATA-001 incorporó la descarga protegida de la plantilla oficial `.xlsx`, generada con las mismas columnas que valida la carga inicial. |
| 2026-10-19 | PROD-001 completó su backend con la consulta individual de un producto activo, incluyendo datos comerciales, imágenes y stock por ubicación sin costos. |
| 2026-10-19 | La auditoría final confirmó cobertura backend para las 56 historias y normalizó su trazabilidad; frontend y preparación operativa para producción permanecen como fases separadas. |
