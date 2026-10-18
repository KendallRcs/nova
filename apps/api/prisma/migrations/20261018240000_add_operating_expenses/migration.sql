CREATE TYPE "operating_expense_status" AS ENUM ('confirmed', 'cancelled');

CREATE TABLE "expense_categories" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "name_normalized" TEXT NOT NULL,
  "description" TEXT,
  "status" "record_status" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_expense_categories_name" CHECK (btrim("name") <> '' AND btrim("name_normalized") <> '')
);
CREATE UNIQUE INDEX "uq_expense_categories_name_normalized" ON "expense_categories"("name_normalized");
CREATE INDEX "idx_expense_categories_status_name" ON "expense_categories"("status", "name_normalized", "id");

CREATE TABLE "operating_expenses" (
  "id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "category_id" UUID NOT NULL,
  "amount_cents" BIGINT NOT NULL,
  "method" "payment_method" NOT NULL,
  "description" TEXT,
  "receipt_storage_key" TEXT,
  "status" "operating_expense_status" NOT NULL DEFAULT 'confirmed',
  "registered_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "operating_expenses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_operating_expenses_amount" CHECK ("amount_cents" > 0),
  CONSTRAINT "ck_operating_expenses_fingerprint" CHECK (btrim("request_fingerprint") <> ''),
  CONSTRAINT "ck_operating_expenses_receipt" CHECK ("receipt_storage_key" IS NULL OR btrim("receipt_storage_key") <> ''),
  CONSTRAINT "fk_operating_expenses_category" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_operating_expenses_registrar" FOREIGN KEY ("registered_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "uq_operating_expenses_operation" ON "operating_expenses"("operation_id");
CREATE INDEX "idx_operating_expenses_category_date" ON "operating_expenses"("category_id", "effective_at" DESC, "id" DESC);
CREATE INDEX "idx_operating_expenses_status_date" ON "operating_expenses"("status", "effective_at" DESC, "id" DESC);

CREATE TABLE "expense_cancellations" (
  "id" UUID NOT NULL,
  "expense_id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "refund_amount_cents" BIGINT NOT NULL,
  "refund_method" "payment_method",
  "cancelled_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expense_cancellations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_expense_cancellations_reason" CHECK (btrim("reason") <> ''),
  CONSTRAINT "ck_expense_cancellations_fingerprint" CHECK (btrim("request_fingerprint") <> ''),
  CONSTRAINT "ck_expense_cancellations_refund" CHECK (
    ("refund_amount_cents" = 0 AND "refund_method" IS NULL)
    OR ("refund_amount_cents" > 0 AND "refund_method" IS NOT NULL)
  ),
  CONSTRAINT "fk_expense_cancellations_expense" FOREIGN KEY ("expense_id") REFERENCES "operating_expenses"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_expense_cancellations_canceller" FOREIGN KEY ("cancelled_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "uq_expense_cancellations_expense" ON "expense_cancellations"("expense_id");
CREATE UNIQUE INDEX "uq_expense_cancellations_operation" ON "expense_cancellations"("operation_id");

ALTER TABLE "cash_movements"
  ADD COLUMN "operating_expense_id" UUID,
  ADD COLUMN "expense_cancellation_id" UUID;
ALTER TABLE "cash_movements"
  DROP CONSTRAINT "ck_cash_movements_origin",
  DROP CONSTRAINT "ck_cash_movements_direction",
  ADD CONSTRAINT "ck_cash_movements_origin" CHECK (
    num_nonnulls(
      "payment_id", "payment_correction_id", "return_refund_id",
      "sale_cancellation_refund_id", "supplier_advance_id", "advance_refund_id",
      "purchase_id", "operating_expense_id", "expense_cancellation_id"
    ) = 1
  ),
  ADD CONSTRAINT "ck_cash_movements_direction" CHECK (
    (
      ("payment_id" IS NOT NULL OR "advance_refund_id" IS NOT NULL OR "expense_cancellation_id" IS NOT NULL)
      AND "direction" = 'inflow'
    )
    OR
    (
      (
        "payment_correction_id" IS NOT NULL OR "return_refund_id" IS NOT NULL
        OR "sale_cancellation_refund_id" IS NOT NULL OR "supplier_advance_id" IS NOT NULL
        OR "purchase_id" IS NOT NULL OR "operating_expense_id" IS NOT NULL
      )
      AND "direction" = 'outflow'
    )
  ),
  ADD CONSTRAINT "fk_cash_movements_operating_expense" FOREIGN KEY ("operating_expense_id") REFERENCES "operating_expenses"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "fk_cash_movements_expense_cancellation" FOREIGN KEY ("expense_cancellation_id") REFERENCES "expense_cancellations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE UNIQUE INDEX "uq_cash_movements_operating_expense" ON "cash_movements"("operating_expense_id");
CREATE UNIQUE INDEX "uq_cash_movements_expense_cancellation" ON "cash_movements"("expense_cancellation_id");
