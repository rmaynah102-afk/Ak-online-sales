# Ak shopping markets

Myanmar-first retail, wholesale, inventory and shopping-centre management app.

## Current delivery

- Responsive web app for Android phones and desktop browsers.
- Android APK build through GitHub Actions (debug/testing APK).
- Local/offline-first records with JSON backup and restore.
- Optional Firebase Email/Password login, Firestore shop-data storage and subscription foundation.
- KPay payment-reference submission with manual receipt verification.
- AK Market listing foundation with Firebase Storage image upload rules.

## Free-first distribution

- GitHub repository and GitHub Pages can host the web app at no hosting charge within GitHub's applicable limits.
- GitHub Actions can build a test APK within its included usage allowance; usage limits apply.
- APK artifacts are temporary build downloads, not a permanent public app store.
- A public, signed Android release APK needs a persistent signing keystore. Keep it private and configure it as GitHub Actions secrets. Never commit the keystore or passwords.
- Firebase Authentication and Firestore have no-cost quotas, but quotas and regional availability apply. Cloud Functions deployment may require a billing-enabled Firebase plan. Do not promise unlimited free cloud service.
- KPay is not automatically verified. An administrator must verify the actual payment independently before approving a subscription.

## Firebase setup (optional cloud features)

1. Create a Firebase project and register the Android/web app.
2. Enable Email/Password Authentication, Firestore and Storage.
3. Add the Firebase Web App config to the app's Firebase settings.
4. Deploy Firestore and Storage rules from this repository.
5. Deploy Cloud Functions only after setting the admin email and reviewing billing requirements.
6. Test with separate shop accounts: data isolation, trial expiry, denied expired access, payment approval, backup/restore and two-device sync.

## Release checklist before charging customers

- [ ] Firebase project configured and rules deployed.
- [ ] Trial and subscription functions deployed and tested.
- [ ] Cross-account data isolation tested.
- [ ] Signed release APK built and installed on multiple Android versions.
- [ ] Update APK signed with the same private keystore.
- [ ] Backup/restore and printer output tested on real devices.
- [ ] Privacy policy, terms, support contact and refund policy published.
- [ ] Payment process and support process tested with pilot shops.

## Important limitations

This repository's current APK workflow creates a **debug/testing APK** by default. It is not yet a verified, signed public release. Cloud sync, subscriptions, payment approval, market listing and multi-device behavior must be tested against a configured Firebase project before selling. Browser-only POS data is stored locally until a shop signs in and cloud sync is configured.
