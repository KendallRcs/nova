CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_tags_timestamps" CHECK ("updated_at" >= "created_at")
);

CREATE UNIQUE INDEX "uq_tags_name_normalized" ON "tags"("name_normalized");
CREATE INDEX "idx_tags_status_name" ON "tags"("status", "name_normalized");
