-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendor" TEXT NOT NULL,
    "purchaseDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "category" TEXT NOT NULL,
    "itemDescription" TEXT,
    "warrantyExpiresAt" DATETIME,
    "returnExpiresAt" DATETIME,
    "source" TEXT NOT NULL,
    "originalFileUrl" TEXT,
    "rawText" TEXT,
    "warrantyReminderSent" BOOLEAN NOT NULL DEFAULT false,
    "returnReminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Receipt_category_idx" ON "Receipt"("category");

-- CreateIndex
CREATE INDEX "Receipt_warrantyExpiresAt_idx" ON "Receipt"("warrantyExpiresAt");

-- CreateIndex
CREATE INDEX "Receipt_returnExpiresAt_idx" ON "Receipt"("returnExpiresAt");
