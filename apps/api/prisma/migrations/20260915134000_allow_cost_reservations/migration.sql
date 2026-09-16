ALTER TABLE "cost_movements"
  DROP CONSTRAINT "ck_cost_movements_balances",
  ADD CONSTRAINT "ck_cost_movements_balances" CHECK (
    "resulting_available_quantity" = "previous_available_quantity" + "quantity_delta"
    AND "resulting_available_value_cents" = "previous_available_value_cents" + "value_delta_cents"
    AND "previous_available_quantity" >= 0 AND "previous_available_value_cents" >= 0
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
        AND "resulting_reserved_quantity" = "previous_reserved_quantity" - "quantity_delta"
        AND "resulting_reserved_value_cents" = "previous_reserved_value_cents" - "value_delta_cents"
        AND "resulting_review_quantity" = "previous_review_quantity"
        AND "resulting_review_value_cents" = "previous_review_value_cents"
      )
      OR (
        "type" <> 'reservation'
        AND "resulting_reserved_quantity" = "previous_reserved_quantity"
        AND "resulting_reserved_value_cents" = "previous_reserved_value_cents"
        AND "resulting_review_quantity" = "previous_review_quantity"
        AND "resulting_review_value_cents" = "previous_review_value_cents"
      )
    )
  );
