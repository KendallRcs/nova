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
        "type" = 'reservation' AND "quantity_delta" < 0 AND "value_delta_cents" <= 0
        AND "resulting_available_quantity" = "previous_available_quantity" + "quantity_delta"
        AND "resulting_available_value_cents" = "previous_available_value_cents" + "value_delta_cents"
        AND "resulting_reserved_quantity" = "previous_reserved_quantity" - "quantity_delta"
        AND "resulting_reserved_value_cents" = "previous_reserved_value_cents" - "value_delta_cents"
        AND "resulting_review_quantity" = "previous_review_quantity"
        AND "resulting_review_value_cents" = "previous_review_value_cents"
      ) OR (
        "type" = 'release' AND "quantity_delta" > 0 AND "value_delta_cents" >= 0
        AND "resulting_available_quantity" = "previous_available_quantity" + "quantity_delta"
        AND "resulting_available_value_cents" = "previous_available_value_cents" + "value_delta_cents"
        AND "resulting_reserved_quantity" = "previous_reserved_quantity" - "quantity_delta"
        AND "resulting_reserved_value_cents" = "previous_reserved_value_cents" - "value_delta_cents"
        AND "resulting_review_quantity" = "previous_review_quantity"
        AND "resulting_review_value_cents" = "previous_review_value_cents"
      ) OR (
        "type" = 'sale_allocation' AND "quantity_delta" < 0 AND "value_delta_cents" <= 0
        AND (
          (
            "resulting_available_quantity" = "previous_available_quantity" + "quantity_delta"
            AND "resulting_available_value_cents" = "previous_available_value_cents" + "value_delta_cents"
            AND "resulting_reserved_quantity" = "previous_reserved_quantity"
            AND "resulting_reserved_value_cents" = "previous_reserved_value_cents"
          ) OR (
            "resulting_available_quantity" = "previous_available_quantity"
            AND "resulting_available_value_cents" = "previous_available_value_cents"
            AND "resulting_reserved_quantity" = "previous_reserved_quantity" + "quantity_delta"
            AND "resulting_reserved_value_cents" = "previous_reserved_value_cents" + "value_delta_cents"
          )
        )
        AND "resulting_review_quantity" = "previous_review_quantity"
        AND "resulting_review_value_cents" = "previous_review_value_cents"
      ) OR (
        "type" = 'return_review' AND "quantity_delta" > 0 AND "value_delta_cents" >= 0
        AND "resulting_available_quantity" = "previous_available_quantity"
        AND "resulting_available_value_cents" = "previous_available_value_cents"
        AND "resulting_reserved_quantity" = "previous_reserved_quantity"
        AND "resulting_reserved_value_cents" = "previous_reserved_value_cents"
        AND "resulting_review_quantity" = "previous_review_quantity" + "quantity_delta"
        AND "resulting_review_value_cents" = "previous_review_value_cents" + "value_delta_cents"
      ) OR (
        "type" = 'return_available' AND "quantity_delta" > 0 AND "value_delta_cents" >= 0
        AND "resulting_available_quantity" = "previous_available_quantity" + "quantity_delta"
        AND "resulting_available_value_cents" = "previous_available_value_cents" + "value_delta_cents"
        AND "resulting_reserved_quantity" = "previous_reserved_quantity"
        AND "resulting_reserved_value_cents" = "previous_reserved_value_cents"
        AND (
          (
            "resulting_review_quantity" = "previous_review_quantity"
            AND "resulting_review_value_cents" = "previous_review_value_cents"
          ) OR (
            "resulting_review_quantity" = "previous_review_quantity" - "quantity_delta"
            AND "resulting_review_value_cents" = "previous_review_value_cents" - "value_delta_cents"
          )
        )
      ) OR (
        "type" = 'write_off' AND "quantity_delta" < 0 AND "value_delta_cents" <= 0
        AND "resulting_reserved_quantity" = "previous_reserved_quantity"
        AND "resulting_reserved_value_cents" = "previous_reserved_value_cents"
        AND (
          (
            "resulting_available_quantity" = "previous_available_quantity" + "quantity_delta"
            AND "resulting_available_value_cents" = "previous_available_value_cents" + "value_delta_cents"
            AND "resulting_review_quantity" = "previous_review_quantity"
            AND "resulting_review_value_cents" = "previous_review_value_cents"
          ) OR (
            "resulting_available_quantity" = "previous_available_quantity"
            AND "resulting_available_value_cents" = "previous_available_value_cents"
            AND "resulting_review_quantity" = "previous_review_quantity" + "quantity_delta"
            AND "resulting_review_value_cents" = "previous_review_value_cents" + "value_delta_cents"
          )
        )
      ) OR (
        "type" NOT IN ('reservation', 'release', 'sale_allocation', 'return_review', 'return_available', 'write_off')
        AND "resulting_available_quantity" = "previous_available_quantity" + "quantity_delta"
        AND "resulting_available_value_cents" = "previous_available_value_cents" + "value_delta_cents"
        AND "resulting_reserved_quantity" = "previous_reserved_quantity"
        AND "resulting_reserved_value_cents" = "previous_reserved_value_cents"
        AND "resulting_review_quantity" = "previous_review_quantity"
        AND "resulting_review_value_cents" = "previous_review_value_cents"
      )
    )
  );

ALTER TABLE "inventory_movements"
  DROP CONSTRAINT "ck_inventory_administrative_movement_cause",
  ADD CONSTRAINT "ck_inventory_administrative_movement_cause" CHECK (
    (
      "type" = 'write_off' AND "operation_id" IS NOT NULL AND "transfer_id" IS NULL
      AND "administrative_category" IS NOT NULL AND "reason" IS NOT NULL AND btrim("reason") <> ''
      AND (
        ("expected_position_version" IS NULL AND "review_delta" = 0)
        OR ("expected_position_version" IS NOT NULL AND "expected_position_version" > 0 AND "review_delta" < 0)
      )
    )
    OR (
      "type" IN ('adjustment_in', 'adjustment_out') AND "operation_id" IS NOT NULL
      AND "transfer_id" IS NULL AND "administrative_category" IS NULL
      AND "expected_position_version" IS NOT NULL AND "expected_position_version" >= 0
      AND "reason" IS NOT NULL AND btrim("reason") <> ''
    )
    OR ("type" NOT IN ('write_off', 'adjustment_in', 'adjustment_out'))
  );
