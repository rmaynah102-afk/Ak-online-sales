# AK Sale Software

Hardware & Electrical POS web app.

## Subscription system (Firebase)

The repository now includes a server-side subscription foundation:

- New Firebase Authentication accounts receive a 7-day trial through the `startTrial` Cloud Function.
- Each shop's license is stored at `licenses/{uid}`.
- Shop data is isolated at `users/{uid}/private/appData`.
- Firestore rules permit shop-data access only while the account has an unexpired `trial` or `active` license.
- Customers can submit a KPay payment reference from the app.
- Only the configured admin email can call `approveSubscription` to extend a license.

### One-time deployment required

These changes are committed to GitHub, but they are **not live in Firebase until deployed**. Deployment requires Firebase CLI and a Firebase project with Cloud Functions enabled. Cloud Functions deployment may require the Firebase project to be on the Blaze billing plan.

1. Install Firebase CLI and sign in:
   ```sh
   npm install -g firebase-tools
   firebase login
   ```
2. In the repository folder, select the correct Firebase project:
   ```sh
   firebase use --add
   ```
3. During the first Functions deployment, Firebase CLI will ask for the `ADMIN_EMAIL` parameter. Enter the exact admin Gmail address that will sign in to AK Sale Software. This must be a Firebase Authentication account. For repeatable deployments, save the parameter in the Functions environment file for the selected project; do not commit private credentials.
4. Deploy rules, hosting and functions:
   ```sh
   firebase deploy --only firestore:rules,functions,hosting
   ```

### Operating the subscription system

- New accounts get a 7-day trial after the account-created trigger runs.
- Customer chooses a package and submits their KPay transaction reference.
- Admin verifies the KPay receipt independently, then signs into the app with the configured admin Gmail.
- In the Subscription panel, admin enters the customer's UID, days (30/90/180/365) and payment reference, then approves.
- The server extends from the later of now or the customer's current expiry date.

### Important limitations

- KPay payment is **not automatically verified**. The admin must check the actual KPay receipt before approving.
- Do not share the admin Gmail password.
- Keep Firebase Authentication Email/Password enabled.
- The Firebase project ID and app config must match the project selected for deployment.
- Test trial creation, customer data isolation, expired-license denial and admin approval with test accounts before accepting real payments.
- Client-side UI alone is not a security boundary; Firestore rules and Cloud Functions are the enforcement layer.
