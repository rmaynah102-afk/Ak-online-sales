# Firestore Rules Review — Spark Migration

Reviewed on 2026-11-12 from `firestore.rules` on `ak-free-backend-migration`.

## Decision

Do not replace the existing rules wholesale. They currently protect several unrelated AK Market / Community collections as well as POS data. A broad rewrite could break the public site or expose customer data. This branch adds regression tests first; production rules remain unchanged.

## POS access paths observed

- `/users/{uid}/private/{document=**}` uses `hasActiveLicense(uid)` for both reads and writes.
- `/users/{uid}/backups/{backupId}` uses the same license check; create validates owner UID and backup payload size.
- `/licenses/{uid}` allows only the verified Platform Owner to create/update license documents. Customers can read their own license only.
- `/shops/{shopId}/workspace/current` is read-only metadata. All workspace writes are denied directly; the current design expects callable functions.
- `/shopMembers/{memberUid}` is read-only to the member themselves or the shop owner. All writes are denied.
- Staff workspace metadata authorization currently depends on custom claims `shopId` and `shopRole`, plus a matching `shopMembers` record and active license. This is not yet Spark-migration compatible because custom claims require privileged server code.

## Important migration blockers

1. Direct POS workspace writes are denied. The app cannot simply switch callable workspace saves to direct Firestore writes without a deliberate new schema and rules.
2. Existing staff access uses custom claims. Replacing callables requires a safe Firestore membership model and rules that check tenant membership and role permissions.
3. `hasActiveLicense` currently includes a five-day free-trial path based on `freeBetaUsers` and `freeTrialClaims`. This must be reviewed against the intended paid-only/manual-activation business rule before changing it.
4. Several non-POS collections remain in this same rules file. They must be preserved or intentionally retired in a separate product cleanup; do not accidentally remove their rules during POS migration.
5. The current `firebase.json` has no Firestore emulator configuration and the repository has no Rules Unit Testing harness. Security behavior is therefore not automatically regression-tested.

## First regression test scope added

- Anonymous user cannot read a shop's private POS data.
- Active licensed shop owner can read/write only their own private POS data.
- Expired license cannot access private POS data.
- One shop cannot read another shop's private POS data.
- Customer cannot create or modify their own license.
- Verified Platform Owner can issue a license.
- Shop owner can read workspace revision metadata but cannot write it directly.
- Staff membership document is readable by its member, but not by unrelated users.

## Not yet changed

- No production Firestore rules changed.
- No Cloud Functions deployed.
- No callable references removed.
- No APK rebuilt or released.
- No claim that the new Spark backend is complete.

## Next implementation gate

Run the emulator tests and inspect failures. Then design the new tenant-scoped POS document model and membership/role rules. Only after those tests pass should the client be migrated from callable functions to direct Firestore operations.
