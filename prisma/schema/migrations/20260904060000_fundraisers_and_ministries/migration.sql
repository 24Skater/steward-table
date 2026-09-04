-- Catches the migrations up with the schema.
--
-- The ministries and fundraisers feature — two tables, several columns and a
-- Channel enum value — existed in prisma/schema and in application code but in
-- no migration. Development had been using `prisma db push`, which syncs a
-- local database without recording how, so local databases worked while the
-- migration history quietly rotted.
--
-- The consequence was not theoretical: `prisma migrate deploy` against a fresh
-- database produced a schema the app could not run on, and the seed failed on
-- `catalogs.ministryId does not exist`. Found by running the E2E suite in CI
-- for the first time.
--
-- Generated with `prisma migrate diff` from the existing migrations to the
-- current schema, so it states exactly the gap and nothing more.

-- AlterEnum
ALTER TYPE "Channel" ADD VALUE 'VOLUNTEER';

-- AlterTable
ALTER TABLE "catalogs" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "minItemsForDelivery" INTEGER,
ADD COLUMN     "ministryId" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "clientRequestId" TEXT,
ADD COLUMN     "takenById" TEXT,
ADD COLUMN     "takenByName" TEXT;

-- CreateTable
CREATE TABLE "ministries" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ministries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_links" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "volunteer_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ministries_churchId_idx" ON "ministries"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX "ministries_churchId_name_key" ON "ministries"("churchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_links_tokenHash_key" ON "volunteer_links"("tokenHash");

-- CreateIndex
CREATE INDEX "volunteer_links_churchId_idx" ON "volunteer_links"("churchId");

-- CreateIndex
CREATE INDEX "volunteer_links_catalogId_idx" ON "volunteer_links"("catalogId");

-- CreateIndex
CREATE INDEX "catalogs_churchId_ministryId_idx" ON "catalogs"("churchId", "ministryId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_churchId_clientRequestId_key" ON "orders"("churchId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "catalogs" ADD CONSTRAINT "catalogs_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "ministries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ministries" ADD CONSTRAINT "ministries_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_links" ADD CONSTRAINT "volunteer_links_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

