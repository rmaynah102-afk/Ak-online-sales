# AK Sale Free Backend Migration Plan

## Goal
Replace callable Cloud Functions dependencies while remaining on Firebase Spark. This branch is isolated from the release branch. Do not merge or deploy until the security and regression checks below pass.

## Spark-compatible design
- Keep Firebase Authentication for individual sign-in.
- Shop owners self-register with Firebase Email/Password. The Platform Owner does not create another person's Auth password; Firebase client SDK cannot securely administer other users' credentials without Admin SDK.
- The Platform Owner activates, suspends, or extends a shop license by writing only the license fields permitted by Firestore Security Rules. Payment remains external and manually verified.
- Staff self-register with verified Gmail and claim a shop invitation using a high-entropy, one-time invite document. Store a hash or opaque random token, expiry, claimed UID, shop ID, and role. Firestore Rules must enforce single claim and shop membership.
- Do not rely on Firebase custom claims (they require privileged server code). Firestore Rules must authorize staff by verified Auth identity plus a server-unmodifiable membership record.
- Keep each shop's workspace under its own shop ID. Rules must enforce tenant isolation and role permissions on every read/write.
- Platform Owner's own POS workspace remains isolated under the Owner's own UID.

## Important limitations
- Firestore Rules cannot create Firebase Auth users, set their passwords, send arbitrary emails, or perform scheduled cleanup.
- Client-side license expiry checks are not a security boundary. Every protected Firestore read/write must check the current license expiry in Rules.
- A client-generated invitation must not be trusted merely because the UI says it is random. The claim flow must be designed so rules prevent replay, cross-tenant claims, and role escalation.
- Spark quotas and Firebase product limits still apply; "free" does not mean unlimited.

## Migration sequence
1. Inventory every callable function and every client call site.
2. Design and test Firestore Rules for owner, shop owner, manager, cashier, and employee permissions.
3. Implement owner license controls and shop-owner self-registration.
4. Implement invitation creation/claiming with one-time atomic state transitions and max-three staff enforcement.
5. Replace workspace callable reads/writes with direct Firestore operations only after rules tests pass.
6. Remove obsolete Cloud Functions deploy workflows only after all callable dependencies are removed.
7. Run static validators and emulator/security tests; build a separate test APK.
8. Keep release branch and existing APK unchanged until manual device tests pass.

## Explicit non-goals
- No KPay/WavePay/KBZPay checkout or payment screenshot workflow.
- No change to subscription prices or durations.
- No changes to the current release branch or production Firestore rules during this migration.
