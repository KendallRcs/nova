CREATE TYPE "customer_status" AS ENUM ('active', 'merged');

CREATE TABLE "customers" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "name_normalized" TEXT NOT NULL,
  "phone_normalized" TEXT NOT NULL,
  "dni" TEXT,
  "address" TEXT,
  "status" "customer_status" NOT NULL DEFAULT 'active',
  "merged_into_customer_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fk_customers_merged_into" FOREIGN KEY ("merged_into_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "ck_customers_name" CHECK (btrim("name") <> ''),
  CONSTRAINT "ck_customers_phone" CHECK ("phone_normalized" ~ '^[+][1-9][0-9]{7,14}$'),
  CONSTRAINT "ck_customers_dni" CHECK ("dni" IS NULL OR "dni" ~ '^[0-9]{8}$'),
  CONSTRAINT "ck_customers_version" CHECK ("version" > 0),
  CONSTRAINT "ck_customers_merge_state" CHECK (
    ("status" = 'active' AND "merged_into_customer_id" IS NULL)
    OR ("status" = 'merged' AND "merged_into_customer_id" IS NOT NULL AND "merged_into_customer_id" <> "id")
  ),
  CONSTRAINT "ck_customers_timestamps" CHECK ("updated_at" >= "created_at")
);

CREATE UNIQUE INDEX "uq_customers_canonical_phone"
  ON "customers"("phone_normalized")
  WHERE "merged_into_customer_id" IS NULL;
CREATE INDEX "idx_customers_search_name" ON "customers"("name_normalized", "id");
CREATE INDEX "idx_customers_merged_into" ON "customers"("merged_into_customer_id");
