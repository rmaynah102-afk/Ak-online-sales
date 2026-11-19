# AK Sale POS — Multi-Business V3 Implementation Specification

Status: Development branch only. This file does not change the production V2 app or database.

## Non-regression rules
- Preserve the existing V2 login, shop-owner subscription/licensing, staff login, products, sales, purchases, customers/suppliers, expenses, reports, printer, advertising/share, backup/restore, Firebase and Cloudflare gateway flows.
- Do not delete, rename, or migrate existing collections or local-storage keys as part of the first rollout.
- Keep the existing package ID `com.ak.hardware.sales`; any APK update must use the same signing identity and a versionCode greater than the installed release.
- No in-app KPay/WavePay checkout. Platform Owner continues to manage shop activation and expiry externally.
- Build and test on this branch before any production merge or release.

## Business profiles
A shop selects one primary profile during setup. The profile controls optional navigation and domain-specific fields; shared POS capabilities remain available to every profile.

Profiles:
1. Hardware and electrical
2. Grocery and mini-mart
3. Wholesale and distribution
4. Clothing and fashion
5. Mobile phone and electronics
6. Restaurant
7. Cafe and bakery
8. Pharmacy
9. Salon and barber
10. Books and stationery
11. Automotive and motorcycle parts/service
12. Agriculture and livestock supplies
13. General retail (fallback for businesses not covered above)

## Shared capabilities
- Shop identity and receipt branding: shop name, logo, phone, address, receipt header/footer.
- Products/services, sales, purchases, customers, suppliers, expenses and reports.
- Cash, partial payment and credit tracking.
- Staff roles and least-privilege permissions.
- Audit history for sensitive actions.
- Branches, branch-level stock, transfer request/dispatch/receipt and reconciliation.
- Daily cash opening/closing and cash variance.
- Returns/refunds linked to the original receipt.
- Offline transaction queue with conflict-aware sync and visible sync status.
- Backup/restore with validation and a pre-restore backup.

## Profile-specific modules
- Hardware/electrical: multiple units and conversion factors, retail/wholesale price tiers, barcode aliases, stock reorder levels.
- Grocery/mini-mart: weighted items, expiry and batch tracking, quick barcode checkout.
- Wholesale/distribution: customer price lists, bulk quantity tiers, delivery records, warehouse stock.
- Clothing/fashion: size/color/style variants, variant-level stock and exchanges.
- Mobile/electronics: IMEI/serial tracking, warranty and repair intake.
- Restaurant: table service, order tickets, kitchen print routing, split bills, menu modifiers.
- Cafe/bakery: recipes, ingredient consumption, production batches, size/add-on options.
- Pharmacy: batch/expiry tracking and controlled stock workflows; regulatory compliance must be reviewed before enabling sale-critical features.
- Salon/barber: appointments, service catalog, staff commission and customer visit history.
- Books/stationery: ISBN/barcode, category and school-supply bundles.
- Automotive: vehicle compatibility, part references, repair job cards and labor charges.
- Agriculture/livestock: unit conversions, batch/expiry, supplier and wholesale pricing.
- General retail: core inventory and checkout only.

## Data and security requirements
- Every shop-owned record is scoped by shopId; branch-owned stock and transactions also carry branchId.
- Never trust client-supplied role, shopId, branchId or permission claims without server-side verification.
- Owner controls branches and staff; managers receive only explicitly granted permissions; cashiers cannot read cost/profit data; stock staff cannot access cash, expenses or reports unless granted.
- Transfers must be auditable and use a request/dispatch/receive state flow; never silently edit stock in two branches.
- Audit events are append-only and include actor, timestamp, entity, action and branch.
- Profile settings must be stored in the authenticated shop workspace/cloud record, not only browser localStorage, so all devices see the same configuration.
- Validate Firestore rules and Cloudflare Worker authorization before enabling any new write path.

## Rollout sequence
1. Inventory the current V2 data model and regression-test existing flows.
2. Add profile selection/settings and shared shop branding without changing legacy records.
3. Add permission model and audit events; fix staff provisioning securely.
4. Add branch model and stock transfers.
5. Add shared returns, cash close and offline sync.
6. Add profile modules in independently testable groups.
7. Build signed APK with incremented versionCode; verify package ID, signing certificate, install-over-update and data retention on a test device.
8. Publish only after successful workflow and manual acceptance tests.

## Acceptance criteria
- Existing shop can open V3 without re-registering or losing records.
- Existing login and subscription expiry behavior remains unchanged.
- Profile selection changes only relevant UI/modules, not existing transaction history.
- A shop cannot read or mutate another shop's data.
- Staff permissions are enforced by Firestore/server rules, not only hidden buttons.
- Branch transfers reconcile source and destination stock exactly once.
- Receipts use the shop's own saved branding.
- Offline transactions are not duplicated after reconnect.
- APK installs as an update over the currently installed signed app without uninstalling it.
