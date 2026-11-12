# Spark Migration Audit — 2026-11-12

Branch: `ak-free-backend-migration`
Base: `ak-owner-pos-default-mode`
Production/release branch is unchanged.

## Findings from current APK source

The client currently calls these Firebase callable functions:

- `claimShopDevice`, `listShopDevices`, `revokeShopDevice`
- `publishGlobalAnnouncement`, `listGlobalAnnouncements`
- `setShopStaffPrintPermission`, `createShopInviteCode`, `claimShopInviteCode`, `listShopStaff`, `assignShopStaffRole`, `removeShopStaff`
- `listPendingShopProfiles`, `reviewShopProfile`
- `loadShopWorkspace`, `saveShopWorkspace`
- `verifyShopOwnerLogin`, `createShopOwnerAccount`, `listPlatformUsers`, `setPlatformUserAccess`, `grantSubscription`
- `createCloudBackup`, `listCloudBackups`, `restoreCloudBackup`

The Functions source also exports ad, profile, backup and other callables. The APK still has callable dependencies beyond account provisioning and staff management.

## Blocking architectural facts

1. Firebase Spark does not permit deploying the current Cloud Functions. Replacing only the deployment workflow will not solve this.
2. Firebase client SDK can register/sign in a user, but cannot securely create another user's Auth account or set their password. The current Owner-entered Gmail + password provisioning flow therefore cannot be preserved exactly without a privileged backend.
3. Firebase custom claims are currently used for staff identity. Client code cannot securely set custom claims. The Spark migration must replace them with Firestore membership documents and strict rules.
4. The current staff invite and workspace callables perform privileged operations. A client-side rewrite is unsafe unless Firestore Rules and atomic transaction behavior are tested first.
5. Existing device limits, platform announcements, public shop approval, cloud backup, and AI ad callables are separate migration workstreams; simply changing the login screen would leave runtime failures.

## Safe migration plan

### Phase A — account and tenant foundation
- Preserve Firebase Authentication for self-registration and email verification.
- Make the shop owner register their own account; Platform Owner approves/activates a subscription request.
- Store tenant membership and license state in Firestore documents whose fields cannot be changed by shop users.
- Platform Owner authorization must be based on the verified allowlisted account, not a client-side role flag.
- Store each shop workspace under a tenant ID and enforce tenant membership in Rules.
- Staff invite claim must use a Firestore transaction and rules that prevent reuse, cross-tenant claim, role escalation, and more than three active staff.
- License expiry must be enforced by Firestore Rules on every protected operation, not only by a client timer.

### Phase B — migrate all callables
Migrate each callable individually, with corresponding rules and emulator tests. Keep a callable-to-client-callsite checklist and do not remove any callable until no client code references it.

### Phase C — verification and release
- Run Firebase Emulator Suite rules tests for anonymous, owner, shop owner, manager, cashier, employee, and cross-tenant access.
- Run APK static validators and Android build.
- Install and test with separate test accounts on actual Android devices.
- Keep the existing release APK and production rules unchanged until all tests pass.

## Product constraint requiring a design change

The Platform Owner can no longer create another person's Firebase password directly under Spark. The compatible flow is: customer self-registers and verifies Gmail; Owner manually activates or extends their subscription. This keeps external payment handling and the existing price/duration policy.

## Do not do

- Do not loosen Firestore rules to make the app appear to work.
- Do not trust client-written `role`, `shopId`, `subscriptionStatus`, or `expiresAt` fields.
- Do not delete or replace the production rules or release branch during migration.
- Do not ship a build that silently falls back to local-only data while presenting cloud sync as successful.
