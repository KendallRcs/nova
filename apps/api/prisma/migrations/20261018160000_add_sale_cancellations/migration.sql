CREATE TABLE "sale_cancellations" (
  "id" UUID NOT NULL,
  "sale_id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "refund_amount_cents" BIGINT NOT NULL,
  "resulting_paid_cents" BIGINT NOT NULL,
  "cancelled_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "resulting_sale_version" INTEGER NOT NULL,
  CONSTRAINT "sale_cancellations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_sale_cancellations_reason" CHECK (btrim("reason") <> ''),
  CONSTRAINT "ck_sale_cancellations_fingerprint" CHECK (btrim("request_fingerprint") <> ''),
  CONSTRAINT "ck_sale_cancellations_amounts" CHECK ("refund_amount_cents" >= 0 AND "resulting_paid_cents" >= 0),
  CONSTRAINT "ck_sale_cancellations_version" CHECK ("resulting_sale_version" > 0),
  CONSTRAINT "fk_sale_cancellations_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_sale_cancellations_actor" FOREIGN KEY ("cancelled_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_sale_cancellations_sale" ON "sale_cancellations"("sale_id");
CREATE UNIQUE INDEX "uq_sale_cancellations_operation" ON "sale_cancellations"("operation_id");
CREATE INDEX "idx_sale_cancellations_actor_date" ON "sale_cancellations"("cancelled_by", "effective_at" DESC, "id" DESC);

CREATE TABLE "sale_cancellation_lines" (
  "id" UUID NOT NULL,
  "cancellation_id" UUID NOT NULL,
  "sale_line_id" UUID NOT NULL,
  "released_quantity" INTEGER NOT NULL,
  "returned_quantity" INTEGER NOT NULL,
  "not_returned_quantity" INTEGER NOT NULL,
  "return_location_id" UUID,
  "condition" "return_condition",
  "released_cost_cents" BIGINT NOT NULL,
  "attributed_returned_cost_cents" BIGINT NOT NULL,
  CONSTRAINT "sale_cancellation_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_sale_cancellation_lines_quantities" CHECK (
    "released_quantity" >= 0 AND "returned_quantity" >= 0 AND "not_returned_quantity" >= 0
  ),
  CONSTRAINT "ck_sale_cancellation_lines_costs" CHECK (
    "released_cost_cents" >= 0 AND "attributed_returned_cost_cents" >= 0
  ),
  CONSTRAINT "ck_sale_cancellation_lines_physical" CHECK (
    ("returned_quantity" > 0 AND "return_location_id" IS NOT NULL AND "condition" IS NOT NULL)
    OR
    ("returned_quantity" = 0 AND "return_location_id" IS NULL AND "condition" IS NULL)
  ),
  CONSTRAINT "fk_sale_cancellation_lines_cancellation" FOREIGN KEY ("cancellation_id") REFERENCES "sale_cancellations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_sale_cancellation_lines_sale_line" FOREIGN KEY ("sale_line_id") REFERENCES "sale_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_sale_cancellation_lines_location" FOREIGN KEY ("return_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_sale_cancellation_lines_cancellation_sale_line" ON "sale_cancellation_lines"("cancellation_id", "sale_line_id");
CREATE INDEX "idx_sale_cancellation_lines_sale_line" ON "sale_cancellation_lines"("sale_line_id");

CREATE TABLE "sale_cancellation_refunds" (
  "id" UUID NOT NULL,
  "cancellation_id" UUID NOT NULL,
  "amount_cents" BIGINT NOT NULL,
  "method" "payment_method" NOT NULL,
  "registered_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "sale_cancellation_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_sale_cancellation_refunds_amount" CHECK ("amount_cents" > 0),
  CONSTRAINT "fk_sale_cancellation_refunds_cancellation" FOREIGN KEY ("cancellation_id") REFERENCES "sale_cancellations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_sale_cancellation_refunds_registrar" FOREIGN KEY ("registered_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_sale_cancellation_refunds_cancellation" ON "sale_cancellation_refunds"("cancellation_id");
CREATE INDEX "idx_sale_cancellation_refunds_registrar_date" ON "sale_cancellation_refunds"("registered_by", "effective_at" DESC, "id" DESC);

ALTER TABLE "inventory_movements" ADD COLUMN "cancellation_line_id" UUID;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "fk_inventory_movements_cancellation_line" FOREIGN KEY ("cancellation_line_id") REFERENCES "sale_cancellation_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "idx_inventory_movements_cancellation_line_date" ON "inventory_movements"("cancellation_line_id", "effective_at", "id");

ALTER TABLE "cash_movements" ADD COLUMN "sale_cancellation_refund_id" UUID;
ALTER TABLE "cash_movements"
  DROP CONSTRAINT "ck_cash_movements_origin",
  DROP CONSTRAINT "ck_cash_movements_direction",
  ADD CONSTRAINT "ck_cash_movements_origin" CHECK (
    num_nonnulls("payment_id", "payment_correction_id", "return_refund_id", "sale_cancellation_refund_id") = 1
  ),
  ADD CONSTRAINT "ck_cash_movements_direction" CHECK (
    ("payment_id" IS NOT NULL AND "direction" = 'inflow')
    OR
    (("payment_correction_id" IS NOT NULL OR "return_refund_id" IS NOT NULL OR "sale_cancellation_refund_id" IS NOT NULL) AND "direction" = 'outflow')
  ),
  ADD CONSTRAINT "fk_cash_movements_sale_cancellation_refund" FOREIGN KEY ("sale_cancellation_refund_id") REFERENCES "sale_cancellation_refunds"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE UNIQUE INDEX "uq_cash_movements_sale_cancellation_refund" ON "cash_movements"("sale_cancellation_refund_id");

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
        "type" = 'release'
        AND "quantity_delta" > 0
        AND "value_delta_cents" >= 0
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
        "type" NOT IN ('reservation', 'release', 'return_review')
        AND "resulting_available_quantity" = "previous_available_quantity" + "quantity_delta"
        AND "resulting_available_value_cents" = "previous_available_value_cents" + "value_delta_cents"
        AND "resulting_reserved_quantity" = "previous_reserved_quantity"
        AND "resulting_reserved_value_cents" = "previous_reserved_value_cents"
        AND "resulting_review_quantity" = "previous_review_quantity"
        AND "resulting_review_value_cents" = "previous_review_value_cents"
      )
    )
  );
