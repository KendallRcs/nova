CREATE TYPE "initial_import_status" AS ENUM ('validated', 'failed', 'confirmed');

CREATE TABLE "initial_product_imports" (
  "id" UUID NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_checksum" TEXT NOT NULL,
  "status" "initial_import_status" NOT NULL,
  "total_rows" INTEGER NOT NULL,
  "valid_rows" INTEGER NOT NULL,
  "warning_count" INTEGER NOT NULL,
  "error_count" INTEGER NOT NULL,
  "validation_summary" JSONB NOT NULL,
  "normalized_rows" JSONB NOT NULL,
  "requested_by" UUID NOT NULL,
  "validated_at" TIMESTAMPTZ(3) NOT NULL,
  "confirmation_operation_id" UUID,
  "confirmed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "initial_product_imports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_initial_imports_file" CHECK (btrim("file_name") <> '' AND "file_checksum" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ck_initial_imports_counts" CHECK (
    "total_rows" >= 0 AND "valid_rows" >= 0 AND "warning_count" >= 0 AND "error_count" >= 0
    AND "valid_rows" <= "total_rows"
  ),
  CONSTRAINT "ck_initial_imports_state" CHECK (
    ("status" = 'validated' AND "error_count" = 0 AND "confirmed_at" IS NULL AND "confirmation_operation_id" IS NULL)
    OR ("status" = 'failed' AND "error_count" > 0 AND "confirmed_at" IS NULL AND "confirmation_operation_id" IS NULL)
    OR ("status" = 'confirmed' AND "error_count" = 0 AND "confirmed_at" IS NOT NULL AND "confirmation_operation_id" IS NOT NULL)
  ),
  CONSTRAINT "fk_initial_imports_requester" FOREIGN KEY ("requested_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "uq_initial_imports_confirmation_operation" ON "initial_product_imports"("confirmation_operation_id");
CREATE UNIQUE INDEX "uq_initial_imports_single_confirmed" ON "initial_product_imports"((1)) WHERE "status" = 'confirmed';
CREATE INDEX "idx_initial_imports_status_date" ON "initial_product_imports"("status", "validated_at" DESC, "id" DESC);

ALTER TABLE "inventory_movements" ADD COLUMN "initial_import_id" UUID;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "fk_inventory_movements_initial_import" FOREIGN KEY ("initial_import_id") REFERENCES "initial_product_imports"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "idx_inventory_movements_initial_import_date" ON "inventory_movements"("initial_import_id", "effective_at", "id");

ALTER TABLE "cost_movements" ADD COLUMN "initial_import_id" UUID;
ALTER TABLE "cost_movements"
  ADD CONSTRAINT "fk_cost_movements_initial_import" FOREIGN KEY ("initial_import_id") REFERENCES "initial_product_imports"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "idx_cost_movements_initial_import_date" ON "cost_movements"("initial_import_id", "effective_at", "id");
