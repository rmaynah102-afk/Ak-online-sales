# AK Sale POS 2.0

Myanmar-first shop management system for AK Hardware & Electrical.

## Account model

- Platform Owner signs in with Google using the configured Owner Gmail (`painglin102@gmail.com`); Android uses the Firebase Authentication native Google plugin and the registered Android package/signing identity.
- Only Platform Owner can create shop-owner accounts.
- Platform Owner enters each shop owner's Gmail and initial password.
- Firebase sends the shop owner an email-verification link.
- Shop owners sign in with verified Gmail and password. If an earlier build already created the Firebase account, the Owner can reuse it with the matching password; otherwise the app sends password-recovery instructions instead of silently failing.
- Each shop owner can create up to 3 staff accounts.
- Staff sign in using a 12-character Merchant Code and password; personal Gmail is not required.
- Staff roles: manager, cashier and employee.
- Each shop's POS data is stored under its own shop UID.
- Platform Owner controls subscription activation, suspension and expiry.
- Expired or suspended accounts are locked; existing data is retained.

## Subscription periods

| Period | Price |
|---|---:|
| 30 days | 30,000 MMK |
| 90 days | 90,000 MMK |
| 180 days | 180,000 MMK |
| 365 days | 360,000 MMK |

Payments are handled outside the app. There is no in-app KPay, WavePay or payment screenshot flow.

## Backend

- Firebase Authentication and Firestore are authoritative for accounts and shop data.
- Firestore Rules enforce tenant isolation and role permissions.
- Cloudflare Worker provides owner account provisioning and Merchant Code staff provisioning using Firebase REST APIs.
- Worker health endpoint: `/health`.
- Worker public endpoint: `https://ak-sale-backend.painglin102.workers.dev`.
- The Worker does not store Firebase service-account credentials.

## POS features

Products, Hardware/Electrical categories, SKU, camera Barcode/QR scanning, cost/retail/wholesale prices, stock, low-stock alerts, sales, purchases, customers/suppliers, payments, expenses, CSV export, Print/PDF, JSON backup/restore, Bluetooth/Wi-Fi ESC/POS and Android System Print, 1080×1080 social advert creation and Viber/TikTok share-sheet handoff.

## Owner access

- Owner login uses the original Google provider identity, not a newly assumed email/password account.
- Owner opens their own POS workspace first, scoped to the Owner UID, and can switch to the separate Control Center.
- The Owner's own POS workspace is license-exempt only for that same Owner UID; other shops remain independently licensed and isolated.

## Android build

GitHub Actions builds a debug APK artifact from this directory. Debug APK is for installation/testing, not a signed production release. Wi-Fi/Android Print Service is the current printing fallback; Bluetooth thermal printing needs device-specific validation.

## Release checks

The repository CI validates JavaScript, runs POS adapter unit tests and Firestore Emulator security tests, builds the Android debug APK, and deploys tested Firestore rules from `main`. The first on-device end-to-end test is still required before treating the build as production-ready.
