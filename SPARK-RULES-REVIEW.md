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

## Follow-up implementation — 2026-11-12

The isolated migration branch now contains an initial Spark-compatible Firestore Rules implementation for staff membership:

- Staff membership is checked from `shopMembers/{uid}`; no `shopId` or `shopRole` custom token claim is used by the workspace metadata read check.
- One-time invite documents live at `shopInvites/{32-char uppercase hex code}`. Only the issuing shop owner can read/list invite documents; claim validation uses Rules-side document reads.
- A successful claim requires one atomic batch that creates the staff membership, reserves one of three fixed slot documents, and changes the invite from `open` to `claimed`.
- Staff membership requires a verified email, active shop license, matching invite role/shop, and an unused slot.
- Shop owner can update only the member print flag or delete a member and release a slot. The owner must delete both documents together in the client batch to avoid a stale slot.
- The 3-slot limit is enforced by unique fixed slot document IDs, not by a client-side count.

## Validation status

The emulator test suite was expanded to cover invite creation/privacy, atomic one-time claim, replay denial, expired-license denial, verified-email requirement, cross-tenant denial, three-slot cap, and owner revocation.

The GitHub Actions workflow has been committed, but its emulator run result has not yet been confirmed. Therefore this is an implementation candidate, not a verified release. Existing callable-based APK flows still need migration, and the POS workspace data model plus role-specific permissions remain separate unfinished work.
