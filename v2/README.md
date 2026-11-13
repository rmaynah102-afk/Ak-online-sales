# AK Sale POS 2.0

Clean rebuild branch for the AK Hardware & Electrical shop management app.

## Current foundation
- Firebase Authentication (verified email required)
- Separate Platform Owner and shop-owner login
- Owner-only shop account provisioning through the existing Cloudflare gateway
- Firestore subscription license and expiry checks
- Shop-scoped Firestore collections
- Products, sales, purchases, customers/suppliers, expenses, reports and JSON backup
- PWA manifest and service worker

## Firebase project
Uses the public web config in the repository root `firebase-config.js`. Security depends on Firestore Rules; never place service-account credentials in client code.

## Platform Owner
The current Platform Owner email is configured as `painglin102@gmail.com`. Shop-owner creation calls the existing Worker endpoint and requires that verified Owner identity.

## Release status
This is a development build. Verify Firebase rules, gateway deployment, account provisioning, tenant isolation, stock calculations, restore behavior and Android APK installation before production use.
