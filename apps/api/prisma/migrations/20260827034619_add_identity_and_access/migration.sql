-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('active', 'inactive', 'password_change_required');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('active', 'closed', 'revoked');

-- CreateTable
CREATE TABLE "access_profiles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "access_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_permissions" (
    "profile_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "pk_profile_permissions" PRIMARY KEY ("profile_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_accounts" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "username_normalized" TEXT NOT NULL,
    "credential_hash" TEXT NOT NULL,
    "status" "account_status" NOT NULL DEFAULT 'password_change_required',
    "security_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "protected_credential" TEXT NOT NULL,
    "issued_security_version" INTEGER NOT NULL,
    "status" "session_status" NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "issued_at" TIMESTAMPTZ(3) NOT NULL,
    "renewed_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),
    "end_reason" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_access_profiles_name_normalized" ON "access_profiles"("name_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "uq_permissions_code" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "idx_permissions_module_action" ON "permissions"("module", "action");

-- CreateIndex
CREATE INDEX "idx_profile_permissions_permission" ON "profile_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_accounts_username_normalized" ON "user_accounts"("username_normalized");

-- CreateIndex
CREATE INDEX "idx_user_accounts_profile_status" ON "user_accounts"("profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sessions_protected_credential" ON "sessions"("protected_credential");

-- CreateIndex
CREATE INDEX "idx_sessions_user_status" ON "sessions"("user_id", "status");

-- AddForeignKey
ALTER TABLE "profile_permissions" ADD CONSTRAINT "profile_permissions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "access_profiles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "profile_permissions" ADD CONSTRAINT "profile_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "access_profiles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Domain integrity not expressible in the Prisma schema
ALTER TABLE "access_profiles"
ADD CONSTRAINT "ck_access_profiles_names_not_blank"
CHECK (btrim("name") <> '' AND btrim("name_normalized") <> ''),
ADD CONSTRAINT "ck_access_profiles_timestamps"
CHECK ("updated_at" >= "created_at");

ALTER TABLE "permissions"
ADD CONSTRAINT "ck_permissions_values_not_blank"
CHECK (btrim("code") <> '' AND btrim("module") <> '' AND btrim("action") <> '');

ALTER TABLE "user_accounts"
ADD CONSTRAINT "ck_user_accounts_username_not_blank"
CHECK (btrim("username_normalized") <> ''),
ADD CONSTRAINT "ck_user_accounts_credential_hash_not_blank"
CHECK (btrim("credential_hash") <> ''),
ADD CONSTRAINT "ck_user_accounts_security_version_positive"
CHECK ("security_version" > 0),
ADD CONSTRAINT "ck_user_accounts_timestamps"
CHECK ("updated_at" >= "created_at");

ALTER TABLE "sessions"
ADD CONSTRAINT "ck_sessions_credential_not_blank"
CHECK (btrim("protected_credential") <> ''),
ADD CONSTRAINT "ck_sessions_security_version_positive"
CHECK ("issued_security_version" > 0),
ADD CONSTRAINT "ck_sessions_renewal_after_issue"
CHECK ("renewed_at" >= "issued_at"),
ADD CONSTRAINT "ck_sessions_ending_matches_status"
CHECK (
  ("status" = 'active' AND "ended_at" IS NULL AND "end_reason" IS NULL)
  OR
  ("status" IN ('closed', 'revoked') AND "ended_at" IS NOT NULL AND btrim("end_reason") <> '')
);
