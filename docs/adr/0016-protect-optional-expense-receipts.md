# ADR-0016: Proteger los comprobantes opcionales de gastos

**Date**: 2026-10-19
**Status**: accepted
**Deciders**: propietario de Nova y equipo técnico

## Context

Un gasto puede incluir un comprobante con información comercial o personal que no
debe quedar públicamente accesible. El contrato inicial permitía recibir una clave
de almacenamiento escrita por el cliente, lo que exponía un detalle interno y no
demostraba que existiera un archivo válido. Nova ya usa Cloudinary para imágenes
de catálogo, pero la política pública de esos recursos no es apropiada para
documentos financieros. El núcleo hexagonal debe seguir siendo independiente del
proveedor y del transporte HTTP.

## Decision

Cada gasto admite como máximo un comprobante opcional cargado después de crear el
gasto. Solo un administrador con `expenses:manage` puede adjuntarlo, reemplazarlo,
eliminarlo o solicitar acceso. La API acepta JPEG, PNG, WebP o PDF de hasta 5 MiB
y valida la firma real del contenido, no la extensión declarada por el cliente.

Cloudinary queda detrás de un puerto neutral. Las imágenes se guardan como recursos
`authenticated`, convertidas a WebP, con límite de 2400 × 2400 píxeles, calidad
automática `best` y metadatos removidos. Los PDF se guardan sin transformación como
recursos `raw` y `authenticated`. La API nunca expone la clave interna: las lecturas
devuelven una URL firmada que vence en cinco minutos; los PDF se entregan como
descarga.

La sustitución carga el recurso nuevo, confirma después la nueva referencia en
PostgreSQL y finalmente intenta limpiar el anterior. Si falla la persistencia, se
intenta eliminar la carga nueva. La eliminación borra primero la referencia para
revocar el acceso funcional y después limpia el recurso externo. Un fallo de
limpieza se registra y no revierte un cambio ya confirmado.

## Alternatives Considered

### Alternative 1: Usar recursos públicos como las imágenes del catálogo

- **Pros**: reutiliza exactamente el mismo esquema de entrega.
- **Cons**: cualquiera que conozca la URL podría consultar evidencia financiera.
- **Why not**: la confidencialidad del comprobante prevalece sobre la simplicidad
  de distribución.

### Alternative 2: Guardar binarios en PostgreSQL o en el VPS

- **Pros**: evita un segundo proveedor para el ciclo de vida del archivo.
- **Cons**: aumenta el tamaño de copias de seguridad o exige almacenamiento
  persistente, distribución y operación propia.
- **Why not**: Cloudinary ya cubre almacenamiento privado detrás de un adaptador
  reemplazable y el volumen esperado no justifica infraestructura adicional.

### Alternative 3: Crear gasto y comprobante en una sola petición multipart

- **Pros**: presenta una única acción al cliente.
- **Cons**: mezcla idempotencia transaccional con una carga externa no atómica y
  complica los reintentos.
- **Why not**: crear primero el gasto y adjuntar después separa claramente el hecho
  financiero del archivo opcional.

## Consequences

### Positive

- Los comprobantes no poseen una URL pública estable ni exponen claves internas.
- La ausencia o eliminación del archivo no impide conservar el gasto financiero.
- El núcleo depende de puertos neutrales y puede cambiar de proveedor.
- Las imágenes ocupan menos espacio y pierden metadatos innecesarios.

### Negative

- Ver un comprobante requiere solicitar una URL nueva cuando la anterior vence.
- La carga y PostgreSQL no forman una transacción distribuida.
- Se necesita `CLOUDINARY_URL` para operar estos endpoints.

### Risks

- Una interrupción puede dejar un recurso huérfano; las compensaciones reducen el
  riesgo y los fallos restantes se registran para limpieza manual en el MVP.
- Una URL firmada puede compartirse mientras siga vigente; el vencimiento de cinco
  minutos limita esa ventana.
