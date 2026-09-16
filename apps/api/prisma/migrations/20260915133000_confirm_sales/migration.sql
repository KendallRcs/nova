CREATE TYPE "inventory_reservation_status" AS ENUM ('active', 'partially_consumed', 'consumed', 'released');

ALTER TABLE "sales"
  ADD COLUMN "confirmation_operation_id" UUID,
  ADD COLUMN "confirmation_fingerprint" TEXT,
  ADD COLUMN "confirmed_by" UUID,
  ADD CONSTRAINT "fk_sales_confirmer" FOREIGN KEY ("confirmed_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "inventory_movements"
  ADD COLUMN "sale_line_id" UUID,
  ADD CONSTRAINT "fk_inventory_movements_sale_line" FOREIGN KEY ("sale_line_id") REFERENCES "sale_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "inventory_reservations" (
  "id" UUID NOT NULL,
  "sale_line_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "initial_quantity" INTEGER NOT NULL,
  "active_quantity" INTEGER NOT NULL,
  "status" "inventory_reservation_status" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(3) NOT NULL,
  "ended_at" TIMESTAMPTZ(3),
  CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fk_inventory_reservations_sale_line" FOREIGN KEY ("sale_line_id") REFERENCES "sale_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_inventory_reservations_location" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "ck_inventory_reservations_quantities" CHECK ("initial_quantity" > 0 AND "active_quantity" >= 0 AND "active_quantity" <= "initial_quantity"),
  CONSTRAINT "ck_inventory_reservations_state" CHECK (
    ("status" IN ('active', 'partially_consumed') AND "active_quantity" > 0 AND "ended_at" IS NULL)
    OR ("status" IN ('consumed', 'released') AND "active_quantity" = 0 AND "ended_at" IS NOT NULL)
  )
);

CREATE TABLE "sale_cost_allocations" (
  "id" UUID NOT NULL,
  "sale_line_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "total_cost_cents" BIGINT NOT NULL,
  "reserved_remaining_quantity" INTEGER NOT NULL,
  "reserved_remaining_value_cents" BIGINT NOT NULL,
  "policy" "costing_policy" NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "sale_cost_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fk_sale_cost_allocations_sale_line" FOREIGN KEY ("sale_line_id") REFERENCES "sale_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "ck_sale_cost_allocations_values" CHECK (
    "quantity" > 0 AND "total_cost_cents" >= 0
    AND "reserved_remaining_quantity" >= 0 AND "reserved_remaining_quantity" <= "quantity"
    AND "reserved_remaining_value_cents" >= 0 AND "reserved_remaining_value_cents" <= "total_cost_cents"
  )
);

CREATE UNIQUE INDEX "uq_sales_confirmation_operation" ON "sales"("confirmation_operation_id");
CREATE INDEX "idx_inventory_movements_sale_line_date" ON "inventory_movements"("sale_line_id", "effective_at", "id");
CREATE INDEX "idx_inventory_reservations_line_location" ON "inventory_reservations"("sale_line_id", "location_id");
CREATE UNIQUE INDEX "uq_inventory_reservations_active_line_location"
  ON "inventory_reservations"("sale_line_id", "location_id")
  WHERE "status" IN ('active', 'partially_consumed');
CREATE INDEX "idx_sale_cost_allocations_line_date" ON "sale_cost_allocations"("sale_line_id", "created_at", "id");

ALTER TABLE "sales" ADD CONSTRAINT "ck_sales_confirmation_metadata" CHECK (
  ("lifecycle_status" = 'draft' AND "confirmation_operation_id" IS NULL AND "confirmation_fingerprint" IS NULL AND "confirmed_by" IS NULL)
  OR ("lifecycle_status" <> 'draft' AND "confirmation_operation_id" IS NOT NULL AND "confirmation_fingerprint" IS NOT NULL AND "confirmed_by" IS NOT NULL)
);
