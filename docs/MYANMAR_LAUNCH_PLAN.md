# AK Myanmar Launch Plan

This plan localizes AK Sale Software + AK Market for Myanmar. It is a roadmap, not evidence that integrations or legal approvals are complete.

## Local market assumptions to design for

- Burmese-first interface, with optional English labels and Myanmar kyat (MMK) formatting.
- Android-first and responsive web/PWA access.
- Offline-tolerant shop POS: allow locally queued sales where safe, show unsynced state clearly, and reconcile when connection returns.
- Data-saving mode: compress photos, lazy-load feeds, paginate results, cache static assets, avoid autoplay video and provide retry controls.
- Connectivity and power interruptions are expected operational risks; never make cloud sync appear successful while pending.
- Public discovery should support township/city and delivery/pickup availability, but do not expose a seller's exact home address by default.

## Myanmar payment design

- Payment methods should be configurable by each merchant: cash, bank transfer, mobile wallet, and supported QR methods.
- Provide a manual proof-of-payment workflow (reference number, screenshot, reviewer, timestamp, status) as a fallback. A screenshot is not proof of settlement; reconcile against the merchant's actual wallet/bank records.
- Design a future MMQR-compatible payment option only through an authorized bank/payment service provider and documented merchant onboarding/API access. Do not scrape wallet apps, collect wallet PIN/OTP/passwords, or claim direct KPay/Wave/CBM integration without an approved integration.
- Keep payment credentials outside the app. Store only non-secret merchant display details and transaction references required for reconciliation.
- Refunds, charge disputes and subscription approvals require immutable audit trails and role-based permissions.

## Myanmar merchant and marketplace readiness

- Add a merchant profile with shop name, business category, contact methods, city/township, delivery/pickup options and optional business registration details.
- Add marketplace listing report reasons: fake item, misleading price, counterfeit, prohibited item, scam, harassment and duplicate/spam.
- Provide buyer safety guidance: confirm item and price, verify seller, avoid sharing OTP/PIN, beware of advance-payment scams, and use safe public pickup locations where appropriate.
- Keep seller contact preferences configurable; reveal only information the seller chooses to publish.
- Support stock availability, price last-updated time and listing expiry to reduce stale marketplace posts.
- Establish a moderation process before opening public posting to everyone.

## Legal and operational launch checks

- Before enabling commercial online sales, verify current Myanmar Ministry of Commerce online sales registration requirements and whether each merchant/operator must register.
- Review current consumer protection obligations, advertising claims, privacy/data handling, electronic transactions and payment-provider terms with qualified local counsel.
- Publish Burmese privacy notice, terms of use, seller rules, prohibited-goods policy, complaint route and contact details.
- Keep a takedown and complaint workflow, record moderation decisions and provide a seller appeal channel.
- Do not provide legal assurances or promise compliance until a qualified review has been completed.

## Priority build order

1. **Core reliability:** backup, tests, offline queue indicators, MMK formatting, Burmese typography and Android device testing.
2. **Private shop POS:** inventory, sale, returns, debts, cashbook, printable receipts and tenant isolation.
3. **Merchant payments:** configurable payment methods and manual reconciliation; add provider integrations only after formal access.
4. **Public AK Market:** seller profiles, public listings, photo storage, search, save/share, seller contact, reports and moderation.
5. **Marketing:** reusable Burmese ad cards and Android share sheet; platform API publishing only after approval.
6. **Distribution:** signed APK, stable download page, QR onboarding, versioned updates, privacy/terms and customer support.
7. **Pilot:** small group of real shops across different phone/network conditions; collect consented feedback, fix issues and only then expand.

## Local research references

- DataReportal Digital 2026 Myanmar: https://datareportal.com/reports/digital-2026-myanmar
- Central Bank / MMQR coverage as reported by Myanmar Digital News: https://mdn.gov.mm/index.php/en/digital-payments-surge-mmqr-records-30m-transactions-k127t-single-year
- Ministry of Commerce portal and online sales registration entry: https://commerce.gov.mm/en
- Department of Consumer Affairs complaint portal: https://complaint.doca.gov.mm/my-MM/submit-complaint
- Internet Society Pulse Myanmar: https://pulse.internetsociety.org/en/reports/MM/

Research figures are time-bound and may use different methodologies. Validate current provider requirements and regulations before implementation or launch.
