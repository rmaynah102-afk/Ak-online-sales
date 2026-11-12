# Spark POS Workspace Migration

Date: 2026-11-12
Branch: `ak-free-backend-migration`

## Why the current workspace cannot be opened to staff

The APK currently stores the complete shop database as one local object with arrays:
`products`, `sales`, `purchases`, `people`, `payments`, `expenses`, and `shop` settings. Shop-owner data is synced as one Firestore document at `users/{uid}/private/appData`; staff workspace reads and writes use the `loadShopWorkspace` and `saveShopWorkspace` callable functions.

Giving a cashier access to that single blob would expose products' cost prices, purchases, supplier details, expenses, and reports. Hiding those screens in the UI is not an authorization boundary. Therefore the old blob must not be made readable to staff as a shortcut.

## New tenant-scoped collection layout

Each customer shop uses its authenticated shop-owner UID as `shopId`. The Platform Owner's own POS workspace uses the Platform Owner UID and remains separate.

- `shops/{shopId}/pos/products/records/{productId}` (no cost/profit fields)
- `shops/{shopId}/pos/sales/records/{saleId}` (no cost/profit fields)
- `shops/{shopId}/pos/purchases/records/{purchaseId}`
- `shops/{shopId}/pos/people/records/{personId}`
- `shops/{shopId}/pos/payments/records/{paymentId}`
- `shops/{shopId}/pos/expenses/records/{expenseId}`
- `shops/{shopId}/pos/settings/records/{documentId}`
- `shops/{shopId}/pos/productCosts/records/{productId}` (manager/owner only)
- `shops/{shopId}/pos/saleCosts/records/{saleId}` (manager/owner only)

The existing `shops/{shopId}/workspace/current` document remains revision metadata only. It is not the POS data store.

## Firestore role matrix implemented on the migration branch

| Collection | Employee | Cashier | Manager | Shop owner |
|---|---|---|---|---|
| products | Read | Read | Read/write | Full |
| sales | — | Read/create | Read/write | Full |
| purchases | — | — | Read/write | Full |
| people | — | Read/create/update | Read/write | Full |
| payments | — | Read/create | Read/write | Full |
| expenses | — | — | Read/write | Full |
| settings | — | — | — | Full |

The Platform Owner can access only the Platform Owner's own shop UID path; the Owner Control Center remains separately protected by the verified allowlisted email.

The new Rules use `shopMembers/{uid}` membership documents and the active shop license. They do not trust client-supplied role flags or custom token claims for these new collection paths. Expired shop licenses block staff reads and writes.

## APK migration gates

1. Keep the current production blob and Cloud Functions untouched while migration is in progress.
2. Add a migration adapter that reads the old blob and writes each array item to its collection, preserving document IDs and adding a schema version.
3. Use bounded batches (maximum 500 writes per Firestore batch), idempotent upserts, and a migration marker. Never delete the old blob during first migration.
4. Compare source and destination counts and key totals (stock, sales totals, purchase totals, receivables/payables) before switching the shop.
5. Change the POS repositories to load/save only the relevant collection. A cashier must never download purchases, expenses, or cost-price data.
6. Add per-role UI navigation only after Rules enforcement is active; UI hiding is not security.
7. Add emulator tests for each role, tenant isolation, expired license, and prohibited collection writes.
8. Keep a rollback path to the original local backup. Do not remove old callable functions until all tenants are migrated and runtime tests pass.

## Current status (2026-11-12)

- The tenant-scoped Firestore Rules and role matrix are implemented on `ak-free-backend-migration`.
- The latest Rules-only emulator run (workflow 43225122902, commit `5b1c983`) completed successfully with **20 passing tests**.
- A Spark-compatible data-layer module now exists at `apk/spark-pos-store.js` and is included in the web app shell, PWA cache, and Android web-asset copy list. It defines role-scoped reads, guarded writes, bounded idempotent upserts, a legacy-blob migration routine, per-record ID verification, and a migration marker. The old blob is not deleted.
- Product and sales cost/profit fields are recursively separated into manager/owner-only cost collections. Cashier reads do not load those cost collections. Data-URL product photos are omitted from cloud writes so local photos remain local.
- A separate Node test file now checks nested cost separation/reconstruction and role visibility. The CI workflow has been updated to run it before the Firestore emulator suite; the new workflow result is pending.
- **Important: although the module is now loaded as an app asset, the app does not call it yet and still uses the legacy callable workspace flow.** Shop-owner self-registration, direct Firestore staff membership/invite screens, actual POS repository switching, and data reconciliation against real shop data are not yet complete.
- Do not deploy the new Rules to production or issue a replacement APK yet. The old callable Functions remain untouched; switching the app before the remaining integration and tests would risk locking users out or exposing incomplete data.
