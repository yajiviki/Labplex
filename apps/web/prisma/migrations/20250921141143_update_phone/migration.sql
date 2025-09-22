-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "tpaName" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "insuranceName" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Vendor" ("address", "createdAt", "id", "insuranceName", "isActive", "phone", "tpaName", "updatedAt", "vendorId") SELECT "address", "createdAt", "id", "insuranceName", "isActive", "phone", "tpaName", "updatedAt", "vendorId" FROM "Vendor";
DROP TABLE "Vendor";
ALTER TABLE "new_Vendor" RENAME TO "Vendor";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
