CREATE TABLE "deliveries" (
  "id" UUID NOT NULL,
  "sale_id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "delivered_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "resulting_sale_version" INTEGER NOT NULL,
  "remaining_reserved_quantity" INTEGER NOT NULL,
  CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_deliveries_fingerprint" CHECK (btrim("request_fingerprint") <> ''),
  CONSTRAINT "ck_deliveries_version" CHECK ("resulting_sale_version" > 0),
  CONSTRAINT "ck_deliveries_remaining_reserved" CHECK ("remaining_reserved_quantity" >= 0),
  CONSTRAINT "fk_deliveries_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_deliveries_actor" FOREIGN KEY ("delivered_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_deliveries_operation" ON "deliveries"("operation_id");
CREATE INDEX "idx_deliveries_sale_date" ON "deliveries"("sale_id", "effective_at", "id");
CREATE INDEX "idx_deliveries_actor_date" ON "deliveries"("delivered_by", "effective_at" DESC, "id" DESC);

CREATE TABLE "delivery_lines" (
  "id" UUID NOT NULL,
  "delivery_id" UUID NOT NULL,
  "sale_line_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "consumed_cost_cents" BIGINT NOT NULL,
  CONSTRAINT "delivery_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_delivery_lines_quantity" CHECK ("quantity" > 0),
  CONSTRAINT "ck_delivery_lines_cost" CHECK ("consumed_cost_cents" >= 0),
  CONSTRAINT "fk_delivery_lines_delivery" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_delivery_lines_sale_line" FOREIGN KEY ("sale_line_id") REFERENCES "sale_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_delivery_lines_location" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_delivery_lines_delivery_sale_line" ON "delivery_lines"("delivery_id", "sale_line_id");
CREATE INDEX "idx_delivery_lines_sale_line" ON "delivery_lines"("sale_line_id");
CREATE INDEX "idx_delivery_lines_location" ON "delivery_lines"("location_id");

ALTER TABLE "inventory_movements" ADD COLUMN "delivery_line_id" UUID;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "fk_inventory_movements_delivery_line" FOREIGN KEY ("delivery_line_id") REFERENCES "delivery_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "idx_inventory_movements_delivery_line_date" ON "inventory_movements"("delivery_line_id", "effective_at", "id");

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
        "type" = 'sale_allocation'
        AND "quantity_delta" < 0
        AND "value_delta_cents" <= 0
        AND (
          (
            "resulting_available_quantity" = "previous_available_quantity" + "quantity_delta"
            AND "resulting_available_value_cents" = "previous_available_value_cents" + "value_delta_cents"
            AND "resulting_reserved_quantity" = "previous_reserved_quantity"
            AND "resulting_reserved_value_cents" = "previous_reserved_value_cents"
          )
          OR (
            "resulting_available_quantity" = "previous_available_quantity"
            AND "resulting_available_value_cents" = "previous_available_value_cents"
            AND "resulting_reserved_quantity" = "previous_reserved_quantity" + "quantity_delta"
            AND "resulting_reserved_value_cents" = "previous_reserved_value_cents" + "value_delta_cents"
          )
        )
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
        "type" NOT IN ('reservation', 'release', 'sale_allocation', 'return_review')
        AND "resulting_available_quantity" = "previous_available_quantity" + "quantity_delta"
        AND "resulting_available_value_cents" = "previous_available_value_cents" + "value_delta_cents"
        AND "resulting_reserved_quantity" = "previous_reserved_quantity"
        AND "resulting_reserved_value_cents" = "previous_reserved_value_cents"
        AND "resulting_review_quantity" = "previous_review_quantity"
        AND "resulting_review_value_cents" = "previous_review_value_cents"
      )
    )
  );
