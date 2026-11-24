# AK Sale 3.5 Professional — Architecture and Release Plan

Status: design/audit in progress. This document is not a release certification. The original 2.1.317 branch remains the recovery baseline.

## Product direction

Build one all-inclusive AK Sale Professional product for Android phones/tablets and browser-based laptop/desktop use. Do not clone the legacy UI as the product architecture. Preserve only behavior that passes regression tests and migrate data safely.

## Non-negotiable account model

- Platform Owner: verified Google identity for painglin102@gmail.com; separate platform control center and separate personal POS workspace.
- Shop Owner: one tenant owner identity per shop, provisioned by the Platform Owner; owner-set password is required by product direction.
- Manager: role-limited shop member.
- Salesperson: role-limited shop member; no purchase cost, profit, or sensitive inventory data unless the shop owner explicitly grants a permission.
- Every authenticated request must be authorized server-side against the shop ID, membership, account status, subscription status, and role.
- Suspension must disable Firebase Auth, revoke refresh tokens, and leave a Firestore license/membership denial in place. Reactivation requires a valid unexpired subscription.
- Passwords must never be stored in Firestore, Worker KV, logs, audit records, or client-readable documents. Only Firebase Authentication may hold password verifiers.
- Every privileged account and subscription action must produce an immutable-style audit record with actor, target, action, timestamp, and result.

## Audit findings on the current review branch

1. Two incompatible shop-owner provisioning paths exist:
   - The v2 UI calls Cloudflare `/owner/provision`, which creates/reuses an Email/Password Firebase Auth user.
   - `functions/index.js` exposes `createShopOwnerAccount` as a pending invitation, and `claimOwnerProvisioning` requires a verified Google sign-in.
   These flows do not implement the same credential policy. They must be consolidated before account creation can be certified.

2. Two POS storage models coexist:
   - The v2 UI reads/writes `shops/{shopId}/pos/{collection}/records` directly.
   - Firebase Functions also implement versioned `shops/{shopId}/workspaceVersions` snapshots through `loadShopWorkspace` and `saveShopWorkspace`.
   A single canonical model and a tested migration/rollback path are required before changing the live data path.

3. Shop capacity is inconsistent:
   - v2 UI currently presents a 100-shop limit.
   - `functions/index.js` enforces 30 active shops.
   The product limit must be defined in one server-side constant and reflected by the UI; the client must not calculate or authorize capacity.

4. Staff provisioning has multiple generations:
   - Cloudflare Merchant Code provisioning and the Firebase Functions Gmail invite-code flow both exist.
   - Firestore rules and the Functions invite flow currently enforce up to three staff members.
   The product's three roles (Owner, Manager, Salesperson) must be represented consistently, with least-privilege server-side authorization. The Worker was aligned to the existing three-slot rule and a regression test was added.

5. The Android build workflow still identifies the package as version 2.1.318 and does not run the full backend/rules regression suite. It must not be relabeled 3.5.0 until the release gates below pass.

## Release gates for 3.5.0

### Identity and account control
- Owner Google login: verified email, exact allowlist, Android package/SHA-1 and web OAuth validation.
- Shop owner creation: owner-set password, duplicate Gmail handling, verification, no owner session loss, idempotent retry.
- Login: wrong password, disabled user, unverified user, expired license, suspended license, deleted member, revoked session, and offline/network failure.
- Owner actions: list users with pagination; create, suspend, reactivate, extend, reset credentials, revoke sessions; audit each action.
- No client-side role flags or UI-only restrictions are trusted.

### Tenant and role security
- Cross-shop read/write denied.
- Salesperson cannot read costs/profits or perform purchase/expense/admin actions.
- Manager permissions are explicit and tested.
- Owner can manage only their own tenant; Platform Owner has a separately authorized platform scope.
- Firestore Rules Emulator tests and callable-function tests pass.

### POS operations
- Sales, partial/cash/credit payments, returns/refunds, stock ledger, purchases, supplier/customer balances, expenses, and shift closing reconcile.
- Every transaction is atomic or has an idempotent recovery strategy; no double stock deduction on retry.
- Large catalog pagination and search work for thousands of products.

### Hardware and device support
- Camera and external barcode scanners.
- Bluetooth Classic and Wi-Fi ESC/POS printer paths, plus Android Print Service fallback.
- Printer tests on real supported devices and printers are required; CI cannot certify physical hardware.
- Sensor features require the exact sensor type/protocol and compatible hardware; no simulated success.

### Cross-device and offline
- Android APK and responsive browser POS share the same tenant data.
- Offline queue, reconnect sync, conflict detection, and recovery are tested.
- Backup/restore validates tenant identity, schema version, record integrity, and rollback behavior.

### Release
- Automated syntax, unit, integration, and Firestore Rules tests pass.
- Android debug and signed release builds pass with the registered package and signing certificate.
- Release APK is installed and tested on a real Android device.
- No production deployment or original-branch merge before owner approval.

## Current change in this branch

- Cloudflare Merchant Code staff slot lookup is now limited to three slots, matching the existing Firestore Rules and Firebase Functions capacity.
- A regression test verifies that a fourth staff account is rejected before Firebase Auth account creation.
- A dedicated GitHub Actions workflow now runs Cloudflare Worker syntax and tests on this review branch. Run 45444322741 completed successfully after correcting the test fixture to require a verified Platform Owner.

## UI and shop-branded POS work added on the review branch

- Reworked the v2 workspace toward a desktop-first computer POS layout with a vertical navigation rail on wide screens and a responsive horizontal menu on phones/tablets.
- Added an owner-only Shop Profile panel for each tenant's shop name, address, and phone. The profile is stored in that shop's Firestore `pos/settings/records/profile` document; staff can read the shop identity for receipts but cannot update it.
- Receipt heading and social-ad heading now use the current shop profile rather than a fixed AK Hardware name. The receipt configuration is saved to the shop profile for cross-device sync when the shop owner saves it. Logo uploads are capped at 450 KB to stay within Firestore document limits.
- Product catalog now has category filtering, search, sorting by name/stock/retail price, page sizing, sticky spreadsheet-style headers, and inline cell editing.
- Existing multi-sheet Excel-compatible `.xls` export is now branded with the shop identity and formatted title/header rows. It exports shop profile, products, sales, purchases, expenses, customers/suppliers, and summary data.
- Added a Firestore Rules regression case for owner-only shop profile changes and manager denial. The Firestore rules test file is syntax-checked in CI; the emulator-based rules suite has not yet been executed in this workflow.
- Added a CI workflow that checks the embedded v2 JavaScript, Worker syntax, Firebase Functions syntax, Firestore test syntax, and all 9 Cloudflare Worker tests. The latest run for this branch passed.

## Latest permission and first-login corrections

- First login for a newly issued shop-owner account now initializes that shop's profile from its owner-issued license name. The shop owner can then add address, phone, and receipt settings; these remain tenant-scoped.
- Salesperson accounts cannot edit stock or product fields in the UI, and Firestore Rules now deny product updates from cashier/salesperson accounts. Managers and shop owners retain product maintenance rights.
- Cloudflare provisioning rejects the retired `employee` role for new Merchant Code accounts; supported staff roles are manager and cashier/salesperson. The three Merchant Code slots remain enforced server-side.
- Owner login is restricted to the verified Google provider for the fixed Platform Owner account. Standard email/password login cannot elevate to Platform Owner.
- The 5-day trial plan is included in the license create/update allow-list and has a Firestore Rules regression test.
- Wi-Fi RAW TCP printer support is present in the native Android bridge, defaulting to port 9100; Bluetooth Classic ESC/POS and Android system printing are also represented in the code. Physical printer compatibility is still unverified.

## Explicitly not certified yet

No claim is made that the full app, Owner account lifecycle, Firebase deployment, cross-device sync, physical printers, sensors, or Version 3.5.0 APK are complete. Those require the remaining source changes, automated test results, deployment verification, and device testing.
