CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING_VERIFICATION', 'DISAPPROVED');
CREATE TYPE "DomainStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "PrStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REREVIEW', 'DEPLOYED');
CREATE TYPE "PrType" AS ENUM ('FEATURE', 'ENHANCEMENT', 'BUG');
CREATE TYPE "ReleaseEnvironment" AS ENUM ('STAGING', 'PRODUCTION', 'UAT');
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "first_name" VARCHAR(100) NOT NULL DEFAULT '',
  "last_name" VARCHAR(100) NOT NULL DEFAULT '',
  "email" VARCHAR(255) NOT NULL,
  "github_user_id" VARCHAR(255) NOT NULL DEFAULT '',
  "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

CREATE TABLE "permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

CREATE TABLE "role_permissions" (
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE "user_roles" (
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id")
);

CREATE TABLE "email_domains" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domain" VARCHAR(255) NOT NULL,
  "status" "DomainStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_domains_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_domains_domain_key" ON "email_domains"("domain");

CREATE TABLE "otp_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL,
  "otp" VARCHAR(16) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "otp_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "otp_tokens_email_otp_used_idx" ON "otp_tokens"("email", "otp", "used");
CREATE INDEX "otp_tokens_email_created_at_idx" ON "otp_tokens"("email", "created_at");

CREATE TABLE "prs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "repo" VARCHAR(255) NOT NULL,
  "branch" VARCHAR(255) NOT NULL,
  "pr_link" TEXT NOT NULL,
  "reviewer_id" UUID,
  "status" "PrStatus" NOT NULL DEFAULT 'SUBMITTED',
  "type" "PrType" NOT NULL,
  "zoho_link" TEXT,
  "deployed_flag" BOOLEAN NOT NULL DEFAULT false,
  "comments" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "prs_owner_id_idx" ON "prs"("owner_id");
CREATE INDEX "prs_reviewer_id_idx" ON "prs"("reviewer_id");
CREATE INDEX "prs_status_idx" ON "prs"("status");

CREATE TABLE "releases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "environment" "ReleaseEnvironment" NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "release_date" TIMESTAMP(3),
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "releases_environment_idx" ON "releases"("environment");

CREATE TABLE "release_pr_map" (
  "release_id" UUID NOT NULL,
  "pr_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "release_pr_map_pkey" PRIMARY KEY ("release_id", "pr_id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "entity_type" VARCHAR(120) NOT NULL,
  "entity_id" UUID NOT NULL,
  "action" VARCHAR(120) NOT NULL,
  "performed_by" UUID NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "audit_logs_performed_by_idx" ON "audit_logs"("performed_by");

CREATE TABLE "notification_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_type" VARCHAR(120) NOT NULL,
  "recipient_id" UUID NOT NULL,
  "status" "NotificationStatus" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_logs_recipient_id_idx" ON "notification_logs"("recipient_id");

ALTER TABLE "roles"
  ADD CONSTRAINT "roles_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_roles"
  ADD CONSTRAINT "user_roles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_roles"
  ADD CONSTRAINT "user_roles_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_domains"
  ADD CONSTRAINT "email_domains_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prs"
  ADD CONSTRAINT "prs_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prs"
  ADD CONSTRAINT "prs_reviewer_id_fkey"
  FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "releases"
  ADD CONSTRAINT "releases_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "release_pr_map"
  ADD CONSTRAINT "release_pr_map_release_id_fkey"
  FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "release_pr_map"
  ADD CONSTRAINT "release_pr_map_pr_id_fkey"
  FOREIGN KEY ("pr_id") REFERENCES "prs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_performed_by_fkey"
  FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notification_logs"
  ADD CONSTRAINT "notification_logs_recipient_id_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
