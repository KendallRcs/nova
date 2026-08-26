# Contratos HTTP del backend

**Estado:** Confirmada el 2026-08-24.

**Investigación verificada:** 2026-08-24.

Este documento propone el contrato externo entre `apps/web` y `apps/api`. Define
la traducción HTTP del adaptador de entrada; no cambia los conceptos ni los tipos
del dominio.

## Decisión recomendada

Nova expondrá una API **REST sobre HTTPS y JSON**, documentada con OpenAPI y
versionada por URI bajo `/api/v1`. GraphQL no aporta una ventaja proporcional para
los flujos administrativos y transaccionales definidos: el frontend es conocido,
los recursos son acotados y las operaciones de negocio necesitan contratos y
efectos explícitos.

NestJS permite versionado por URI y generación de una descripción OpenAPI. OpenAPI
será el contrato comprobable del adaptador HTTP, no una fuente para generar el
dominio ni un motivo para compartir entidades internas con el frontend.

## Ubicación en la arquitectura hexagonal

```text
Next.js
   │ JSON/HTTP
   ▼
DTO y esquemas HTTP ── controlador NestJS ── puerto de capacidad
                                                │
                                                ▼
                                         aplicación y dominio
```

- Los DTO de request/response, decoradores OpenAPI y códigos HTTP viven en
  `adapters/driving/http/`.
- El controlador autentica, valida el wire format, traduce y delega.
- La aplicación recibe comandos con lenguaje de negocio, no objetos `Request`,
  headers, DTO NestJS ni tipos Swagger.
- Los resultados esperados del negocio se traducen a respuestas HTTP en el borde.
- Prisma, modelos SQL y errores de driver nunca aparecen en el contrato público.

## Convenciones generales

| Tema | Convención propuesta |
| --- | --- |
| Base | `/api/v1` |
| Media type exitoso | `application/json` |
| Media type de error | `application/problem+json` |
| Nombres JSON | `camelCase` |
| Identificadores | UUID en texto opaco; el cliente no interpreta su orden |
| Instantes | RFC 3339 en UTC, por ejemplo `2026-08-24T18:30:00Z` |
| Fechas civiles | `YYYY-MM-DD`, sin convertirlas en instantes |
| Dinero | campos `*Cents` como enteros JSON seguros, nunca `float` decimal |
| Listados | objeto con `items` y cursor opaco |
| Escrituras | JSON explícito por capacidad; no DTO CRUD genérico |

### Dinero

El dominio y PostgreSQL conservan céntimos enteros conforme al ADR-0004. En JSON
se representan como números enteros siempre que estén dentro del rango entero
seguro de JavaScript. El adaptador comprueba el rango al convertir desde `bigint`;
no serializa `bigint` directamente ni expone cantidades decimales.

```json
{
  "minimumPriceCents": 1590,
  "suggestedPriceCents": 1990,
  "currency": "PEN"
}
```

Para Nova este límite es ampliamente superior a los montos del negocio y evita
que el frontend opere con coma flotante. Si en el futuro se requieren valores
fuera de ese rango, el contrato deberá migrar explícitamente a enteros en texto.

### Fechas y horas

- `createdAt`, `updatedAt`, confirmaciones, pagos y movimientos son instantes UTC.
- `dueDate` y otras fechas elegidas por una persona son fechas civiles
  `YYYY-MM-DD`.
- La zona `America/Lima` se usa al presentar y al construir rangos de reportes,
  pero no se persiste dentro de cada timestamp.

## Recursos y capacidades

Se usan sustantivos plurales para recursos y subrecursos para hechos que pertenecen
a un agregado:

```text
GET    /api/v1/categories
POST   /api/v1/categories
GET    /api/v1/products/{productId}
POST   /api/v1/sales
POST   /api/v1/sales/{saleId}/payments
POST   /api/v1/sales/{saleId}/cancellations
POST   /api/v1/returns
```

Esto no confirma aún el inventario completo de endpoints. Cada módulo definirá sus
operaciones a partir de capacidades e historias, no mediante la exposición
automática de todas las tablas.

## Respuestas exitosas

Un recurso o resultado se devuelve directamente, sin envolver todo en `{ data }`.
Esto reduce capas que no aportan semántica:

```json
{
  "id": "0198...",
  "name": "Accesorios",
  "isActive": true,
  "version": 1,
  "createdAt": "2026-08-24T18:30:00Z",
  "updatedAt": "2026-08-24T18:30:00Z"
}
```

- `201 Created` al crear, con header `Location` cuando exista un recurso nuevo.
- `200 OK` cuando la operación devuelve una representación.
- `204 No Content` solo cuando realmente no hay contenido útil.
- No se devuelve `200` con `success: false`; un fallo usa semántica HTTP.

## Errores

Nova usará Problem Details de RFC 9457. Sus miembros estándar son `type`, `title`,
`status`, `detail` e `instance`; se añaden extensiones estables para que el cliente
no tenga que interpretar mensajes humanos.

```json
{
  "type": "https://nova.example/problems/validation-failed",
  "title": "La solicitud contiene datos inválidos",
  "status": 422,
  "detail": "Corrige los campos indicados e inténtalo nuevamente.",
  "instance": "/api/v1/products",
  "code": "VALIDATION_FAILED",
  "traceId": "01K...",
  "errors": [
    {
      "pointer": "/minimumPriceCents",
      "code": "POSITIVE_INTEGER_REQUIRED",
      "message": "Debe ser un entero mayor que cero."
    }
  ]
}
```

`detail` y `message` son para personas; `type`, `code` y los códigos por campo son
los contratos para decisiones del cliente. Nunca contienen stack traces, SQL,
credenciales ni detalles internos.

### Mapeo inicial de estados

| Estado | Uso |
| --- | --- |
| `400` | JSON malformado o request técnicamente ilegible |
| `401` | no existe una identidad autenticada válida |
| `403` | la identidad no posee el permiso requerido |
| `404` | el recurso visible para el actor no existe |
| `409` | versión obsoleta, unicidad o conflicto con el estado actual |
| `422` | contrato bien formado que incumple validación o regla de negocio |
| `429` | límite técnico de solicitudes excedido |
| `500` | fallo inesperado, sin revelar su causa interna |

Los resultados de dominio no contienen estos números. El adaptador mantiene un
mapeo explícito entre cada resultado esperado y el problema HTTP correspondiente.

## Paginación, filtros y orden

Los listados potencialmente crecientes usan cursor, incluso si la primera versión
tiene pocos registros:

```json
{
  "items": [],
  "pageInfo": {
    "nextCursor": "opaque-value-or-null",
    "hasNextPage": false
  }
}
```

- `limit` tiene valor predeterminado y máximo fijados por endpoint.
- El cursor es opaco; el frontend no lo construye ni descompone.
- Filtros y orden se documentan por recurso.
- El orden incluye siempre un desempate estable por ID.
- Reportes que necesiten páginas numeradas podrán adoptar otra estrategia de forma
  explícita; no se generaliza antes de conocer ese requisito.

## Concurrencia e idempotencia

### Control optimista

Los recursos mutables exponen `version`. Los comandos que modifican estado envían
`expectedVersion`; una versión obsoleta produce `409 Conflict`. La capa HTTP
traduce este valor hacia el mecanismo de concurrencia del caso de uso definido en
el ADR-0006.

```json
{
  "expectedVersion": 3,
  "name": "Accesorios para cabello"
}
```

### Reintentos seguros

Las mutaciones con efecto financiero o de stock —confirmar venta, registrar pago,
devolución, compra o ajuste— requerirán un header `Idempotency-Key` generado por el
cliente. La misma clave con el mismo comando devuelve el resultado original; la
misma clave con contenido diferente produce conflicto.

El almacenamiento, vencimiento y alcance exacto de estas claves se definirá junto
con las transacciones del primer flujo financiero. Las creaciones administrativas
simples podrán incorporarlo si su experiencia de usuario lo necesita.

## OpenAPI y verificación

- `@nestjs/swagger` genera una especificación OpenAPI desde DTO y metadatos del
  adaptador de entrada.
- La especificación se exporta como artefacto versionado o verificable en CI.
- Los endpoints tienen `operationId` estable, ejemplos y respuestas de error.
- Una prueba de contrato detecta cambios incompatibles accidentales.
- El frontend puede generar o validar tipos de transporte desde OpenAPI en una
  fase posterior, pero nunca importa tipos desde `apps/api`.
- Swagger UI queda disponible en desarrollo; su exposición en producción se
  decidirá con las reglas operativas y de seguridad.

## Cambios compatibles e incompatibles

Dentro de `/v1` son compatibles, entre otros, añadir un endpoint o añadir un campo
de respuesta opcional. Eliminar o renombrar campos, cambiar significado, volver
obligatorio un campo antes opcional o cambiar su tipo exige una migración de
contrato y, si no puede hacerse de forma aditiva, una nueva versión mayor de API.

No se crea `/v2` anticipadamente. Mientras web y API se desplieguen por separado,
los cambios aditivos permiten publicar primero el backend compatible y después el
frontend consumidor.

## Aspectos deliberadamente pendientes

Esta propuesta no decide todavía:

- sesión mediante cookie o token y protección CSRF/CORS;
- librería concreta de validación del wire format;
- dominio y URL reales para los identificadores `type` de Problem Details;
- límites de rate limiting;
- política exacta de idempotencia y retención;
- contratos multipart para imágenes y comprobantes;
- generación de un cliente TypeScript desde OpenAPI.

## Consecuencias de la decisión

El ADR-0010 registra REST/JSON, versionado por URI y OpenAPI. El formato de errores
y las reglas de serialización permanecen como estándares técnicos de este
contrato; un cambio incompatible exige revisar el ADR y la versión de la API.

## Fuentes oficiales

- [Versionado HTTP en NestJS](https://docs.nestjs.com/techniques/versioning).
- [Generación OpenAPI en NestJS](https://docs.nestjs.com/openapi/introduction).
- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html).
- [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html).
