CREATE TABLE "customer_merges" (
  "id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "primary_customer_id" UUID NOT NULL,
  "duplicate_customer_id" UUID NOT NULL,
  "expected_primary_version" INTEGER NOT NULL,
  "expected_duplicate_version" INTEGER NOT NULL,
  "resolved_name" TEXT NOT NULL,
  "resolved_phone_normalized" TEXT NOT NULL,
  "resolved_dni" TEXT,
  "resolved_address" TEXT,
  "merged_by" UUID NOT NULL,
  "merged_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customer_merges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fk_customer_merges_primary" FOREIGN KEY ("primary_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_customer_merges_duplicate" FOREIGN KEY ("duplicate_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_customer_merges_actor" FOREIGN KEY ("merged_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "ck_customer_merges_distinct" CHECK ("primary_customer_id" <> "duplicate_customer_id"),
  CONSTRAINT "ck_customer_merges_versions" CHECK ("expected_primary_version" > 0 AND "expected_duplicate_version" > 0),
  CONSTRAINT "ck_customer_merges_name" CHECK (btrim("resolved_name") <> ''),
  CONSTRAINT "ck_customer_merges_phone" CHECK ("resolved_phone_normalized" ~ '^[+][1-9][0-9]{7,14}$'),
  CONSTRAINT "ck_customer_merges_dni" CHECK ("resolved_dni" IS NULL OR "resolved_dni" ~ '^[0-9]{8}$')
);

CREATE UNIQUE INDEX "uq_customer_merges_operation" ON "customer_merges"("operation_id");
CREATE UNIQUE INDEX "uq_customer_merges_duplicate" ON "customer_merges"("duplicate_customer_id");
CREATE INDEX "idx_customer_merges_primary_date" ON "customer_merges"("primary_customer_id", "merged_at" DESC, "id" DESC);
