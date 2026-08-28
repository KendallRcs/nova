# Mapeo físico hacia Prisma y PostgreSQL

**Estado:** Versión inicial confirmada el 2026-08-24.

Este documento define cómo llevar el modelo lógico confirmado al esquema físico.
No crea todavía `schema.prisma`: el repositorio aún no tiene aplicaciones,
dependencias ni una versión de Prisma seleccionada. La versión estable se fijará
al crear el monorepo y se validará antes de usar cualquier capacidad dependiente
de versión.

## Regla de arquitectura

Prisma es un adaptador de persistencia, no el modelo de dominio:

```text
Dominio y aplicación
  Dinero, VentaId, Venta, repositorios y capacidades
                     │
                     ▼ mapeadores explícitos
Adaptador Prisma
  modelos generados, BigInt, Date, transacciones y errores P2xxx
                     │
                     ▼
PostgreSQL
  tablas, FK, CHECK, índices, vistas y bloqueos
```

- Ningún archivo del núcleo importa `@prisma/client` ni tipos generados.
- Los puertos de repositorio usan tipos del dominio y representan agregados, no
  una interfaz CRUD por tabla.
- Los adaptadores traducen filas a entidades y objetos de valor.
- Los query adapters CQRS-lite pueden devolver DTO de lectura sin reconstruir
  agregados, pero tampoco exponen tipos Prisma fuera del adaptador.
- Los códigos de error conocidos se traducen en el adaptador; el dominio no conoce
  nombres de constraints ni errores Prisma.
- Las transacciones y bloqueos siguen el
  [diseño confirmado](transactions-and-concurrency.md).

## Ubicación futura

El schema, migraciones, cliente generado y adaptadores vivirán dentro del backend
desplegable del monorepo. La ruta exacta dependerá de la estructura que se confirme
al crear las aplicaciones; no se crea ahora una carpeta `apps/api` o `apps/backend`
por suposición.

Aunque Prisma soporte esquemas divididos en la versión elegida, Nova comenzará con
la organización más simple que permita esa versión. Si un único archivo pierde
legibilidad, podrá dividirse por módulos sin cambiar tablas, migraciones ni
fronteras del dominio.

## Convenciones de nombres

| Elemento | Prisma | PostgreSQL |
| --- | --- | --- |
| Modelo | singular `PascalCase`, por ejemplo `SaleLine` | plural `snake_case`, por ejemplo `sale_lines` |
| Campo | `camelCase`, por ejemplo `effectiveAt` | `snake_case`, por ejemplo `effective_at` |
| Relación | nombre semántico y explícito | clave foránea nombrada |
| Enum | singular `PascalCase` | tipo y valores con nombres estables mapeados |
| Constraint | nombre semántico con `map` cuando Prisma lo permita | `pk_`, `fk_`, `uq_`, `ck_`, `idx_` |

Se usan `@map` y `@@map` para separar la ergonomía TypeScript de la convención SQL.
Cambiar el nombre de una relación Prisma no debe renombrar accidentalmente una
tabla o constraint estable.

## Mapeo de tipos

| Concepto | Prisma | PostgreSQL | Regla |
| --- | --- | --- | --- |
| Identificador | `String @db.Uuid` | `uuid` | Se genera como UUID ordenado antes de persistir; no se usa autoincremento. |
| Dinero | `BigInt @db.BigInt` | `bigint` | Céntimos PEN; el adaptador convierte a `Dinero`. Nunca `Float`. |
| Cantidad/versión | `Int` | `integer` | Unidades enteras y versiones positivas. |
| Instante | `DateTime @db.Timestamptz(3)` | `timestamptz(3)` | Se normaliza a UTC. |
| Fecha civil | `DateTime @db.Date` | `date` | Vencimientos sin hora. |
| Booleano | `Boolean` | `boolean` | Decisiones binarias explícitas. |
| Texto corto | `String @db.VarChar(n)` cuando exista límite real | `varchar(n)` | Solo se limita por requisito o seguridad, no arbitrariamente. |
| Texto libre | `String` | `text` | Descripciones, razones y snapshots. |
| Metadato flexible | `Json?` | `jsonb` | Solo metadatos técnicos sin invariantes relacionales. |

`BigInt` de Prisma no se envía directamente como JSON. El adaptador HTTP presenta
dinero como una representación contractual segura —por ejemplo céntimos en string
o un objeto monetario— que se decidirá con el diseño de API.

Los campos `createdAt` usan un valor predeterminado de base o Prisma consistente.
Los campos `updatedAt` pueden usar `@updatedAt` mientras toda escritura atraviese
el adaptador; cualquier migración SQL que actualice filas debe mantenerlos de
forma explícita.

## Enums y catálogos

Se usan enums Prisma respaldados por enums PostgreSQL para estados técnicos y
vocabularios cerrados que no administra el usuario:

| Grupo | Valores conceptuales iniciales |
| --- | --- |
| Estado de cuenta | activa, desactivada, cambio de contraseña requerido |
| Estado de sesión | activa, cerrada, revocada |
| Estado de registro maestro | activo, inactivo; cliente añade fusionado |
| Estado de venta | borrador, confirmada, cerrada, cancelada |
| Método de pago | efectivo, Yape, Plin, POS |
| Tipo de cierre | completo, incompleto |
| Estado de reserva | activa, consumida, liberada |
| Ubicación | tienda, almacén |
| Dirección de caja | entrada, salida |
| Política de costeo | `MOVING_AVERAGE_V1`; futuras versiones se añaden sin reescribir historia |
| Tipos de movimiento | conjuntos cerrados por libro de inventario, costo y caja |
| Estado de importación | cargada, validada, fallida, confirmada |

Perfiles, permisos, categorías, tags, proveedores y categorías de gasto son tablas
porque contienen datos configurables, relaciones o ciclo de vida propio.

La elección frente a texto con `CHECK` quedó confirmada en el ADR-0007. Añadir un
valor exige migración, lo cual es deseable para estados que modifican lógica. No
se usan enums para conceptos que el administrador deba crear.

## Inventario de modelos Prisma

Los siguientes modelos corresponden uno a uno con tablas lógicas. Esto no implica
que exista un repositorio por modelo.

### Identidad y acceso

| Modelo Prisma | Tabla | Claves y relaciones principales |
| --- | --- | --- |
| `AccessProfile` | `access_profiles` | nombre único; 1:N cuentas y N:M permisos explícito |
| `Permission` | `permissions` | código único |
| `ProfilePermission` | `profile_permissions` | PK compuesta `(profileId, permissionId)` |
| `UserAccount` | `user_accounts` | perfil requerido, username normalizado único |
| `Session` | `sessions` | usuario requerido, credencial protegida única |

### Catálogo y clientes

| Modelo Prisma | Tabla | Claves y relaciones principales |
| --- | --- | --- |
| `Category` | `categories` | nombre normalizado único |
| `Tag` | `tags` | nombre normalizado único |
| `Product` | `products` | categoría requerida, código normalizado único |
| `ProductTag` | `product_tags` | PK compuesta `(productId, tagId)` |
| `ProductImage` | `product_images` | único `(productId, position)` y `storageKey` |
| `Customer` | `customers` | autorrelación opcional hacia principal; DNI y dirección nullable |
| `CustomerMerge` | `customer_merges` | duplicateId único, primaryId distinto, actor requerido |

### Operaciones comerciales

| Modelo Prisma | Tabla | Claves y relaciones principales |
| --- | --- | --- |
| `Sale` | `sales` | creador requerido, cliente opcional, versión |
| `SaleLine` | `sale_lines` | único `(saleId, productId)`, snapshot y costo congelado |
| `SaleTotalAdjustment` | `sale_total_adjustments` | venta, razón y actor requeridos |
| `Payment` | `payments` | una venta, importe/método/registrador |
| `PaymentCorrection` | `payment_corrections` | pago original y actor administrativo |
| `Delivery` | `deliveries` | venta y responsable |
| `DeliveryLine` | `delivery_lines` | entrega, línea de la misma venta y ubicación |
| `Return` | `returns` | venta, razón y aprobador |
| `ReturnLine` | `return_lines` | devolución, línea, decisión física y costo |
| `ReturnRefund` | `return_refunds` | `returnId` único: relación 1:1 |
| `SaleClosure` | `sale_closures` | `saleId` único: relación 0:1 |
| `SaleCancellation` | `sale_cancellations` | `saleId` único: relación 0:1 |
| `SaleCancellationLine` | `sale_cancellation_lines` | cancelación y línea afectada |
| `SaleCancellationRefund` | `sale_cancellation_refunds` | `cancellationId` único |

### Inventario y costo

| Modelo Prisma | Tabla | Claves y relaciones principales |
| --- | --- | --- |
| `Location` | `locations` | código único |
| `InventoryPosition` | `inventory_positions` | único `(productId, locationId)`, versión |
| `InventoryReservation` | `inventory_reservations` | línea y ubicación; unicidad parcial activa en SQL |
| `InventoryMovement` | `inventory_movements` | producto, ubicación, actor y causa explícita |
| `InventoryTransfer` | `inventory_transfers` | producto, origen/destino y actor |
| `ProductCostPosition` | `product_cost_positions` | `productId` único, política y versión |
| `CostMovement` | `cost_movements` | producto, política y causa explícita |
| `SaleCostAllocation` | `sale_cost_allocations` | línea, cantidad y costo congelados |

### Abastecimiento

| Modelo Prisma | Tabla | Claves y relaciones principales |
| --- | --- | --- |
| `Supplier` | `suppliers` | identidad y estado |
| `Purchase` | `purchases` | proveedor registrado o snapshot ocasional |
| `PurchaseLine` | `purchase_lines` | único `(purchaseId, productId, destinationLocationId)` |
| `SupplierAdvance` | `supplier_advances` | proveedor requerido, saldo y versión |
| `AdvanceApplication` | `advance_applications` | único `(advanceId, purchaseId)` |
| `AdvanceRefund` | `advance_refunds` | adelanto, importe y método |
| `AdvanceLoss` | `advance_losses` | adelanto, importe y razón |

### Finanzas e inicialización

| Modelo Prisma | Tabla | Claves y relaciones principales |
| --- | --- | --- |
| `CashMovement` | `cash_movements` | clave idempotente única y exactamente un origen |
| `ExpenseCategory` | `expense_categories` | nombre normalizado único |
| `OperatingExpense` | `operating_expenses` | categoría, importe, método y actor |
| `ExpenseCancellation` | `expense_cancellations` | `expenseId` único |
| `InitialProductImport` | `initial_product_imports` | una confirmada mediante índice parcial |

## Forma base de los modelos

Este fragmento es ilustrativo y fija convenciones, no constituye aún el schema:

```prisma
model Product {
  id                    String        @id @db.Uuid
  categoryId            String        @map("category_id") @db.Uuid
  codeNormalized        String        @unique(map: "uq_products_code_normalized") @map("code_normalized")
  name                  String
  description           String?
  minimumPriceCents     BigInt        @map("minimum_price_cents") @db.BigInt
  suggestedPriceCents   BigInt?       @map("suggested_price_cents") @db.BigInt
  maximumPriceCents     BigInt?       @map("maximum_price_cents") @db.BigInt
  status                RecordStatus
  createdAt             DateTime      @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt             DateTime      @updatedAt @map("updated_at") @db.Timestamptz(3)

  category              Category      @relation(fields: [categoryId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  tags                  ProductTag[]
  images                ProductImage[]
  inventoryPositions    InventoryPosition[]

  @@index([categoryId, status], map: "idx_products_category_status")
  @@map("products")
}
```

La colección de relaciones existe para navegar en el adaptador; no autoriza
`include` profundos como sustituto del diseño de repositorios o queries.

## Relaciones y acciones referenciales

- Toda relación persistente usa campos escalares FK explícitos.
- Las relaciones N:M son modelos explícitos; no se usan relaciones implícitas.
- La acción predeterminada es `onDelete: Restrict, onUpdate: Restrict`.
- `Cascade` se limita a joins o componentes descartables de un borrador y se
  declara conscientemente por relación.
- No se usa `SetNull` para borrar historia. Una referencia originalmente opcional
  no significa que pueda vaciarse después de confirmar.
- Relaciones múltiples entre los mismos modelos reciben nombres Prisma explícitos,
  por ejemplo origen y destino de una transferencia o principal y duplicado de
  una fusión.
- Relaciones 1:1 colocan la FK única en el registro dependiente histórico, como
  `ReturnRefund.returnId` o `SaleClosure.saleId`.

## Causalidad financiera

`CashMovement` contiene FKs nullable y únicas para los documentos que sí pueden
mover dinero:

```text
payment_id
payment_correction_id
return_refund_id
sale_cancellation_refund_id
purchase_id
supplier_advance_id
advance_refund_id
operating_expense_id
expense_cancellation_id
```

Una restricción SQL exige exactamente una FK no nula. Cada FK es única para que un
hecho confirmado no produzca dos movimientos de caja. La dirección también se
valida contra el tipo de origen.

`AdvanceApplication` y `AdvanceLoss` no aparecen: aplicarlos o reconocer una
pérdida no mueve dinero nuevamente. Una compra cubierta totalmente por adelantos
puede no tener `cash_movement` propio.

## Causalidad de inventario y costo

`InventoryMovement` y `CostMovement` usan relaciones opcionales explícitas cuando
existe un documento causal, por ejemplo:

- importación inicial;
- línea de compra;
- reserva o línea de entrega;
- traslado;
- línea de devolución;
- línea de cancelación;
- asignación o liberación de costo de venta.

Una baja o ajuste manual puede ser autocontenido por el propio movimiento si
incluye `operationId`, tipo, razón, actor y fecha. El `CHECK` correspondiente exige
o una FK causal o todos los campos de una causa administrativa, nunca ambas formas.
Si durante la implementación una baja adquiere más comportamiento propio, se
extraerá un modelo `InventoryWriteOff` sin modificar el dominio por exigencia de
Prisma.

## Restricciones que requieren SQL de migración

Prisma representa PK, FK, relaciones, unicidades comunes e índices B-tree. Las
siguientes garantías se añaden o verifican en la migración SQL:

### `CHECK`

- dinero y cantidades no negativos o positivos según operación;
- orden `minimum <= suggested <= maximum` entre precios presentes;
- `reserved + review <= physical`;
- saldos y valores de costo consistentes con cantidades cero;
- diferencia de ajuste igual a total nuevo menos anterior;
- campos condicionales de precio excepcional, retorno, cierre y estado;
- proveedor registrado XOR snapshot ocasional;
- origen y destino distintos en transferencias;
- exactamente una causa por movimiento financiero, físico o de costo;
- dirección financiera compatible con su origen.

### Índices parciales

- teléfono único entre clientes canónicos;
- una reserva activa por línea y ubicación;
- una única importación inicial confirmada;
- ventas abiertas por vencimiento;
- otras unicidades dependientes de estado que sobrevivan a la validación final.

La versión actual documentada por Prisma ofrece índices parciales mediante una
preview feature. Nova no dependerá inicialmente de esa preview: los índices se
crearán con SQL en migraciones revisadas. Se puede reevaluar cuando se bloquee la
versión de Prisma y la función sea estable.

### Vistas y funciones auxiliares

Las vistas CQRS-lite —pagos netos, saldo de venta, disponibilidad y balance de
adelantos— se crean mediante SQL y se consultan desde query adapters. No necesitan
modelos de escritura Prisma. Si la versión seleccionada permite introspectarlas de
forma útil, se evaluará sin convertirlas en fuente de verdad.

## Flujo de migraciones

1. Modificar el schema Prisma dentro del adaptador.
2. Crear una migración sin aplicarla.
3. Revisar el SQL generado.
4. Añadir `CHECK`, índices parciales, vistas y SQL no expresable en el schema.
5. Aplicar la migración a una base de desarrollo limpia.
6. Ejecutar validación del schema y pruebas de integración.
7. Recrear la base desde cero usando solo migraciones para comprobar
   reproducibilidad.
8. Probar actualización desde la versión anterior cuando ya exista información.

No se usa `db push` como mecanismo de despliegue. Una introspección posterior no
debe borrar silenciosamente SQL personalizado; las migraciones son la fuente de
verdad física junto con el schema.

## Semillas

La inicialización técnica es idempotente y crea:

- ubicaciones tienda y almacén con UUID estables;
- perfiles Administrador y Empleado;
- catálogo inicial de permisos y sus asignaciones;
- categorías de gasto base, si se confirman antes de implementar.

La cuenta administradora inicial se crea mediante un comando seguro o variable de
entorno durante despliegue, nunca con una contraseña conocida dentro del repositorio.
La importación Excel de productos es un caso de uso del negocio, no una seed.

El comando confirmado es `pnpm admin:initialize`. Es idempotente, serializa
ejecuciones concurrentes mediante un bloqueo asesor transaccional y no modifica la
instalación cuando ya existe cualquier cuenta. Usuario y contraseña temporal se
entregan únicamente mediante `NOVA_INITIAL_ADMIN_USERNAME` y
`NOVA_INITIAL_ADMIN_PASSWORD` en el entorno de ejecución.

## Mapeadores y repositorios

Cada agregado persistido tiene mapeadores explícitos en su adaptador:

```text
Prisma rows ──► toDomain ──► entidad/agregado
entidad/agregado ──► toPersistence ──► operaciones Prisma
```

- `toDomain` rechaza estados imposibles encontrados en persistencia.
- `toPersistence` convierte `Dinero` a `bigint`, IDs opacos a UUID string y fechas
  al tipo del adaptador.
- Un `SaleRepository` persiste la venta como frontera; no se crean puertos públicos
  `PaymentRepository` o `SaleLineRepository` solo porque existan tablas.
- Inventario puede cargar posiciones bloqueables mediante una conversación del
  repositorio que exprese intención de modificación, sin mencionar `FOR UPDATE`.
- Las escrituras coordinadas reciben repositorios ligados a la misma transacción
  desde el decorador transaccional.
- Las consultas de dashboard viven en query adapters separados.

## Consultas SQL y seguridad de tipos

Prisma Client se usa para operaciones que expresa claramente. SQL parametrizado
se permite dentro del adaptador para:

- `SELECT ... FOR UPDATE` y bloqueos específicos;
- consultas CQRS-lite complejas y vistas;
- reconciliaciones administrativas;
- capacidades PostgreSQL no representadas por Prisma.

Nunca se concatena entrada del usuario en SQL. Los resultados se validan y mapean
a DTO o tipos internos del adaptador antes de cruzar la frontera.

## Validaciones previas al desarrollo

Al seleccionar versiones y crear el backend se debe comprobar:

- compatibilidad de Node.js, NestJS, Prisma CLI y Prisma Client;
- generación de UUIDv7 detrás del generador de identidades;
- soporte real de `@db.Timestamptz(3)`, `@db.Date`, `@db.Uuid` y `BigInt`;
- comportamiento de enums y migraciones PostgreSQL;
- edición segura de migraciones personalizadas;
- conservación de `CHECK`, índices parciales y vistas al migrar e introspectar;
- capacidad del adaptador para bloquear filas dentro de una transacción interactiva;
- serialización contractual de dinero sin pérdida.

## Trazabilidad de pruebas

| Capa | Prueba requerida |
| --- | --- |
| Schema | `prisma format` y `prisma validate` |
| Migraciones | reconstrucción desde cero y revisión de SQL |
| Constraints | intentos de insertar cada estado inválido mediante PostgreSQL real |
| Mapeadores | ida/vuelta entre filas y tipos del dominio |
| Repositorios | suite contractual contra adaptador real y fake de aplicación |
| Transacciones | carreras y rollback descritos en concurrencia |
| Queries | resultados, permisos y planes de ejecución |
| Frontera | prueba que impida importar Prisma desde dominio/aplicación |

## Decisiones todavía no implícitas

Este documento no selecciona todavía:

- versiones de Node.js, NestJS, Prisma ni PostgreSQL;
- gestor del monorepo y paquetes;
- ruta física exacta del backend y schema;
- archivo único o schema Prisma dividido;
- librería concreta de UUIDv7;
- estrategia de contratos HTTP y serialización de `BigInt`;
- categorías de gasto que se sembrarán;
- nombres exhaustivos de enums y tipos de movimientos.

Esas elecciones corresponden a la fase de stack, estructura y contratos. El
mapeo confirmado servirá como checklist al implementar el schema real.

## Decisión arquitectónica relacionada

- [ADR-0007: usar enums PostgreSQL para vocabularios cerrados](../adr/0007-use-postgresql-enums-for-closed-vocabularies.md).

## Fuentes técnicas

- [Conector PostgreSQL y mapeo de tipos de Prisma](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql).
- [Índices en Prisma](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes).
- [Acciones referenciales](https://docs.prisma.io/docs/orm/v6/prisma-schema/data-model/relations/referential-actions).
- [Personalización de migraciones](https://docs.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations).
- [Limitaciones detectadas por introspección](https://www.prisma.io/docs/orm/prisma-schema/introspection).
