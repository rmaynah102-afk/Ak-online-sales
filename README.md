# AK Sale Software · AK Shopping Markets

## AK Sale POS Android — Public Download

- **Latest APK (stable direct link):** https://github.com/rmaynah102-afk/Ak-online-sales/releases/latest/download/app-release.apk
- **Latest release and version notes:** https://github.com/rmaynah102-afk/Ak-online-sales/releases/latest
- Current release: **AK Sale POS 2.1.317** (v2.1.317).
- Send the direct APK link to other Android users. They can download the APK and install it after allowing installation from their browser or file manager.
- APK package: `com.ak.hardware.sales`. This is a signed Android APK; it is not a Play Store release.
- A successful CI build is not a substitute for testing on real phones, Firebase accounts, and the actual printer model.

Myanmar-first shop POS and public product market for hardware, electrical and general retail/wholesale shops.

## အသုံးပြုနည်းလမ်းညွှန်

- [AK Sale Software အသုံးပြုနည်း (မြန်မာ)](./USER-GUIDE-MY.md)
- [AK Sale Software User Guide (English)](./USER-GUIDE-EN.md)
- [ဆိုင်လုပ်ငန်းလမ်းညွှန် (မြန်မာ)](./BUSINESS-GUIDE-MY.md)
- [Business Operations Handbook (English)](./BUSINESS-GUIDE-EN.md)
- [Device, Sensor & Digital Integration Roadmap](./SENSOR-DIGITAL-ROADMAP.md)
- [Firebase Deploy Secret ထည့်သွင်းနည်း](./FIREBASE-DEPLOY-SETUP-MY.md)
- [Bluetooth / Wi-Fi Printer Setup (မြန်မာ)](./PRINTER-SETUP-MY.md)

## AK Sale POS 2.1

- **POS web app:** https://rmaynah102-afk.github.io/Ak-online-sales/v2/
- **Public signed APK:** https://github.com/rmaynah102-afk/Ak-online-sales/releases/latest/download/app-release.apk
- **Build history:** https://github.com/rmaynah102-afk/Ak-online-sales/actions/workflows/build-ak-sale-pos-v2-apk.yml
- Platform Owner authorizes shop-owner Gmail accounts. Self-registration is disabled; each shop owner must use an authorized, verified Google Gmail.
- Platform Owner sets each shop's expiry date. Subscription reference price is **30,000 MMK/month**. Payment is handled outside the app; the Platform Owner verifies receipt independently and manually sets or extends the expiry date.
- No in-app KPay/WavePay checkout, transaction-reference submission, or payment-screenshot upload is included in the intended account model.
- Shop owners can issue one-time 8-digit Merchant Codes to up to 2 staff accounts per shop. Codes expire after 24 hours.
- Staff access is limited to product viewing/stock operations, sales, customer records only and permitted printer functions. Purchasing, expenses, profit reports, backup and shop administration are Owner-only.
- The APK is signed and publicly downloadable, but it is not a Play Store release and no Play Store AAB is published by the current workflow.

## Web + Android

- **Public Market:** https://rmaynah102-afk.github.io/Ak-online-sales/
- **Shop Web App:** https://rmaynah102-afk.github.io/Ak-online-sales/?app=1
- **Source:** https://github.com/rmaynah102-afk/Ak-online-sales
- The Android package is `com.ak.hardware.sales`; the Android app bundles the POS web interface using Capacitor.
- Firebase Google Login and cloud sync require internet access. Previously synchronized Firestore cache may be available offline, but offline cache is not a substitute for backup.
- Product photos remain on the device and are not included in current cloud POS synchronization.

## Core features

- Product catalogue, categories, SKU/barcode field, cost, retail/wholesale price, stock and product photos.
- Sales, purchases, customer/supplier records, partial payments, debts, expenses and reports.
- JSON backup/restore, CSV export, receipt preview, Android system printing and native printer bridge code for Bluetooth Classic ESC/POS and Wi-Fi RAW TCP 9100.
- Product advertisement canvas and Android share-sheet fallback for supported apps.
- Public product listings, approved public shops, sponsored advertisements and Burmese/English business guides.
- Firebase Authentication and Firestore integration with shop-scoped POS collections and role-aware access rules.

## Advertising and public listings

- Public product listings are visible only when their Firestore status is `published`.
- Public shop profiles and sponsored ads require admin approval.
- Social sharing can prepare an image/caption and open supported apps. Automatic TikTok/Facebook/Viber posting is not implemented; the shop owner completes posting inside the target app.
- Google AdSense is not active by default. It requires an approved AdSense account, publisher ID, ad-slot IDs, site review and policy compliance. Never put private account passwords or service keys in source code.

## Deployment and account model

- The current repository includes Firebase Hosting and Firestore deployment configuration. Storage and Cloud Functions availability depends on separately configured deployment resources and must not be assumed from an APK build.
- POS records are stored under shop-scoped Firestore collections such as `shops/{shopId}/pos/{collection}/records`. Firestore rules separate Platform Owner, Shop Owner and Staff permissions.
- Owner-managed licenses are stored separately from POS transaction records. Platform Owner controls shop authorization, account status and expiry.
- Product photos remain local unless separately exported with a supported backup method. Use JSON Backup/Restore and verify the restored data before changing phones.

## Known limits — do not treat as production-ready

- Staff Merchant Code and role restrictions are present in the current source, but must be verified with separate real Google accounts and actual Firestore rules before commercial rollout.
- Native Google Sign-In requires a correctly registered Firebase Android app, matching signing-certificate SHA-1 and native configuration.
- Bluetooth/Wi-Fi printing requires a compatible printer and has not been verified with every printer model. BLE-only printers, vendor-specific protocols and unsupported paper widths may not work.
- Camera barcode scanning depends on Android permissions and supported scanner APIs; test on the target phone.
- Social media auto-posting is not included; Android Share/manual posting is used.
- Workflow success proves build/static checks only. It does not prove real-device installation, account isolation, subscription expiry enforcement, backup/restore, two-device synchronization, barcode scanning or printer operation.

## Release safety

Before commercial rollout, test account isolation, Owner/Staff permissions, subscription expiry and reactivation, backup/restore, two-device cloud sync, offline recovery, barcode scanning and printing on actual Android phones. Do not advertise an unverified feature as production-ready.

Do not enable paid Google Cloud/Firebase billing without the owner's explicit approval. Keep service-account JSON, keystores, passwords and OTPs out of commits, chat and public files.
