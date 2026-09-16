CREATE TYPE "inventory_administrative_category" AS ENUM ('damaged', 'lost', 'defective', 'other');
CREATE TYPE "costing_policy" AS ENUM ('moving_average_v1');
CREATE TYPE "cost_movement_type" AS ENUM (
  'opening', 'purchase_in', 'sale_allocation', 'reservation', 'release',
  'return_review', 'return_available', 'write_off', 'adjustment_in', 'adjustment_out'
);

ALTER TABLE "inventory_movements"
  ADD COLUMN "operation_id" UUID,
  ADD COLUMN "expected_position_version" INTEGER,
  ADD COLUMN "administrative_category" "inventory_administrative_category";

CREATE TABLE "product_cost_positions" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "available_quantity" INTEGER NOT NULL DEFAULT 0,
  "available_value_cents" BIGINT NOT NULL DEFAULT 0,
  "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
  "reserved_value_cents" BIGINT NOT NULL DEFAULT 0,
  "review_quantity" INTEGER NOT NULL DEFAULT 0,
  "review_value_cents" BIGINT NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "policy" "costing_policy" NOT NULL DEFAULT 'moving_average_v1',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "product_cost_positions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_product_cost_positions_balances" CHECK (
    "available_quantity" >= 0 AND "available_value_cents" >= 0
    AND "reserved_quantity" >= 0 AND "reserved_value_cents" >= 0
    AND "review_quantity" >= 0 AND "review_value_cents" >= 0
    AND ("available_quantity" <> 0 OR "available_value_cents" = 0)
    AND ("reserved_quantity" <> 0 OR "reserved_value_cents" = 0)
    AND ("review_quantity" <> 0 OR "review_value_cents" = 0)
  ),
  CONSTRAINT "ck_product_cost_positions_version" CHECK ("version" > 0),
  CONSTRAINT "ck_product_cost_positions_timestamps" CHECK ("updated_at" >= "created_at"),
  CONSTRAINT "fk_product_cost_positions_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "cost_movements" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "type" "cost_movement_type" NOT NULL,
  "quantity_delta" INTEGER NOT NULL,
  "value_delta_cents" BIGINT NOT NULL,
  "previous_available_quantity" INTEGER NOT NULL,
  "resulting_available_quantity" INTEGER NOT NULL,
  "previous_available_value_cents" BIGINT NOT NULL,
  "resulting_available_value_cents" BIGINT NOT NULL,
  "previous_reserved_quantity" INTEGER NOT NULL,
  "resulting_reserved_quantity" INTEGER NOT NULL,
  "previous_reserved_value_cents" BIGINT NOT NULL,
  "resulting_reserved_value_cents" BIGINT NOT NULL,
  "previous_review_quantity" INTEGER NOT NULL,
  "resulting_review_quantity" INTEGER NOT NULL,
  "previous_review_value_cents" BIGINT NOT NULL,
  "resulting_review_value_cents" BIGINT NOT NULL,
  "declared_unit_cost_cents" BIGINT,
  "policy" "costing_policy" NOT NULL,
  "actor_id" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "inventory_movement_id" UUID NOT NULL,
  CONSTRAINT "cost_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_cost_movements_balances" CHECK (
    "resulting_available_quantity" = "previous_available_quantity" + "quantity_delta"
    AND "resulting_available_value_cents" = "previous_available_value_cents" + "value_delta_cents"
    AND "resulting_available_quantity" >= 0 AND "resulting_available_value_cents" >= 0
    AND "resulting_reserved_quantity" >= 0 AND "resulting_reserved_value_cents" >= 0
    AND "resulting_review_quantity" >= 0 AND "resulting_review_value_cents" >= 0
    AND ("resulting_available_quantity" <> 0 OR "resulting_available_value_cents" = 0)
    AND ("resulting_reserved_quantity" <> 0 OR "resulting_reserved_value_cents" = 0)
    AND ("resulting_review_quantity" <> 0 OR "resulting_review_value_cents" = 0)
    AND "resulting_reserved_quantity" = "previous_reserved_quantity"
    AND "resulting_reserved_value_cents" = "previous_reserved_value_cents"
    AND "resulting_review_quantity" = "previous_review_quantity"
    AND "resulting_review_value_cents" = "previous_review_value_cents"
  ),
  CONSTRAINT "ck_cost_movements_reason" CHECK (btrim("reason") <> ''),
  CONSTRAINT "ck_cost_movements_declared_cost" CHECK ("declared_unit_cost_cents" IS NULL OR "declared_unit_cost_cents" >= 0),
  CONSTRAINT "fk_cost_movements_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_cost_movements_actor" FOREIGN KEY ("actor_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_cost_movements_inventory_movement" FOREIGN KEY ("inventory_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_inventory_movements_operation" ON "inventory_movements"("operation_id");
CREATE UNIQUE INDEX "uq_product_cost_positions_product" ON "product_cost_positions"("product_id");
CREATE UNIQUE INDEX "uq_cost_movements_inventory_movement" ON "cost_movements"("inventory_movement_id");
CREATE INDEX "idx_cost_movements_product_date" ON "cost_movements"("product_id", "effective_at" DESC, "id" DESC);

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "ck_inventory_administrative_movement_cause" CHECK (
    ("type" = 'write_off' AND "operation_id" IS NOT NULL AND "transfer_id" IS NULL
      AND "expected_position_version" IS NULL
      AND "administrative_category" IS NOT NULL AND "reason" IS NOT NULL AND btrim("reason") <> '')
    OR ("type" IN ('adjustment_in', 'adjustment_out') AND "operation_id" IS NOT NULL
      AND "transfer_id" IS NULL AND "administrative_category" IS NULL
      AND "expected_position_version" IS NOT NULL AND "expected_position_version" >= 0
      AND "reason" IS NOT NULL AND btrim("reason") <> '')
    OR ("type" NOT IN ('write_off', 'adjustment_in', 'adjustment_out'))
  );
