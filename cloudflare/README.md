# AK Sale Cloudflare Gateway

This branch deploys a restricted Cloudflare Worker gateway in front of the existing
Firebase callable Functions. Firebase remains the authoritative backend.

## What the Worker does

- `GET /health` reports gateway status and the allowlisted callable count.
- `POST /call/{functionName}` forwards only the 31 callable function names exported
  by `functions/index.js` to the Firebase Functions endpoint in
  `us-central1` for project `ak-onlin-sales`.
- Requires a Bearer Firebase ID token before forwarding.
- Forwards Firebase App Check headers when supplied.
- Rejects unknown function names and non-JSON requests.
- Does not contain service-account credentials, Firebase Admin keys, or API tokens.

## Important security and production notes

This gateway does NOT migrate Firebase Admin SDK code to Cloudflare. Authentication
verification, owner-only checks, subscription expiry, tenant isolation, staff
permissions, Firestore transactions, backup/restore and all business logic remain
inside the existing Firebase Functions. Do not disable Firebase Functions.

The APK and production website are not configured to use this gateway yet. They
continue using their existing Firebase integration until the Worker has deployed
and end-to-end tests pass. A successful Worker deployment alone is not proof that
the upstream Firebase functions are deployed or that all 31 routes work.

## GitHub Actions secrets

Add repository Actions secrets:

- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token permitted to deploy Workers.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID.

Never commit or send tokens, service-account JSON, private keys, or passwords in chat.

## Deployment

Push a change under `cloudflare/` to branch `ak-cloudflare-backend-deploy`, or
manually run the "Deploy AK Sale Cloudflare Backend" workflow.

## Gateway route example

The client sends the same Firebase callable JSON body and Firebase ID token to:

`https://ak-sale-backend.<your-workers-subdomain>.workers.dev/call/loadShopWorkspace`

The actual Worker URL is assigned by Cloudflare after a successful deployment.
Do not change the APK endpoint until deployment and authenticated integration tests
have been completed.
