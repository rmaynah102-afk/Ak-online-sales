# AK Sale Software · AK Shopping Markets

Myanmar-first shop POS, stock, wholesale/retail, customer/supplier, debts, expenses, reports, center management and public product market.

## မြန်မာအသုံးပြုနည်းလမ်းညွှန်

- [AK Sale Software အသုံးပြုနည်း (မြန်မာ)](./USER-GUIDE-MY.md)
- [AK Sale Software User Guide (English)](./USER-GUIDE-EN.md)
- [ဆိုင်လုပ်ငန်းလမ်းညွှန် (မြန်မာ)](./BUSINESS-GUIDE-MY.md)
- [Business Operations Handbook (English)](./BUSINESS-GUIDE-EN.md)
- [Device, Sensor & Digital Integration Roadmap](./SENSOR-DIGITAL-ROADMAP.md)

## Web + Android APK

- **Public Shopping Mall:** https://rmaynah102-afk.github.io/Ak-online-sales/
- **Shop Web App:** https://rmaynah102-afk.github.io/Ak-online-sales/?app=1
- **Source:** https://github.com/rmaynah102-afk/Ak-online-sales
- **Android download:** [Latest signed APK](https://github.com/rmaynah102-afk/Ak-online-sales/releases/latest/download/AK-Sale-Software.apk) · [All releases](https://github.com/rmaynah102-afk/Ak-online-sales/releases). The workflow publishes a signed APK and Play Store AAB when the private release-signing secrets are configured; otherwise it creates a debug-only test APK artifact.
- Android APK is built from the same `index.html` as the web app using Capacitor. The web app also has an installable PWA manifest and offline app-shell cache.

## Advertising

- Approved shop-sponsored ads are displayed in the public Market and app's sponsored-ad section.
- Shops can submit an ad after Gmail login and an active trial/subscription; the admin reviews and approves it.
- Ad duration and fee are controlled by the admin. An ad is not automatically paid or approved.
- The share action creates a ready-to-share AK Sale promotional link for Facebook, Viber, Telegram and other supported share targets.
- Google AdSense is **not active by default**. It requires the owner's approved AdSense account, publisher ID, ad-slot IDs, site review and policy compliance. Do not paste private account passwords or keys into source code.

## Free-first operating limits

GitHub Pages, GitHub Actions and Firebase have usage limits. Firebase free quotas and feature availability can change. Do not enable billing or paid services without the owner's explicit approval. Image uploads/Cloud Functions may require billing depending on Firebase's current plan and project configuration.

## Release status and safety

The Android workflow can create a **signed release APK and Play Store AAB** when all four private signing secrets are configured in GitHub Actions. If they are absent, it creates a debug-only test APK instead. Do not commit keystore files or passwords. A successful build does not prove real-device operation. Google Play publication also requires a Play Console developer account, store listing, app signing, privacy disclosures and policy review.

Before selling: deploy and test Firebase rules/functions, account isolation, subscription expiry, device limits, backups, QR/payment workflow, printer behavior, real Android devices and a signed release build. KPay references are manually verified; never mark a payment as received from a QR screenshot alone.
