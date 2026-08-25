# Diagrama entidad-relación lógico

**Estado:** Versión inicial confirmada el 2026-08-24.

Este ERD visualiza el [modelo relacional confirmado](relational-model.md). Está
segmentado para conservar legibilidad y no representa todavía modelos Prisma,
nombres físicos definitivos ni todas las restricciones `CHECK`.

## Notación

| Símbolo | Significado |
| --- | --- |
| `||` | exactamente uno |
| `o|` | cero o uno |
| `|{` | uno o muchos |
| `o{` | cero o muchos |
| `PK` | clave primaria |
| `FK` | clave foránea |
| `UK` | clave única o integrante de ella |

Los atributos mostrados son los necesarios para comprender identidad, relación y
opcionalidad. Importes, estados, snapshots y metadatos completos permanecen en el
modelo relacional y las restricciones.

## Identidad y acceso

```mermaid
erDiagram
    ACCESS_PROFILE ||--o{ USER_ACCOUNT : assigns
    ACCESS_PROFILE ||--o{ PROFILE_PERMISSION : grants
    PERMISSION ||--o{ PROFILE_PERMISSION : belongs_to
    USER_ACCOUNT ||--o{ SESSION : opens

    ACCESS_PROFILE {
        uuid id PK
        string name UK
        string status
    }
    PERMISSION {
        uuid id PK
        string code UK
        string module
        string action
    }
    PROFILE_PERMISSION {
        uuid profile_id FK
        uuid permission_id FK
    }
    USER_ACCOUNT {
        uuid id PK
        uuid profile_id FK
        string username_normalized UK
        string credential_hash
        string status
        int security_version
    }
    SESSION {
        uuid id PK
        uuid user_id FK
        string protected_credential UK
        int issued_security_version
        string status
        datetime issued_at
        datetime ended_at "optional"
    }
```

Inicialmente existen los perfiles Administrador y Empleado. La relación N:M deja
abierta la creación futura de perfiles personalizados sin cambiar el modelo.

## Catálogo y clientes

```mermaid
erDiagram
    CATEGORY ||--o{ PRODUCT : classifies
    PRODUCT ||--o{ PRODUCT_TAG : has
    TAG ||--o{ PRODUCT_TAG : labels
    PRODUCT ||--o{ PRODUCT_IMAGE : displays

    CUSTOMER o|--o{ CUSTOMER : merged_into
    CUSTOMER ||--o{ CUSTOMER_MERGE : primary
    CUSTOMER ||--o| CUSTOMER_MERGE : duplicate

    CATEGORY {
        uuid id PK
        string name UK
        string status
    }
    PRODUCT {
        uuid id PK
        uuid category_id FK
        string code_normalized UK
        string name
        bigint minimum_price_cents
        bigint suggested_price_cents "optional"
        bigint maximum_price_cents "optional"
        string status
    }
    TAG {
        uuid id PK
        string name_normalized UK
        string status
    }
    PRODUCT_TAG {
        uuid product_id FK
        uuid tag_id FK
    }
    PRODUCT_IMAGE {
        uuid id PK
        uuid product_id FK
        int position "1 or 2"
        string storage_key UK
    }
    CUSTOMER {
        uuid id PK
        uuid merged_into_customer_id FK "optional"
        string name
        string phone_normalized
        string dni "optional"
        string address "optional"
        string status
    }
    CUSTOMER_MERGE {
        uuid id PK
        uuid primary_customer_id FK
        uuid duplicate_customer_id FK,UK
        uuid merged_by FK
        datetime merged_at
    }
```

Todo producto tiene categoría. El máximo de dos imágenes se protege mediante una
posición única que solo admite 1 o 2. DNI y dirección del cliente son opcionales;
nombre y teléfono son obligatorios. La autorrelación de cliente permite resolver
el principal sin reescribir ventas históricas.

## Ventas, pagos y cumplimiento

```mermaid
erDiagram
    USER_ACCOUNT ||--o{ SALE : creates
    CUSTOMER o|--o{ SALE : identifies
    SALE ||--o{ SALE_LINE : contains
    PRODUCT ||--o{ SALE_LINE : snapshots

    SALE ||--o{ SALE_TOTAL_ADJUSTMENT : adjusts
    SALE ||--o{ PAYMENT : receives
    PAYMENT ||--o{ PAYMENT_CORRECTION : corrects

    SALE ||--o{ DELIVERY : fulfills
    DELIVERY ||--|{ DELIVERY_LINE : contains
    SALE_LINE ||--o{ DELIVERY_LINE : delivers
    LOCATION ||--o{ DELIVERY_LINE : dispatches_from

    SALE ||--o{ RETURN : has
    RETURN ||--|{ RETURN_LINE : contains
    SALE_LINE ||--o{ RETURN_LINE : returns
    LOCATION o|--o{ RETURN_LINE : returns_to
    RETURN ||--|| RETURN_REFUND : refunds

    SALE ||--o| SALE_CLOSURE : closes
    SALE ||--o| SALE_CANCELLATION : cancels
    SALE_CANCELLATION ||--|{ SALE_CANCELLATION_LINE : resolves
    SALE_LINE ||--o{ SALE_CANCELLATION_LINE : affects
    SALE_CANCELLATION ||--o| SALE_CANCELLATION_REFUND : refunds

    SALE {
        uuid id PK
        uuid created_by FK
        uuid customer_id FK "optional"
        string lifecycle_status
        bigint original_total_cents
        bigint current_total_cents
        date due_date "optional"
        int version
        datetime confirmed_at "optional"
    }
    SALE_LINE {
        uuid id PK
        uuid sale_id FK
        uuid product_id FK
        int quantity
        bigint agreed_unit_price_cents
        bigint attributed_cost_cents
        string costing_policy
    }
    SALE_TOTAL_ADJUSTMENT {
        uuid id PK
        uuid sale_id FK
        bigint previous_total_cents
        bigint new_total_cents
        bigint difference_cents
        uuid changed_by FK
    }
    PAYMENT {
        uuid id PK
        uuid sale_id FK
        bigint amount_cents
        string method
        uuid registered_by FK
        datetime effective_at
    }
    PAYMENT_CORRECTION {
        uuid id PK
        uuid payment_id FK
        bigint compensated_cents
        string reason
        uuid corrected_by FK
    }
    DELIVERY {
        uuid id PK
        uuid sale_id FK
        uuid delivered_by FK
        datetime effective_at
    }
    DELIVERY_LINE {
        uuid id PK
        uuid delivery_id FK
        uuid sale_line_id FK
        uuid location_id FK
        int quantity
    }
    RETURN {
        uuid id PK
        uuid sale_id FK
        string reason
        uuid created_by FK
        datetime effective_at
    }
    RETURN_LINE {
        uuid id PK
        uuid return_id FK
        uuid sale_line_id FK
        uuid return_location_id FK "optional"
        int quantity
        boolean product_returns
        bigint commercial_amount_cents
        bigint attributed_cost_cents
    }
    RETURN_REFUND {
        uuid id PK
        uuid return_id FK,UK
        bigint amount_cents
        string method
        uuid registered_by FK
    }
    SALE_CLOSURE {
        uuid id PK
        uuid sale_id FK,UK
        string closure_type
        bigint condoned_amount_cents
        uuid closed_by FK
    }
    SALE_CANCELLATION {
        uuid id PK
        uuid sale_id FK,UK
        string reason
        uuid cancelled_by FK
    }
    SALE_CANCELLATION_LINE {
        uuid id PK
        uuid cancellation_id FK
        uuid sale_line_id FK
        int released_quantity
        int returned_quantity
        int not_returned_quantity
    }
    SALE_CANCELLATION_REFUND {
        uuid id PK
        uuid cancellation_id FK,UK
        bigint amount_cents
        string method
    }
    USER_ACCOUNT {
        uuid id PK
    }
    CUSTOMER {
        uuid id PK
    }
    PRODUCT {
        uuid id PK
    }
    LOCATION {
        uuid id PK
    }
```

Una venta confirmada exige una o más líneas, pero un borrador puede estar vacío;
esa diferencia de estado requiere validación transaccional y no se expresa por
completo mediante la cardinalidad gráfica. Pago, entrega y cierre siguen siendo
dimensiones independientes.

## Inventario y costo

```mermaid
erDiagram
    PRODUCT ||--o{ INVENTORY_POSITION : located_as
    LOCATION ||--o{ INVENTORY_POSITION : holds
    PRODUCT ||--o{ INVENTORY_MOVEMENT : moves
    LOCATION ||--o{ INVENTORY_MOVEMENT : records

    SALE_LINE ||--o{ INVENTORY_RESERVATION : reserves
    LOCATION ||--o{ INVENTORY_RESERVATION : reserves_at

    PRODUCT ||--o{ INVENTORY_TRANSFER : transfers
    LOCATION ||--o{ INVENTORY_TRANSFER : origin
    LOCATION ||--o{ INVENTORY_TRANSFER : destination

    PRODUCT ||--o| PRODUCT_COST_POSITION : values
    PRODUCT ||--o{ COST_MOVEMENT : changes_value
    SALE_LINE ||--o{ SALE_COST_ALLOCATION : freezes

    PRODUCT {
        uuid id PK
    }
    LOCATION {
        uuid id PK
        string code UK
        string location_type
    }
    INVENTORY_POSITION {
        uuid id PK
        uuid product_id FK
        uuid location_id FK
        int physical_quantity
        int reserved_quantity
        int review_quantity
        int version
    }
    INVENTORY_MOVEMENT {
        uuid id PK
        uuid product_id FK
        uuid location_id FK
        string movement_type
        int physical_delta
        int reserved_delta
        int review_delta
        uuid actor_id FK
        datetime effective_at
    }
    INVENTORY_RESERVATION {
        uuid id PK
        uuid sale_line_id FK
        uuid location_id FK
        int initial_quantity
        int active_quantity
        string status
    }
    INVENTORY_TRANSFER {
        uuid id PK
        uuid product_id FK
        uuid origin_location_id FK
        uuid destination_location_id FK
        int quantity
        uuid transferred_by FK
    }
    PRODUCT_COST_POSITION {
        uuid id PK
        uuid product_id FK,UK
        int available_quantity
        bigint available_value_cents
        int reserved_quantity
        bigint reserved_value_cents
        int review_quantity
        bigint review_value_cents
        string costing_policy
        int version
    }
    COST_MOVEMENT {
        uuid id PK
        uuid product_id FK
        string movement_type
        int quantity
        bigint value_cents
        string costing_policy
        datetime effective_at
    }
    SALE_LINE {
        uuid id PK
    }
    SALE_COST_ALLOCATION {
        uuid id PK
        uuid sale_line_id FK
        int allocated_quantity
        bigint allocated_value_cents
        int reserved_remaining_quantity
        bigint reserved_remaining_value_cents
        string costing_policy
    }
```

`INVENTORY_POSITION` es única por producto y ubicación. La posición de costo es
única y global por producto: un traslado cambia la posición física, no el costo.
Los libros de movimientos son históricos; las posiciones son proyecciones
transaccionales reconciliables.

## Compras y adelantos

```mermaid
erDiagram
    SUPPLIER o|--o{ PURCHASE : supplies
    PURCHASE ||--|{ PURCHASE_LINE : contains
    PRODUCT ||--o{ PURCHASE_LINE : replenishes
    LOCATION ||--o{ PURCHASE_LINE : enters_at

    SUPPLIER ||--o{ SUPPLIER_ADVANCE : receives
    SUPPLIER_ADVANCE ||--o{ ADVANCE_APPLICATION : applies
    PURCHASE ||--o{ ADVANCE_APPLICATION : uses
    SUPPLIER_ADVANCE ||--o{ ADVANCE_REFUND : refunds
    SUPPLIER_ADVANCE ||--o{ ADVANCE_LOSS : loses

    SUPPLIER {
        uuid id PK
        string name
        string status
    }
    PURCHASE {
        uuid id PK
        uuid supplier_id FK "optional"
        string occasional_supplier_name "optional"
        bigint total_cents
        bigint advance_applied_cents
        bigint newly_paid_cents
        string status
    }
    PURCHASE_LINE {
        uuid id PK
        uuid purchase_id FK
        uuid product_id FK
        uuid destination_location_id FK
        int quantity
        bigint unit_cost_cents
        bigint subtotal_cents
    }
    SUPPLIER_ADVANCE {
        uuid id PK
        uuid supplier_id FK
        bigint original_amount_cents
        bigint current_balance_cents
        string method
        string status
        int version
    }
    ADVANCE_APPLICATION {
        uuid id PK
        uuid advance_id FK
        uuid purchase_id FK
        bigint amount_cents
    }
    ADVANCE_REFUND {
        uuid id PK
        uuid advance_id FK
        bigint amount_cents
        string method
    }
    ADVANCE_LOSS {
        uuid id PK
        uuid advance_id FK
        bigint amount_cents
        string reason
    }
    PRODUCT {
        uuid id PK
    }
    LOCATION {
        uuid id PK
    }
```

Una compra identifica un proveedor registrado o conserva la instantánea de uno
ocasional, nunca ambos. Los adelantos solo pertenecen a proveedores registrados.
`ADVANCE_APPLICATION` resuelve la relación N:M entre adelantos y compras.

## Finanzas y gastos

```mermaid
erDiagram
    EXPENSE_CATEGORY ||--o{ OPERATING_EXPENSE : classifies
    OPERATING_EXPENSE ||--o| EXPENSE_CANCELLATION : cancels

    PAYMENT o|--|| CASH_MOVEMENT : causes
    PAYMENT_CORRECTION o|--|| CASH_MOVEMENT : causes
    RETURN_REFUND o|--|| CASH_MOVEMENT : causes
    SALE_CANCELLATION_REFUND o|--|| CASH_MOVEMENT : causes
    PURCHASE o|--o| CASH_MOVEMENT : pays_remainder
    SUPPLIER_ADVANCE o|--|| CASH_MOVEMENT : pays
    ADVANCE_REFUND o|--|| CASH_MOVEMENT : returns_money
    OPERATING_EXPENSE o|--|| CASH_MOVEMENT : spends
    EXPENSE_CANCELLATION o|--o| CASH_MOVEMENT : compensates

    EXPENSE_CATEGORY {
        uuid id PK
        string name UK
        string status
    }
    OPERATING_EXPENSE {
        uuid id PK
        uuid category_id FK
        bigint amount_cents
        string method
        string description "optional"
        string receipt_storage_key "optional"
        uuid registered_by FK
    }
    EXPENSE_CANCELLATION {
        uuid id PK
        uuid expense_id FK,UK
        string reason
        uuid cancelled_by FK
    }
    CASH_MOVEMENT {
        uuid id PK
        string direction
        bigint amount_cents
        string method
        string idempotency_key UK
        uuid registered_by FK
        datetime effective_at
    }
    PAYMENT {
        uuid id PK
    }
    PAYMENT_CORRECTION {
        uuid id PK
    }
    RETURN_REFUND {
        uuid id PK
    }
    SALE_CANCELLATION_REFUND {
        uuid id PK
    }
    PURCHASE {
        uuid id PK
    }
    SUPPLIER_ADVANCE {
        uuid id PK
    }
    ADVANCE_REFUND {
        uuid id PK
    }
```

Cada movimiento de caja tiene exactamente un origen, aunque el diagrama muestre
todas las relaciones causales posibles. Aplicar un adelanto o reconocer una
pérdida no genera otro movimiento de caja porque el dinero salió al crear el
adelanto. Una compra totalmente cubierta por adelantos tampoco genera un nuevo
egreso.

## Importación inicial

```mermaid
erDiagram
    USER_ACCOUNT ||--o{ INITIAL_PRODUCT_IMPORT : requests
    INITIAL_PRODUCT_IMPORT ||--o{ INVENTORY_MOVEMENT : opens_stock
    INITIAL_PRODUCT_IMPORT ||--o{ COST_MOVEMENT : opens_cost

    INITIAL_PRODUCT_IMPORT {
        uuid id PK
        string file_checksum
        string status
        int total_rows
        uuid requested_by FK
        datetime validated_at "optional"
        datetime confirmed_at "optional"
    }
    USER_ACCOUNT {
        uuid id PK
    }
    INVENTORY_MOVEMENT {
        uuid id PK
    }
    COST_MOVEMENT {
        uuid id PK
    }
```

Solo existe una importación inicial confirmada. Sus referencias causales en los
movimientos permiten explicar el stock y costo de apertura sin inventar compras ni
egresos. Los productos creados se identifican mediante esos movimientos y el mismo
commit atómico, sin añadir una propiedad permanente de importación al catálogo.

## Referencias de auditoría

Para no saturar todos los diagramas, varias relaciones hacia `USER_ACCOUNT` se
muestran únicamente como atributos FK. Incluyen creador, registrador, aprobador,
confirmador, quien ajusta, traslada, fusiona, cancela o ejecuta una devolución.
Todas usan `ON DELETE RESTRICT` cuando existe historia.

## Relaciones causales explícitas

Los libros de caja, inventario y costo no utilizarán una referencia polimórfica
sin FK. El mapeo físico contendrá referencias opcionales a documentos causales y
una restricción “exactamente una”. En el ERD se omiten algunas líneas causales de
inventario y costo para mantenerlo legible; esto no elimina la relación definida
en el modelo relacional.

## Invariantes no expresables por el gráfico

El ERD no sustituye las [restricciones](integrity-constraints.md) ni los
[límites transaccionales](transactions-and-concurrency.md). Entre otras reglas, el
gráfico no puede garantizar por sí solo:

- cliente obligatorio si una venta confirmada queda con saldo;
- uno o más detalles únicamente a partir de la confirmación;
- acumulados de pagos, reservas, entregas y devoluciones;
- mismo proveedor entre compra y adelantos aplicados;
- correspondencia entre movimiento, dirección y causa;
- reconciliación de posiciones contra libros históricos;
- orden y atomicidad de bloqueos concurrentes.

## Pendiente para el mapeo físico

- nombres definitivos de modelos, relaciones y columnas Prisma;
- representación de enums;
- constraints e índices que requieran migración SQL personalizada;
- nombres de todas las claves foráneas causales;
- tipos PostgreSQL concretos y valores predeterminados.

Confirmar el ERD valida relaciones y cardinalidades lógicas, no decide
automáticamente esos detalles de implementación.
