CREATE TYPE "return_condition" AS ENUM ('available', 'review');

CREATE TABLE "returns" (
  "id" UUID NOT NULL,
  "sale_id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "commercial_reduction_cents" BIGINT NOT NULL,
  "refund_amount_cents" BIGINT NOT NULL,
  "resulting_current_total_cents" BIGINT NOT NULL,
  "resulting_paid_cents" BIGINT NOT NULL,
  "resulting_balance_cents" BIGINT NOT NULL,
  "approved_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "resulting_sale_version" INTEGER NOT NULL,
  CONSTRAINT "returns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_returns_reason" CHECK (btrim("reason") <> ''),
  CONSTRAINT "ck_returns_fingerprint" CHECK (btrim("request_fingerprint") <> ''),
  CONSTRAINT "ck_returns_amounts" CHECK (
    "commercial_reduction_cents" > 0
    AND "refund_amount_cents" >= 0
    AND "resulting_current_total_cents" >= 0
    AND "resulting_paid_cents" >= 0
    AND "resulting_balance_cents" >= 0
  ),
  CONSTRAINT "ck_returns_version" CHECK ("resulting_sale_version" > 0),
  CONSTRAINT "fk_returns_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_returns_approver" FOREIGN KEY ("approved_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_returns_operation" ON "returns"("operation_id");
CREATE INDEX "idx_returns_sale_date" ON "returns"("sale_id", "effective_at", "id");

CREATE TABLE "return_lines" (
  "id" UUID NOT NULL,
  "return_id" UUID NOT NULL,
  "sale_line_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "commercial_reduction_cents" BIGINT NOT NULL,
  "product_returns" BOOLEAN NOT NULL,
  "return_location_id" UUID,
  "condition" "return_condition",
  "attributed_cost_cents" BIGINT NOT NULL,
  CONSTRAINT "return_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_return_lines_values" CHECK ("quantity" > 0 AND "commercial_reduction_cents" > 0 AND "attributed_cost_cents" >= 0),
  CONSTRAINT "ck_return_lines_physical" CHECK (
    ("product_returns" AND "return_location_id" IS NOT NULL AND "condition" IS NOT NULL)
    OR
    (NOT "product_returns" AND "return_location_id" IS NULL AND "condition" IS NULL)
  ),
  CONSTRAINT "fk_return_lines_return" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_return_lines_sale_line" FOREIGN KEY ("sale_line_id") REFERENCES "sale_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_return_lines_location" FOREIGN KEY ("return_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_return_lines_return_sale_line" ON "return_lines"("return_id", "sale_line_id");
CREATE INDEX "idx_return_lines_sale_line" ON "return_lines"("sale_line_id");

CREATE TABLE "return_refunds" (
  "id" UUID NOT NULL,
  "return_id" UUID NOT NULL,
  "amount_cents" BIGINT NOT NULL,
  "method" "payment_method" NOT NULL,
  "registered_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "return_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_return_refunds_amount" CHECK ("amount_cents" > 0),
  CONSTRAINT "fk_return_refunds_return" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_return_refunds_registrar" FOREIGN KEY ("registered_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_return_refunds_return" ON "return_refunds"("return_id");
CREATE INDEX "idx_return_refunds_registrar_date" ON "return_refunds"("registered_by", "effective_at" DESC, "id" DESC);

ALTER TABLE "inventory_movements" ADD COLUMN "return_line_id" UUID;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "fk_inventory_movements_return_line" FOREIGN KEY ("return_line_id") REFERENCES "return_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "idx_inventory_movements_return_line_date" ON "inventory_movements"("return_line_id", "effective_at", "id");

ALTER TABLE "cash_movements" ADD COLUMN "return_refund_id" UUID;
ALTER TABLE "cash_movements"
  DROP CONSTRAINT "ck_cash_movements_origin",
  DROP CONSTRAINT "ck_cash_movements_direction",
  ADD CONSTRAINT "ck_cash_movements_origin" CHECK (
    num_nonnulls("payment_id", "payment_correction_id", "return_refund_id") = 1
  ),
  ADD CONSTRAINT "ck_cash_movements_direction" CHECK (
    ("payment_id" IS NOT NULL AND "direction" = 'inflow')
    OR
    (("payment_correction_id" IS NOT NULL OR "return_refund_id" IS NOT NULL) AND "direction" = 'outflow')
  ),
  ADD CONSTRAINT "fk_cash_movements_return_refund" FOREIGN KEY ("return_refund_id") REFERENCES "return_refunds"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE UNIQUE INDEX "uq_cash_movements_return_refund" ON "cash_movements"("return_refund_id");

ALTER TABLE "cost_movements"
  DROP CONSTRAINT "ck_cost_movements_balances",
  ADD CONSTRAINT "ck_cost_movements_balances" CHECK (
    "previous_available_quantity" >= 0 AND "previous_available_value_cents" >= 0
    AND "previous_reserved_quantity" >= 0 AND "previous_reserved_value_cents" >= 0
    AND "previous_review_quantity" >= 0 AND "previous_review_value_cents" >= 0
    AND "resulting_available_quantity" >= 0 AND "resulting_available_value_cents" >= 0
    AND "resulting_reserved_quantity" >= 0 AND "resulting_reserved_value_cents" >= 0
    AND "resulting_review_quantity" >= 0 AND "resulting_review_value_cents" >= 0
    AND ("resulting_available_quantity" <> 0 OR "resulting_available_value_cents" = 0)
    AND ("resulting_reserved_quantity" <> 0 OR "resulting_reserved_value_cents" = 0)
    AND ("resulting_review_quantity" <> 0 OR "resulting_review_value_cents" = 0)
    AND (
      (
        "type" = 'reservation'
        AND "quantity_delta" < 0
        AND "value_delta_cents" <= 0
        AND "resulting_available_quantity" = "previous_available_quantity" + "quantity_delta"
        AND "resulting_available_value_cents" = "previous_available_value_cents" + "value_delta_cents"
        AND "resulting_reserved_quantity" = "previous_reserved_quantity" - "quantity_delta"
        AND "resulting_reserved_value_cents" = "previous_reserved_value_cents" - "value_delta_cents"
        AND "resulting_review_quantity" = "previous_review_quantity"
        AND "resulting_review_value_cents" = "previous_review_value_cents"
      )
      OR (
        "type" = 'return_review'
        AND "quantity_delta" > 0
        AND "value_delta_cents" >= 0
        AND "resulting_available_quantity" = "previous_available_quantity"
        AND "resulting_available_value_cents" = "previous_available_value_cents"
        AND "resulting_reserved_quantity" = "previous_reserved_quantity"
        AND "resulting_reserved_value_cents" = "previous_reserved_value_cents"
        AND "resulting_review_quantity" = "previous_review_quantity" + "quantity_delta"
        AND "resulting_review_value_cents" = "previous_review_value_cents" + "value_delta_cents"
      )
      OR (
        "type" NOT IN ('reservation', 'return_review')
        AND "resulting_available_quantity" = "previous_available_quantity" + "quantity_delta"
        AND "resulting_available_value_cents" = "previous_available_value_cents" + "value_delta_cents"
        AND "resulting_reserved_quantity" = "previous_reserved_quantity"
        AND "resulting_reserved_value_cents" = "previous_reserved_value_cents"
        AND "resulting_review_quantity" = "previous_review_quantity"
        AND "resulting_review_value_cents" = "previous_review_value_cents"
      )
    )
  );
