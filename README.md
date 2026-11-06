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

## Web + Android

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

## Cloud deployment requirement

The current Firebase GitHub Actions workflow deploys **Firebase Hosting only** when repository secret `FIREBASE_SERVICE_ACCOUNT_AK_ONLIN_SALES` is configured. It does not deploy Firestore Rules, Storage Rules or Cloud Functions. The service account currently lacks Rules API permission, and Cloud Functions deployment requires an eligible billing plan. A green Hosting workflow does not mean these other Firebase resources were updated. Do not enable billing or change Firebase permissions without the owner's approval. Follow [Firebase Deploy Setup](./FIREBASE-DEPLOY-SETUP-MY.md).

## Known limits — not yet complete

- Manager/cashier/employee accounts can be assigned roles, but secure role-based access to the current single-document Cloud POS data model is not implemented. Private POS data remains owner-only; staff cloud access is deliberately blocked rather than weakening Firestore rules.
- The Android APK now includes a native Bluetooth Classic SPP ESC/POS and Wi-Fi RAW TCP 9100 bridge. It requires a compatible paired Classic Bluetooth ESC/POS printer or a network printer that accepts RAW TCP on the configured port. This code has not yet been verified on real printer hardware. BLE-only printers, vendor-specific protocols and unsupported paper widths may not work. Website printing continues to use Android/System Print.
- Social media auto-posting is not included; Android Share / manual posting is used.
- The web Firebase SDK sign-in path is included. Native Google Sign-In still requires a registered Firebase Android app, matching signing-certificate SHA-1, and native configuration before it can be considered verified.
- No real-device installation, Bluetooth/Wi-Fi printer, multi-device conflict or production payment test can be claimed from the build pipeline alone.

## Release safety

Before commercial sale, deploy Firebase resources and test account isolation, subscription expiry, device limits, backup/restore, payment approval, two-device cloud sync and printing on actual Android phones. KPay references are manually verified; never activate a subscription based on a QR/payment screenshot alone.

Do not enable paid Google Cloud/Firebase billing without the owner's explicit approval. Keep service-account JSON, keystores, passwords and OTPs out of commits, chat and public files.
