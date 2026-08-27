/*
  Warnings:

  - Added the required column `credential_expires_at` to the `sessions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "credential_expires_at" TIMESTAMPTZ(3) NOT NULL;

ALTER TABLE "sessions"
ADD CONSTRAINT "ck_sessions_credential_expiration"
CHECK ("credential_expires_at" > "renewed_at");
