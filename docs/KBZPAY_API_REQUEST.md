# AK Sale Software — KBZPay Merchant API Integration Request

**Status:** Preparation document only. No KBZPay API access has been granted and no live payment API is connected.

## 1. Software demonstration

- Web app: https://rmaynah102-afk.github.io/Ak-online-sales/?app=1
- Public market: https://rmaynah102-afk.github.io/Ak-online-sales/
- Android APK: https://github.com/rmaynah102-afk/Ak-online-sales/releases/latest/download/AK-Sale-Software.apk
- Source and release history: https://github.com/rmaynah102-afk/Ak-online-sales

Demonstration should use a test shop and test transactions only. Do not demonstrate with real customer financial data.

## 2. Requested integration

We request information about the official KBZPay merchant/payment API suitable for a Myanmar small-business POS and online sales application.

Requested capabilities, subject to KBZPay's supported product and approval:

1. Create a merchant payment request or dynamic QR for a specific invoice amount and unique order reference.
2. Receive an authenticated server-to-server payment notification/webhook.
3. Verify payment status server-side using the official inquiry/status endpoint.
4. Obtain transaction reference, amount, currency, status, and paid timestamp.
5. Receive sandbox/test credentials and test cases before production activation.
6. Understand refund/reversal support and the approved workflow, if available.

The application will not treat a QR screenshot, customer-submitted receipt, browser redirect, or client-side message as proof of payment.

## 3. Proposed secure payment flow

1. Cashier creates an invoice in AK Sale Software.
2. Backend creates a unique payment reference and requests a payment session/QR through the official merchant API.
3. Customer pays using the official KBZPay flow.
4. Backend receives a signed webhook and verifies its signature, timestamp, amount, currency, merchant identity, and invoice reference.
5. Backend independently calls the official transaction inquiry endpoint when required.
6. Only a verified successful transaction changes the invoice to **Paid**.
7. Duplicate callbacks are handled idempotently; failed, pending, expired, reversed, and mismatched payments remain unpaid and are shown clearly.
8. The Owner can view an audit trail without seeing or storing customer PINs or OTPs.

## 4. Security and data handling

- API secrets will be stored only in server-side secret management, never in the Android APK, browser JavaScript, Git repository, or public configuration.
- No customer PIN, OTP, banking password, or card credentials will be collected by AK Sale Software.
- Webhook signatures and server-side payment status must be verified.
- Amount, currency, merchant account, invoice reference, and transaction ID must be checked.
- Payment state changes must be logged and protected against replay and duplicate notifications.
- Production activation will wait for written approval, official documentation, sandbox testing, and security review.

## 5. Information requested from KBZPay

Please advise:

- Eligibility and merchant onboarding requirements for a software provider / POS platform.
- Which merchant API product supports dynamic QR or payment requests.
- API documentation, sandbox access, test merchant account, and sample code.
- Authentication method, webhook signing method, IP allowlisting requirements, retry policy, and idempotency rules.
- Supported currencies, transaction limits, fees, settlement timing, refund/reversal process, and reconciliation reports.
- Production certification, security assessment, contract, and support contact requirements.
- Whether one platform may support multiple independent shops/merchants, and the approved account/merchant model.

## 6. Demo and approval boundary

The current AK Sale Software can be demonstrated as a POS and sales-management product. Its current KBZPay destination/manual review workflow is not an automatic bank integration. No claim of official API integration should be made until KBZPay grants access and the production flow is tested and approved.

## 7. Contact / applicant details to complete before submission

- Applicant / legal business name: To be supplied by the applicant
- Registered business address: To be supplied by the applicant
- Authorized contact person: To be supplied by the applicant
- Contact email and phone: To be supplied by the applicant
- Merchant account / merchant ID: To be supplied only through KBZPay's official onboarding channel
- Company registration / tax documents: As required by KBZPay

Do not publish identity documents, bank statements, API keys, signing secrets, PINs, or OTPs in this repository.
