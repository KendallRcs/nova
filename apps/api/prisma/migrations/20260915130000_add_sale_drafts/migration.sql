CREATE TYPE "sale_lifecycle_status" AS ENUM ('draft', 'confirmed', 'finalized', 'cancelled');

CREATE TABLE "sales" (
  "id" UUID NOT NULL,
  "created_by" UUID NOT NULL,
  "customer_id" UUID,
  "lifecycle_status" "sale_lifecycle_status" NOT NULL DEFAULT 'draft',
  "original_total_cents" BIGINT NOT NULL DEFAULT 0,
  "current_total_cents" BIGINT NOT NULL DEFAULT 0,
  "due_date" DATE,
  "payment_agreement_note" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "confirmed_at" TIMESTAMPTZ(3),
  "finalized_at" TIMESTAMPTZ(3),
  "cancelled_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "sales_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fk_sales_creator" FOREIGN KEY ("created_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_sales_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "ck_sales_totals" CHECK ("original_total_cents" >= 0 AND "current_total_cents" >= 0),
  CONSTRAINT "ck_sales_version" CHECK ("version" > 0),
  CONSTRAINT "ck_sales_note" CHECK ("payment_agreement_note" IS NULL OR btrim("payment_agreement_note") <> ''),
  CONSTRAINT "ck_sales_lifecycle_dates" CHECK (
    ("lifecycle_status" = 'draft' AND "confirmed_at" IS NULL AND "finalized_at" IS NULL AND "cancelled_at" IS NULL)
    OR ("lifecycle_status" = 'confirmed' AND "confirmed_at" IS NOT NULL AND "finalized_at" IS NULL AND "cancelled_at" IS NULL)
    OR ("lifecycle_status" = 'finalized' AND "confirmed_at" IS NOT NULL AND "finalized_at" IS NOT NULL AND "cancelled_at" IS NULL)
    OR ("lifecycle_status" = 'cancelled' AND "confirmed_at" IS NOT NULL AND "finalized_at" IS NULL AND "cancelled_at" IS NOT NULL)
  )
);

CREATE TABLE "sale_lines" (
  "id" UUID NOT NULL,
  "sale_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "delivery_quantity" INTEGER NOT NULL DEFAULT 0,
  "reservation_quantity" INTEGER NOT NULL DEFAULT 0,
  "agreed_unit_price_cents" BIGINT NOT NULL,
  "original_subtotal_cents" BIGINT NOT NULL,
  "snapshot_code" TEXT,
  "snapshot_name" TEXT,
  "snapshot_minimum_price_cents" BIGINT,
  "snapshot_suggested_price_cents" BIGINT,
  "snapshot_maximum_price_cents" BIGINT,
  "price_exception_reason" TEXT,
  "price_approved_by" UUID,
  "allocated_cost_cents" BIGINT,
  "costing_policy" "costing_policy",
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "sale_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fk_sale_lines_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT "fk_sale_lines_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_sale_lines_location" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_sale_lines_price_approver" FOREIGN KEY ("price_approved_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "ck_sale_lines_quantities" CHECK (
    "quantity" > 0 AND "delivery_quantity" >= 0 AND "reservation_quantity" >= 0
    AND "delivery_quantity" + "reservation_quantity" <= "quantity"
  ),
  CONSTRAINT "ck_sale_lines_money" CHECK (
    "agreed_unit_price_cents" >= 0 AND "original_subtotal_cents" >= 0
    AND "original_subtotal_cents" = "agreed_unit_price_cents" * "quantity"
  ),
  CONSTRAINT "ck_sale_lines_snapshot" CHECK (
    ("snapshot_code" IS NULL AND "snapshot_name" IS NULL AND "snapshot_minimum_price_cents" IS NULL)
    OR (btrim("snapshot_code") <> '' AND btrim("snapshot_name") <> '' AND "snapshot_minimum_price_cents" >= 0)
  ),
  CONSTRAINT "ck_sale_lines_price_exception" CHECK (
    ("price_exception_reason" IS NULL AND "price_approved_by" IS NULL)
    OR (btrim("price_exception_reason") <> '' AND "price_approved_by" IS NOT NULL)
  ),
  CONSTRAINT "ck_sale_lines_cost" CHECK ("allocated_cost_cents" IS NULL OR "allocated_cost_cents" >= 0)
);

CREATE UNIQUE INDEX "uq_sale_lines_sale_product" ON "sale_lines"("sale_id", "product_id");
CREATE INDEX "idx_sale_lines_product_sale" ON "sale_lines"("product_id", "sale_id");
CREATE INDEX "idx_sale_lines_location_sale" ON "sale_lines"("location_id", "sale_id");
CREATE INDEX "idx_sales_creator_status_date" ON "sales"("created_by", "lifecycle_status", "updated_at" DESC, "id" DESC);
CREATE INDEX "idx_sales_customer_date" ON "sales"("customer_id", "confirmed_at" DESC, "id" DESC);
CREATE INDEX "idx_sales_status_due_date" ON "sales"("lifecycle_status", "due_date", "id");
