# AK Sale Cloudflare Backend

This branch contains a deployment scaffold only. The Worker currently exposes
GET /health and returns HTTP 501 for all other routes. It is NOT a replacement
for the Firebase callable functions.

## GitHub Actions secrets

Add these repository Actions secrets before deploying:

- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID

Do not commit API tokens, Firebase service-account keys, private keys, or passwords.

## Deployment

Push a change under cloudflare/ to branch ak-cloudflare-backend-deploy, or run
the "Deploy AK Sale Cloudflare Backend" workflow manually.

## Required before production

Migrate and test Firebase Authentication identity checks, Firestore transactions,
shop isolation, owner-only account provisioning, subscription expiry enforcement,
staff permissions, workspace load/save, and backup/restore. Keep the current
Firebase backend active until all migrated endpoints pass security and regression
tests. Do not point the APK or production website at this scaffold.
