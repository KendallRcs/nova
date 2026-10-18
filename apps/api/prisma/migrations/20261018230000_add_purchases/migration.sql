CREATE TYPE "purchase_status" AS ENUM ('confirmed');

CREATE TABLE "purchases" (
  "id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "supplier_id" UUID NOT NULL,
  "status" "purchase_status" NOT NULL DEFAULT 'confirmed',
  "total_cents" BIGINT NOT NULL,
  "advance_applied_cents" BIGINT NOT NULL,
  "newly_paid_cents" BIGINT NOT NULL,
  "payment_method" "payment_method",
  "created_by" UUID NOT NULL,
  "confirmed_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_purchases_fingerprint" CHECK (btrim("request_fingerprint") <> ''),
  CONSTRAINT "ck_purchases_amounts" CHECK (
    "total_cents" > 0
    AND "advance_applied_cents" >= 0
    AND "newly_paid_cents" >= 0
    AND "advance_applied_cents" + "newly_paid_cents" = "total_cents"
  ),
  CONSTRAINT "ck_purchases_payment_method" CHECK (
    ("newly_paid_cents" > 0 AND "payment_method" IS NOT NULL)
    OR ("newly_paid_cents" = 0 AND "payment_method" IS NULL)
  ),
  CONSTRAINT "fk_purchases_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_purchases_creator" FOREIGN KEY ("created_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_purchases_confirmer" FOREIGN KEY ("confirmed_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_purchases_operation" ON "purchases"("operation_id");
CREATE INDEX "idx_purchases_supplier_date" ON "purchases"("supplier_id", "effective_at" DESC, "id" DESC);
CREATE INDEX "idx_purchases_confirmer_date" ON "purchases"("confirmed_by", "effective_at" DESC, "id" DESC);

CREATE TABLE "purchase_lines" (
  "id" UUID NOT NULL,
  "purchase_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "destination_location_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_cost_cents" BIGINT NOT NULL,
  "subtotal_cents" BIGINT NOT NULL,
  "previous_average_unit_cost_cents" BIGINT,
  "resulting_average_unit_cost_cents" BIGINT NOT NULL,
  "price_review_suggested" BOOLEAN NOT NULL,
  CONSTRAINT "purchase_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_purchase_lines_quantity" CHECK ("quantity" > 0),
  CONSTRAINT "ck_purchase_lines_cost" CHECK (
    "unit_cost_cents" > 0
    AND "subtotal_cents" = "quantity"::BIGINT * "unit_cost_cents"
    AND ("previous_average_unit_cost_cents" IS NULL OR "previous_average_unit_cost_cents" >= 0)
    AND "resulting_average_unit_cost_cents" >= 0
  ),
  CONSTRAINT "fk_purchase_lines_purchase" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_purchase_lines_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_purchase_lines_location" FOREIGN KEY ("destination_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_purchase_lines_purchase_product_location" ON "purchase_lines"("purchase_id", "product_id", "destination_location_id");
CREATE INDEX "idx_purchase_lines_product_purchase" ON "purchase_lines"("product_id", "purchase_id");
CREATE INDEX "idx_purchase_lines_location_purchase" ON "purchase_lines"("destination_location_id", "purchase_id");

CREATE TABLE "advance_applications" (
  "id" UUID NOT NULL,
  "advance_id" UUID NOT NULL,
  "purchase_id" UUID NOT NULL,
  "amount_cents" BIGINT NOT NULL,
  "expected_advance_version" INTEGER NOT NULL,
  "resulting_balance_cents" BIGINT NOT NULL,
  "resulting_advance_version" INTEGER NOT NULL,
  "applied_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "advance_applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_advance_applications_amount" CHECK ("amount_cents" > 0),
  CONSTRAINT "ck_advance_applications_versions" CHECK (
    "expected_advance_version" > 0
    AND "resulting_advance_version" = "expected_advance_version" + 1
  ),
  CONSTRAINT "ck_advance_applications_balance" CHECK ("resulting_balance_cents" >= 0),
  CONSTRAINT "fk_advance_applications_advance" FOREIGN KEY ("advance_id") REFERENCES "supplier_advances"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_advance_applications_purchase" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_advance_applications_actor" FOREIGN KEY ("applied_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_advance_applications_advance_purchase" ON "advance_applications"("advance_id", "purchase_id");
CREATE INDEX "idx_advance_applications_purchase_advance" ON "advance_applications"("purchase_id", "advance_id");

ALTER TABLE "inventory_movements" ADD COLUMN "purchase_line_id" UUID;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "fk_inventory_movements_purchase_line" FOREIGN KEY ("purchase_line_id") REFERENCES "purchase_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "idx_inventory_movements_purchase_line_date" ON "inventory_movements"("purchase_line_id", "effective_at", "id");

ALTER TABLE "cash_movements" ADD COLUMN "purchase_id" UUID;
ALTER TABLE "cash_movements"
  DROP CONSTRAINT "ck_cash_movements_origin",
  DROP CONSTRAINT "ck_cash_movements_direction",
  ADD CONSTRAINT "ck_cash_movements_origin" CHECK (
    num_nonnulls(
      "payment_id",
      "payment_correction_id",
      "return_refund_id",
      "sale_cancellation_refund_id",
      "supplier_advance_id",
      "advance_refund_id",
      "purchase_id"
    ) = 1
  ),
  ADD CONSTRAINT "ck_cash_movements_direction" CHECK (
    (
      ("payment_id" IS NOT NULL OR "advance_refund_id" IS NOT NULL)
      AND "direction" = 'inflow'
    )
    OR
    (
      (
        "payment_correction_id" IS NOT NULL
        OR "return_refund_id" IS NOT NULL
        OR "sale_cancellation_refund_id" IS NOT NULL
        OR "supplier_advance_id" IS NOT NULL
        OR "purchase_id" IS NOT NULL
      )
      AND "direction" = 'outflow'
    )
  ),
  ADD CONSTRAINT "fk_cash_movements_purchase" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "uq_cash_movements_purchase" ON "cash_movements"("purchase_id");
