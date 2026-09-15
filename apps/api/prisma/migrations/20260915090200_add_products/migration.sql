CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "code_normalized" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "search_name" TEXT NOT NULL,
    "description" TEXT,
    "minimum_price_cents" BIGINT NOT NULL,
    "suggested_price_cents" BIGINT,
    "maximum_price_cents" BIGINT,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_products_required_text" CHECK (length(trim("code")) > 0 AND length(trim("name")) > 0),
    CONSTRAINT "ck_products_prices_nonnegative" CHECK (
      "minimum_price_cents" >= 0 AND
      ("suggested_price_cents" IS NULL OR "suggested_price_cents" >= 0) AND
      ("maximum_price_cents" IS NULL OR "maximum_price_cents" >= 0)
    ),
    CONSTRAINT "ck_products_price_range" CHECK (
      ("suggested_price_cents" IS NULL OR "minimum_price_cents" <= "suggested_price_cents") AND
      ("maximum_price_cents" IS NULL OR "minimum_price_cents" <= "maximum_price_cents") AND
      ("suggested_price_cents" IS NULL OR "maximum_price_cents" IS NULL OR "suggested_price_cents" <= "maximum_price_cents")
    ),
    CONSTRAINT "ck_products_timestamps" CHECK ("updated_at" >= "created_at"),
    CONSTRAINT "fk_products_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "product_tags" (
    "product_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    CONSTRAINT "pk_product_tags" PRIMARY KEY ("product_id", "tag_id"),
    CONSTRAINT "fk_product_tags_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT "fk_product_tags_tag" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_product_images_position" CHECK ("position" IN (1, 2)),
    CONSTRAINT "fk_product_images_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "uq_products_code_normalized" ON "products"("code_normalized");
CREATE INDEX "idx_products_category_status" ON "products"("category_id", "status");
CREATE INDEX "idx_products_search_name_id" ON "products"("search_name", "id");
CREATE INDEX "idx_product_tags_tag_product" ON "product_tags"("tag_id", "product_id");
CREATE UNIQUE INDEX "uq_product_images_storage_key" ON "product_images"("storage_key");
CREATE UNIQUE INDEX "uq_product_images_product_position" ON "product_images"("product_id", "position");
