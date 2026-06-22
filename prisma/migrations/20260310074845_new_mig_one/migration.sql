-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('CREATED', 'SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReleaseLinkMode" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "ReleasePrSource" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "ReleaseNoteScope" AS ENUM ('FULL', 'OWN');

-- AlterTable
ALTER TABLE "prs" ADD COLUMN     "release_mode" "ReleaseLinkMode" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "release_pr_map" ADD COLUMN     "added_by" UUID,
ADD COLUMN     "source" "ReleasePrSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "releases" ADD COLUMN     "cutoff_at" TIMESTAMP(3),
ADD COLUMN     "status" "ReleaseStatus" NOT NULL DEFAULT 'CREATED';

-- CreateTable
CREATE TABLE "release_notes" (
    "id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "owner_id" UUID,
    "scope" "ReleaseNoteScope" NOT NULL,
    "content" TEXT NOT NULL,
    "other" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "release_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "release_notes_release_id_scope_owner_id_key" ON "release_notes"("release_id", "scope", "owner_id");

-- AddForeignKey
ALTER TABLE "release_pr_map" ADD CONSTRAINT "release_pr_map_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_notes" ADD CONSTRAINT "release_notes_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_notes" ADD CONSTRAINT "release_notes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_notes" ADD CONSTRAINT "release_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_notes" ADD CONSTRAINT "release_notes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
