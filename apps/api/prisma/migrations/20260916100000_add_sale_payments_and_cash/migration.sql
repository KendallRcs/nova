CREATE TYPE "payment_method" AS ENUM ('cash', 'yape', 'plin', 'pos');
CREATE TYPE "payment_status" AS ENUM ('confirmed', 'partially_corrected', 'corrected');
CREATE TYPE "cash_movement_direction" AS ENUM ('inflow', 'outflow');
CREATE TYPE "cash_movement_status" AS ENUM ('confirmed', 'compensated');

CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "sale_id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "amount_cents" BIGINT NOT NULL,
  "method" "payment_method" NOT NULL,
  "status" "payment_status" NOT NULL DEFAULT 'confirmed',
  "balance_before_cents" BIGINT NOT NULL,
  "balance_after_cents" BIGINT NOT NULL,
  "paid_after_cents" BIGINT NOT NULL,
  "resulting_sale_version" INTEGER NOT NULL,
  "registered_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_payments_amount" CHECK ("amount_cents" > 0),
  CONSTRAINT "ck_payments_fingerprint" CHECK (btrim("request_fingerprint") <> ''),
  CONSTRAINT "ck_payments_balance" CHECK (
    "balance_before_cents" >= 0
    AND "balance_after_cents" >= 0
    AND "paid_after_cents" >= "amount_cents"
    AND "balance_after_cents" = "balance_before_cents" - "amount_cents"
  ),
  CONSTRAINT "ck_payments_sale_version" CHECK ("resulting_sale_version" > 0),
  CONSTRAINT "fk_payments_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_payments_registrar" FOREIGN KEY ("registered_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_payments_operation" ON "payments"("operation_id");
CREATE INDEX "idx_payments_sale_date" ON "payments"("sale_id", "effective_at", "id");
CREATE INDEX "idx_payments_registrar_date" ON "payments"("registered_by", "effective_at" DESC, "id" DESC);

CREATE TABLE "cash_movements" (
  "id" UUID NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "direction" "cash_movement_direction" NOT NULL,
  "amount_cents" BIGINT NOT NULL,
  "method" "payment_method" NOT NULL,
  "status" "cash_movement_status" NOT NULL DEFAULT 'confirmed',
  "registered_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "payment_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_cash_movements_amount" CHECK ("amount_cents" > 0),
  CONSTRAINT "ck_cash_movements_reason" CHECK (btrim("reason") <> ''),
  CONSTRAINT "ck_cash_movements_payment_direction" CHECK ("direction" = 'inflow'),
  CONSTRAINT "fk_cash_movements_registrar" FOREIGN KEY ("registered_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_cash_movements_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_cash_movements_idempotency" ON "cash_movements"("idempotency_key");
CREATE UNIQUE INDEX "uq_cash_movements_payment" ON "cash_movements"("payment_id");
CREATE INDEX "idx_cash_movements_date" ON "cash_movements"("effective_at" DESC, "id" DESC);
CREATE INDEX "idx_cash_movements_method_date" ON "cash_movements"("method", "effective_at" DESC, "id" DESC);
