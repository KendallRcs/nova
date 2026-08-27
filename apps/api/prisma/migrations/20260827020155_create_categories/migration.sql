-- CreateEnum
CREATE TYPE "record_status" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "description" TEXT,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_categories_name_normalized" ON "categories"("name_normalized");

-- CreateIndex
CREATE INDEX "idx_categories_status_name" ON "categories"("status", "name_normalized");
