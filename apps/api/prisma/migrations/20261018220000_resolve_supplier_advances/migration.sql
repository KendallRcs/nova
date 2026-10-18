ALTER TABLE "supplier_advances"
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "advance_refunds" (
  "id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "advance_id" UUID NOT NULL,
  "amount_cents" BIGINT NOT NULL,
  "method" "payment_method" NOT NULL,
  "resulting_balance_cents" BIGINT NOT NULL,
  "resulting_advance_version" INTEGER NOT NULL,
  "registered_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "advance_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_advance_refunds_amount" CHECK ("amount_cents" > 0),
  CONSTRAINT "ck_advance_refunds_balance" CHECK ("resulting_balance_cents" >= 0),
  CONSTRAINT "ck_advance_refunds_version" CHECK ("resulting_advance_version" > 1),
  CONSTRAINT "ck_advance_refunds_fingerprint" CHECK (btrim("request_fingerprint") <> ''),
  CONSTRAINT "fk_advance_refunds_advance" FOREIGN KEY ("advance_id") REFERENCES "supplier_advances"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_advance_refunds_registrar" FOREIGN KEY ("registered_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_advance_refunds_operation" ON "advance_refunds"("operation_id");
CREATE INDEX "idx_advance_refunds_advance_date" ON "advance_refunds"("advance_id", "effective_at", "id");

CREATE TABLE "advance_losses" (
  "id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "advance_id" UUID NOT NULL,
  "amount_cents" BIGINT NOT NULL,
  "reason" TEXT NOT NULL,
  "resulting_balance_cents" BIGINT NOT NULL,
  "resulting_advance_version" INTEGER NOT NULL,
  "registered_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "advance_losses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_advance_losses_amount" CHECK ("amount_cents" > 0),
  CONSTRAINT "ck_advance_losses_reason" CHECK (btrim("reason") <> ''),
  CONSTRAINT "ck_advance_losses_balance" CHECK ("resulting_balance_cents" >= 0),
  CONSTRAINT "ck_advance_losses_version" CHECK ("resulting_advance_version" > 1),
  CONSTRAINT "ck_advance_losses_fingerprint" CHECK (btrim("request_fingerprint") <> ''),
  CONSTRAINT "fk_advance_losses_advance" FOREIGN KEY ("advance_id") REFERENCES "supplier_advances"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_advance_losses_registrar" FOREIGN KEY ("registered_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_advance_losses_operation" ON "advance_losses"("operation_id");
CREATE INDEX "idx_advance_losses_advance_date" ON "advance_losses"("advance_id", "effective_at", "id");

ALTER TABLE "cash_movements" ADD COLUMN "advance_refund_id" UUID;
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
      "advance_refund_id"
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
      )
      AND "direction" = 'outflow'
    )
  ),
  ADD CONSTRAINT "fk_cash_movements_advance_refund" FOREIGN KEY ("advance_refund_id") REFERENCES "advance_refunds"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "uq_cash_movements_advance_refund" ON "cash_movements"("advance_refund_id");
