CREATE TYPE "location_type" AS ENUM ('store', 'warehouse');
CREATE TYPE "inventory_movement_type" AS ENUM (
  'opening', 'purchase_in', 'reservation', 'release', 'delivery',
  'return_review', 'return_available', 'transfer_out', 'transfer_in',
  'write_off', 'adjustment_in', 'adjustment_out'
);

CREATE TABLE "locations" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "location_type" NOT NULL,
  "status" "record_status" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "locations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_locations_required_text" CHECK (btrim("code") <> '' AND btrim("name") <> ''),
  CONSTRAINT "ck_locations_timestamps" CHECK ("updated_at" >= "created_at")
);

CREATE TABLE "inventory_positions" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "physical_quantity" INTEGER NOT NULL DEFAULT 0,
  "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
  "review_quantity" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "inventory_positions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_inventory_positions_quantities" CHECK (
    "physical_quantity" >= 0 AND "reserved_quantity" >= 0 AND "review_quantity" >= 0
    AND "reserved_quantity" + "review_quantity" <= "physical_quantity"
  ),
  CONSTRAINT "ck_inventory_positions_version" CHECK ("version" > 0),
  CONSTRAINT "ck_inventory_positions_timestamps" CHECK ("updated_at" >= "created_at"),
  CONSTRAINT "fk_inventory_positions_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_inventory_positions_location" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "inventory_transfers" (
  "id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "origin_location_id" UUID NOT NULL,
  "destination_location_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "transferred_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_inventory_transfers_quantity" CHECK ("quantity" > 0),
  CONSTRAINT "ck_inventory_transfers_distinct_locations" CHECK ("origin_location_id" <> "destination_location_id"),
  CONSTRAINT "fk_inventory_transfers_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_inventory_transfers_origin" FOREIGN KEY ("origin_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_inventory_transfers_destination" FOREIGN KEY ("destination_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_inventory_transfers_actor" FOREIGN KEY ("transferred_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "inventory_movements" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "type" "inventory_movement_type" NOT NULL,
  "physical_delta" INTEGER NOT NULL,
  "reserved_delta" INTEGER NOT NULL,
  "review_delta" INTEGER NOT NULL,
  "previous_physical_quantity" INTEGER NOT NULL,
  "resulting_physical_quantity" INTEGER NOT NULL,
  "previous_reserved_quantity" INTEGER NOT NULL,
  "resulting_reserved_quantity" INTEGER NOT NULL,
  "previous_review_quantity" INTEGER NOT NULL,
  "resulting_review_quantity" INTEGER NOT NULL,
  "actor_id" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "reason" TEXT,
  "transfer_id" UUID,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_inventory_movements_balances" CHECK (
    "resulting_physical_quantity" = "previous_physical_quantity" + "physical_delta"
    AND "resulting_reserved_quantity" = "previous_reserved_quantity" + "reserved_delta"
    AND "resulting_review_quantity" = "previous_review_quantity" + "review_delta"
    AND "resulting_physical_quantity" >= 0
    AND "resulting_reserved_quantity" >= 0
    AND "resulting_review_quantity" >= 0
    AND "resulting_reserved_quantity" + "resulting_review_quantity" <= "resulting_physical_quantity"
  ),
  CONSTRAINT "ck_inventory_transfer_movement_cause" CHECK (
    ("type" IN ('transfer_out', 'transfer_in') AND "transfer_id" IS NOT NULL)
    OR ("type" NOT IN ('transfer_out', 'transfer_in'))
  ),
  CONSTRAINT "fk_inventory_movements_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_inventory_movements_location" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_inventory_movements_actor" FOREIGN KEY ("actor_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_inventory_movements_transfer" FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_locations_code" ON "locations"("code");
CREATE INDEX "idx_locations_status_name" ON "locations"("status", "name");
CREATE UNIQUE INDEX "uq_inventory_positions_product_location" ON "inventory_positions"("product_id", "location_id");
CREATE INDEX "idx_inventory_positions_location_product" ON "inventory_positions"("location_id", "product_id");
CREATE UNIQUE INDEX "uq_inventory_transfers_operation" ON "inventory_transfers"("operation_id");
CREATE INDEX "idx_inventory_transfers_product_date" ON "inventory_transfers"("product_id", "effective_at" DESC, "id" DESC);
CREATE INDEX "idx_inventory_movements_product_location_date" ON "inventory_movements"("product_id", "location_id", "effective_at" DESC, "id" DESC);
CREATE INDEX "idx_inventory_movements_transfer" ON "inventory_movements"("transfer_id");

INSERT INTO "locations" ("id", "code", "name", "type", "status", "created_at", "updated_at") VALUES
  ('0199ef04-1b00-7000-8000-000000000001', 'STORE', 'Tienda', 'store', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('0199ef04-1b00-7000-8000-000000000002', 'WAREHOUSE', 'Almacén', 'warehouse', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
