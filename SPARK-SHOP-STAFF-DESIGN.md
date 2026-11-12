# Spark-Compatible Shop Owner and Staff Design

Status: design gate only. This document does not change the production rules or APK.

## 1. Shop owner account lifecycle

1. A shop owner creates their own Firebase Authentication Email/Password account from the APK.
2. The app sends Firebase's email verification message and requires `email_verified == true` before requesting activation.
3. The Platform Owner finds the verified UID/email in the Owner Control Center and manually creates or updates `/licenses/{uid}`.
4. The license document uses the existing allowlisted plan values: `30-days`, `90-days`, `180-days`, `365-days`; `expiresAt` is the actual expiry timestamp and `status` is `active` or `suspended`.
5. Every protected POS read/write is checked against the license expiry in Firestore Rules. Expiry locks access without deleting the shop data.
6. Renewal is an Owner-only update to the same license document. No in-app payment collection is introduced.

The existing `licenses/{uid}` rules already enforce Owner-only writes and owner-or-self reads. The app still needs migration away from `createShopOwnerAccount` and `verifyShopOwnerLogin` callables. Do not allow the client to create or extend its own license.

## 2. Staff membership without custom claims

The current `shopMembers/{uid}` records are callable-managed and the current rules depend on Firebase custom claims `shopId` and `shopRole`. The Spark-compatible target is a Firestore membership record checked directly by Rules:

```text
/shopMembers/{staffUid}
  shopId: <shop-owner-auth-uid>
  role: manager | cashier | employee
  status: active | revoked
  email: <verified-auth-email>
  createdAt: timestamp
  createdBy: <shop-owner-auth-uid>
```

A staff member signs in with their own verified Firebase Auth account. Authorization comes from the matching membership document, not from client-supplied role fields or custom claims. The shop owner UID is the tenant ID.

## 3. Merchant Code and three-seat limit

A secure implementation must not put a reusable plain-text invite code in a document readable by arbitrary users. Use a high-entropy random code as the invite document ID (at least 128 bits of randomness), with a short expiry and one-time claim. The claim must atomically:
- verify the invite is open and not expired;
- create the caller's membership with the invite's shop ID and role;
- mark the invite claimed by that UID;
- reserve exactly one of three fixed staff slots.

Only three fixed slot IDs may exist per shop (for example, `{shopUid}_1`, `{shopUid}_2`, `{shopUid}_3`). A fourth slot must be impossible by rule, not merely hidden in the UI. Owner revocation frees the slot and revokes the membership. A claim must not allow role escalation, cross-shop membership, duplicate membership, or invite reuse.

The existing Firestore Rules cannot count arbitrary query results. The fixed-slot approach is required if the three-staff cap is to be enforced without trusted server code.

## 4. Permission enforcement

- Shop owner: full access only to their own tenant.
- Manager: only explicitly permitted operational actions; never license, staff-role, or owner-control changes.
- Cashier: sales and customer operations allowed by assigned permission; no cost-price, stock-purchase, expense, or reports access unless explicitly granted.
- Employee: least-privilege access.
- Platform Owner: separate allowlisted account and separate Owner Control Center; must not read customer POS records by default.

The UI hiding a button is not a security control. Every operation must be enforced in Firestore Rules.

## 5. Workspace migration is a separate gate

The existing POS workspace path `/shops/{shopId}/workspace/current` is metadata-only and all direct writes are denied. The APK currently calls trusted functions for workspace load/save and other operations. Do not switch to direct writes until the document model is decomposed into rule-protected tenant collections and role-aware operations. A single unrestricted workspace blob would let a staff member bypass field-level permissions.

## 6. Required validation before enabling this design

- Emulator tests for owner-only license writes, active/expired/suspended license, cross-tenant denial, verified-email requirement, invite expiry/reuse, duplicate membership, fixed three-slot cap, owner revocation, and role-specific writes.
- Static search confirms no client-side trust in `shopId` / `shopRole` token claims.
- All callable dependencies in the APK are migrated or deliberately retained; no dead buttons or silent fallbacks.
- Real-device tests on at least two separate shop accounts and one staff account.
- Only then create a candidate APK. Production branch and existing released APK remain unchanged until explicit release approval.
