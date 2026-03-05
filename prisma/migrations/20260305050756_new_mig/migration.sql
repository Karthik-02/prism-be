-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "email_domains" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notification_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "otp_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "prs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "releases" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;
