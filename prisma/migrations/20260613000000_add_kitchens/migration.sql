-- AlterTable
ALTER TABLE "catalogs" ADD COLUMN     "kitchenId" TEXT;

-- CreateTable
CREATE TABLE "kitchens" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "kitchens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kitchens_churchId_idx" ON "kitchens"("churchId");

-- CreateIndex
CREATE INDEX "kitchens_deletedAt_idx" ON "kitchens"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "kitchens_churchId_slug_key" ON "kitchens"("churchId", "slug");

-- CreateIndex
CREATE INDEX "catalogs_kitchenId_idx" ON "catalogs"("kitchenId");

-- AddForeignKey
ALTER TABLE "catalogs" ADD CONSTRAINT "catalogs_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "kitchens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchens" ADD CONSTRAINT "kitchens_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
