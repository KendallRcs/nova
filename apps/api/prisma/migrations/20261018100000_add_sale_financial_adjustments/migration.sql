CREATE TYPE "sale_closure_type" AS ENUM ('complete', 'incomplete');

CREATE TABLE "sale_total_adjustments" (
  "id" UUID NOT NULL,
  "sale_id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "previous_total_cents" BIGINT NOT NULL,
  "new_total_cents" BIGINT NOT NULL,
  "difference_cents" BIGINT NOT NULL,
  "reason" TEXT NOT NULL,
  "changed_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "resulting_sale_version" INTEGER NOT NULL,
  CONSTRAINT "sale_total_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_sale_total_adjustments_totals" CHECK (
    "previous_total_cents" >= 0
    AND "new_total_cents" >= 0
    AND "difference_cents" = "new_total_cents" - "previous_total_cents"
  ),
  CONSTRAINT "ck_sale_total_adjustments_reason" CHECK (btrim("reason") <> ''),
  CONSTRAINT "ck_sale_total_adjustments_fingerprint" CHECK (btrim("request_fingerprint") <> ''),
  CONSTRAINT "ck_sale_total_adjustments_version" CHECK ("resulting_sale_version" > 0),
  CONSTRAINT "fk_sale_total_adjustments_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_sale_total_adjustments_actor" FOREIGN KEY ("changed_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_sale_total_adjustments_operation" ON "sale_total_adjustments"("operation_id");
CREATE INDEX "idx_sale_total_adjustments_sale_date" ON "sale_total_adjustments"("sale_id", "effective_at", "id");

CREATE TABLE "sale_closures" (
  "id" UUID NOT NULL,
  "sale_id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "type" "sale_closure_type" NOT NULL,
  "forgiven_amount_cents" BIGINT NOT NULL,
  "reason" TEXT,
  "closed_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "resulting_sale_version" INTEGER NOT NULL,
  CONSTRAINT "sale_closures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_sale_closures_fingerprint" CHECK (btrim("request_fingerprint") <> ''),
  CONSTRAINT "ck_sale_closures_version" CHECK ("resulting_sale_version" > 0),
  CONSTRAINT "ck_sale_closures_reason" CHECK (
    ("type" = 'complete' AND "forgiven_amount_cents" = 0 AND "reason" IS NULL)
    OR
    ("type" = 'incomplete' AND "forgiven_amount_cents" > 0 AND btrim("reason") <> '')
  ),
  CONSTRAINT "fk_sale_closures_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_sale_closures_actor" FOREIGN KEY ("closed_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_sale_closures_sale" ON "sale_closures"("sale_id");
CREATE UNIQUE INDEX "uq_sale_closures_operation" ON "sale_closures"("operation_id");
CREATE INDEX "idx_sale_closures_actor_date" ON "sale_closures"("closed_by", "effective_at" DESC, "id" DESC);

CREATE TABLE "payment_corrections" (
  "id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "amount_cents" BIGINT NOT NULL,
  "reason" TEXT NOT NULL,
  "corrected_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "resulting_sale_version" INTEGER NOT NULL,
  CONSTRAINT "payment_corrections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_payment_corrections_amount" CHECK ("amount_cents" > 0),
  CONSTRAINT "ck_payment_corrections_reason" CHECK (btrim("reason") <> ''),
  CONSTRAINT "ck_payment_corrections_fingerprint" CHECK (btrim("request_fingerprint") <> ''),
  CONSTRAINT "ck_payment_corrections_version" CHECK ("resulting_sale_version" > 0),
  CONSTRAINT "fk_payment_corrections_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_payment_corrections_actor" FOREIGN KEY ("corrected_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_payment_corrections_operation" ON "payment_corrections"("operation_id");
CREATE INDEX "idx_payment_corrections_payment_date" ON "payment_corrections"("payment_id", "effective_at", "id");

ALTER TABLE "cash_movements"
  ALTER COLUMN "payment_id" DROP NOT NULL,
  ADD COLUMN "payment_correction_id" UUID;

ALTER TABLE "cash_movements"
  DROP CONSTRAINT "ck_cash_movements_payment_direction",
  ADD CONSTRAINT "ck_cash_movements_origin" CHECK (
    num_nonnulls("payment_id", "payment_correction_id") = 1
  ),
  ADD CONSTRAINT "ck_cash_movements_direction" CHECK (
    ("payment_id" IS NOT NULL AND "direction" = 'inflow')
    OR
    ("payment_correction_id" IS NOT NULL AND "direction" = 'outflow')
  ),
  ADD CONSTRAINT "fk_cash_movements_payment_correction" FOREIGN KEY ("payment_correction_id") REFERENCES "payment_corrections"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "uq_cash_movements_payment_correction" ON "cash_movements"("payment_correction_id");
