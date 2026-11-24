# AK Sale Software · AK Shopping Markets

Myanmar-first shop POS and public product market for hardware, electrical and general retail/wholesale shops.

## အသုံးပြုနည်းလမ်းညွှန်

- [AK Sale Software အသုံးပြုနည်း (မြန်မာ)](./USER-GUIDE-MY.md)
- [AK Sale Software User Guide (English)](./USER-GUIDE-EN.md)
- [ဆိုင်လုပ်ငန်းလမ်းညွှန် (မြန်မာ)](./BUSINESS-GUIDE-MY.md)
- [Business Operations Handbook (English)](./BUSINESS-GUIDE-EN.md)
- [Device, Sensor & Digital Integration Roadmap](./SENSOR-DIGITAL-ROADMAP.md)
- [Firebase Deploy Secret ထည့်သွင်းနည်း](./FIREBASE-DEPLOY-SETUP-MY.md)
- [Bluetooth / Wi-Fi Printer Setup (မြန်မာ)](./PRINTER-SETUP-MY.md)

## AK Sale POS 3.5 Professional

- **New POS web app:** https://rmaynah102-afk.github.io/Ak-online-sales/v2/
- **Android test APK builds:** [GitHub Actions](https://github.com/rmaynah102-afk/Ak-online-sales/actions/workflows/build-ak-sale-pos-v2-apk.yml)
- Platform Owner signs in only with the verified Google account `painglin102@gmail.com`.
- Shop Owner signs in only with the invited, verified Google Gmail and claims the invitation after Google authentication.
- Each shop can create up to 2 staff accounts (Manager + Salesperson) using Merchant Code only.
- Subscription periods and manual renewals are controlled by Platform Owner. No in-app payment checkout is included.
- This is the new POS 2.0 line; The APK now includes a native Bluetooth/Wi-Fi ESC/POS bridge; the actual printer model and paper width still need a physical test.

## Web + Android

- Firebase Web App client config is bundled from `firebase-config.js` for automatic sign-in setup. This config is public client data; private service-account keys are never bundled.

- **Public Market:** https://rmaynah102-afk.github.io/Ak-online-sales/
- **Shop Web App:** https://rmaynah102-afk.github.io/Ak-online-sales/?app=1
- **Source:** https://github.com/rmaynah102-afk/Ak-online-sales
- **Android package:** `com.ak.hardware.sales`
- **APK/AAB:** Android workflow builds both signed release APK and Play Store AAB when the private release-signing secrets are configured. Current signed build artifacts are available in GitHub Actions run [42149325580](https://github.com/rmaynah102-afk/Ak-online-sales/actions/runs/42149325580). A public GitHub Release is only created after `AK_PUBLIC_APK_RELEASE_APPROVED=true` is explicitly set.
- The Android app bundles the same `index.html` as the web app using Capacitor. Local shop data works on-device; Firebase login, cloud sync, public listings and remote features require internet access.
- The PWA app shell is cached for offline opening. Offline cache is not a substitute for a cloud backup.

## Core features

- Product catalogue, categories, SKU/barcode field, cost, retail/wholesale price, stock and product photos.
- Sales, purchases, customer/supplier records, partial payments, debts, expenses and reports.
- JSON backup/restore, Android system print service, native Bluetooth Classic ESC/POS and Wi-Fi RAW TCP 9100 printer bridge (APK), product advertisement canvas and Android share-sheet fallback.
- Public product listings, approved public shops, sponsored advertisements and Burmese/English business guides.
- Firebase Authentication, Firestore and Storage integration with owner-scoped private shop data.

## Advertising and public listings

- Public product listings are visible only when their Firestore status is `published`.
- Public shop profiles and sponsored ads require admin approval.
- Shop submissions require a signed-in, licensed shop account and the required Firebase rules/storage configuration.
- Social sharing can prepare an image/caption and open supported apps. Automatic TikTok/Facebook/Viber posting is not implemented; the shop owner completes posting inside the target app.
- Google AdSense is not active by default. It requires the owner's approved AdSense account, publisher ID, ad-slot IDs, site review and policy compliance. Never put private account passwords or service keys in source code.

## Free-tier deployment and account model

- Production deployment of Firebase Functions, Firestore Rules and the Cloudflare Worker is separate from APK building and has not been performed by the review workflow. No paid Firebase billing is enabled.
- The platform is designed for up to **100 active shop-owner accounts**; actual activation requires deployed Cloud Functions and Firestore rules. Firestore rules enforce the shared capacity counter and each account's private data path is keyed by its Firebase UID.
- Owner data sync uses Firestore directly at `users/{uid}/private/appData`. Rules restrict each account to its own records. The Platform Owner can manage license records after manually checking payment references.
- Product photos stay on the device and are excluded from cloud sync. Use the JSON Backup/Restore function to move photos and all local records to another device.
- Payment requests can be submitted with a KBZPay transaction reference. Screenshot upload is disabled because Firebase Storage is not initialized. The Platform Owner must verify the transaction in KBZPay before approving a license.
- Public Market is separate from private POS data and continues to use its own public listing rules.

## Known limits — do not treat as production-ready

- Merchant Code staff provisioning and the two-slot Manager/Salesperson model are implemented in the review source. They are not production-ready until the updated Cloudflare Worker and Firebase resources are deployed and verified.
- Cloud backup callables, server-side device management and AI callable features are unavailable. Use local JSON Backup/Restore.
- The Android APK includes a native Bluetooth Classic SPP ESC/POS and Wi-Fi RAW TCP 9100 bridge. It requires a compatible printer and has not been verified on real printer hardware. BLE-only printers, vendor-specific protocols and unsupported paper widths may not work. Website printing continues to use Android/System Print.
- Social media auto-posting is not included; Android Share / manual posting is used.
- The signed APK build checks that the release certificate matches the configured Firebase Google OAuth certificate. Real-device Google sign-in still requires installation and end-to-end testing on the target Android phone.
- Workflow success proves static validation and deployment only. It does not prove real-device installation, camera scanning, printer operation, multi-device conflict handling or production payment behavior.

## Release safety

Before commercial sale, deploy Firebase resources and test account isolation, subscription expiry, device limits, backup/restore, payment approval, two-device cloud sync and printing on actual Android phones. KPay references are manually verified; never activate a subscription based on a QR/payment screenshot alone.

Do not enable paid Google Cloud/Firebase billing without the owner's explicit approval. Keep service-account JSON, keystores, passwords and OTPs out of commits, chat and public files.
