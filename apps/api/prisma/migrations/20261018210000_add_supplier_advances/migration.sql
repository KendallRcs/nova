CREATE TYPE "supplier_kind" AS ENUM ('registered', 'occasional');
CREATE TYPE "supplier_advance_status" AS ENUM ('pending', 'resolved');

CREATE TABLE "suppliers" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "name_normalized" TEXT NOT NULL,
  "kind" "supplier_kind" NOT NULL DEFAULT 'registered',
  "phone" TEXT,
  "document" TEXT,
  "description" TEXT,
  "status" "record_status" NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_suppliers_name" CHECK (btrim("name") <> ''),
  CONSTRAINT "ck_suppliers_name_normalized" CHECK (btrim("name_normalized") <> ''),
  CONSTRAINT "ck_suppliers_version" CHECK ("version" > 0),
  CONSTRAINT "ck_suppliers_dates" CHECK ("updated_at" >= "created_at")
);

CREATE INDEX "idx_suppliers_status_name" ON "suppliers"("status", "name_normalized", "id");

CREATE TABLE "supplier_advances" (
  "id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "supplier_id" UUID NOT NULL,
  "original_amount_cents" BIGINT NOT NULL,
  "current_balance_cents" BIGINT NOT NULL,
  "method" "payment_method" NOT NULL,
  "purpose" TEXT,
  "status" "supplier_advance_status" NOT NULL DEFAULT 'pending',
  "version" INTEGER NOT NULL DEFAULT 1,
  "registered_by" UUID NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_advances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_supplier_advances_amounts" CHECK (
    "original_amount_cents" > 0
    AND "current_balance_cents" >= 0
    AND "current_balance_cents" <= "original_amount_cents"
  ),
  CONSTRAINT "ck_supplier_advances_status" CHECK (
    ("status" = 'pending' AND "current_balance_cents" > 0)
    OR ("status" = 'resolved' AND "current_balance_cents" = 0)
  ),
  CONSTRAINT "ck_supplier_advances_version" CHECK ("version" > 0),
  CONSTRAINT "ck_supplier_advances_fingerprint" CHECK (btrim("request_fingerprint") <> ''),
  CONSTRAINT "fk_supplier_advances_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_supplier_advances_registrar" FOREIGN KEY ("registered_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_supplier_advances_operation" ON "supplier_advances"("operation_id");
CREATE INDEX "idx_supplier_advances_supplier_status_date" ON "supplier_advances"("supplier_id", "status", "effective_at" DESC, "id" DESC);
CREATE INDEX "idx_supplier_advances_registrar_date" ON "supplier_advances"("registered_by", "effective_at" DESC, "id" DESC);

ALTER TABLE "cash_movements" ADD COLUMN "supplier_advance_id" UUID;
ALTER TABLE "cash_movements"
  DROP CONSTRAINT "ck_cash_movements_origin",
  DROP CONSTRAINT "ck_cash_movements_direction",
  ADD CONSTRAINT "ck_cash_movements_origin" CHECK (
    num_nonnulls(
      "payment_id",
      "payment_correction_id",
      "return_refund_id",
      "sale_cancellation_refund_id",
      "supplier_advance_id"
    ) = 1
  ),
  ADD CONSTRAINT "ck_cash_movements_direction" CHECK (
    ("payment_id" IS NOT NULL AND "direction" = 'inflow')
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
  ADD CONSTRAINT "fk_cash_movements_supplier_advance" FOREIGN KEY ("supplier_advance_id") REFERENCES "supplier_advances"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "uq_cash_movements_supplier_advance" ON "cash_movements"("supplier_advance_id");
