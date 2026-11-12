# Spark POS Workspace Migration

Date: 2026-11-12
Branch: `ak-free-backend-migration`

## Why the current workspace cannot be opened to staff

The APK currently stores the complete shop database as one local object with arrays:
`products`, `sales`, `purchases`, `people`, `payments`, `expenses`, and `shop` settings. Shop-owner data is synced as one Firestore document at `users/{uid}/private/appData`; staff workspace reads and writes use the `loadShopWorkspace` and `saveShopWorkspace` callable functions.

Giving a cashier access to that single blob would expose products' cost prices, purchases, supplier details, expenses, and reports. Hiding those screens in the UI is not an authorization boundary. Therefore the old blob must not be made readable to staff as a shortcut.

## New tenant-scoped collection layout

Each customer shop uses its authenticated shop-owner UID as `shopId`. The Platform Owner's own POS workspace uses the Platform Owner UID and remains separate.

- `shops/{shopId}/pos/products/records/{productId}`
- `shops/{shopId}/pos/sales/records/{saleId}`
- `shops/{shopId}/pos/purchases/records/{purchaseId}`
- `shops/{shopId}/pos/people/records/{personId}`
- `shops/{shopId}/pos/payments/records/{paymentId}`
- `shops/{shopId}/pos/expenses/records/{expenseId}`
- `shops/{shopId}/pos/settings/records/{documentId}`

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

## Current status

- Firestore Rules for the tenant-scoped collection paths and role matrix have been added on `ak-free-backend-migration`.
- Emulator test cases now cover cashier and manager collection permissions, cross-tenant access, and expired-license denial.
- APK migration adapter, collection repositories, login/membership fallback, data import, and Android runtime tests are **not implemented yet**.
- The APK must not be described as using the Spark staff backend until those gates are complete and the emulator suite passes.
- Do not deploy these rules to the live Firebase project yet. The APK still uses the old callable workspace flow.


## Latest static check

The branch Rules were reconstructed from the clean production-baseline file after an intermediate editing issue introduced duplicated/truncated text. The current file now has balanced rule braces and exactly one occurrence of each staff and tenant-POS match. The 19-test source parses as JavaScript. Emulator execution remains unconfirmed, and APK migration is still pending.


The Firestore document path includes the `records` subcollection segment so each record has a valid even-segment document path. The first emulator run caught and corrected this path error; the updated workflow is running again.
