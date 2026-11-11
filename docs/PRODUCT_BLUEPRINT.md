# AK Sale Software + AK Market — Product Blueprint

Status: design and engineering blueprint; not a claim that every feature is implemented or deployed.

## Product direction

Build one Burmese-first Android/web product with two clearly separated areas:
1. **AK Shop** — private POS, inventory, purchases, customers, suppliers, debts, cash/bank reconciliation, receipts, staff roles, reports and subscription.
2. **AK Market** — public product listings and shop pages, saved products, likes, comments, seller contact, search/filter, reporting and moderation.

Basic AK Market browsing and ordinary listings are intended to be free. Cloud storage, bandwidth, messaging and moderation have real operating costs, so free quotas and abuse controls must be set before public launch. Do not promise unlimited free storage.

## Product patterns to learn from (do not copy proprietary code, logos, artwork, exact screens or protected branding)

- **Facebook Marketplace:** familiar public listing/feed patterns, seller contact, save/share and report flows.
- **Etsy:** shop identity, listing photos, categories, seller trust and favorites.
- **Shopify POS / Square POS:** fast checkout, barcode/product lookup, stock movements, returns, staff permissions and sales reporting.
- **WhatsApp Business / Telegram:** simple seller-buyer conversations and shareable product links. Start with safe contact links or in-app messaging only after server-side abuse controls exist.
- **Canva:** reusable product-ad templates, image crop/preview, price badges and one-tap export/share.
- **Baymard marketplace UX research:** clear category navigation, search, filters, product detail, cart/checkout clarity and account self-service.
- **OWASP MASVS / MASTG:** mobile security review for authentication, local storage, cryptography, network traffic, platform integration, code resilience and privacy.
- **Firebase Security Rules / App Check guidance:** enforce access on the server, validate uploads and requests, and use layered abuse protection. UI hiding is never security.

## Experience and design system

- Burmese-first labels, readable typography, large touch targets and low-bandwidth friendly screens.
- Consistent AK deep-green identity, warm neutral backgrounds, clear status colors and reusable cards/forms.
- Mobile bottom navigation for Home, POS, Products, Market and Account; desktop/tablet navigation adapts without hiding essential actions.
- Every important flow needs loading, empty, success, offline, permission-denied and retry states.
- Support image compression, thumbnails, pagination and lazy loading. Never upload original full-resolution photos by default.
- Accessibility: text contrast, scalable text, labels for controls, keyboard navigation where relevant and no color-only status.

## Functional scope

### AK Shop (private tenant data)
- Email/password account, shop profile and onboarding.
- POS: product search/barcode, cart, discounts, tax/fees if configured, split payment, cash/KPay/Wave/bank/manual methods, receipt and refunds/void audit.
- Inventory: SKU/barcode, categories, cost/selling price, stock adjustments, low-stock alerts, supplier purchases and stock history.
- Customer/supplier records, receivables/payables, partial payments and due-date reminders.
- Cashbook, bank/payment ledger, daily close and reconciliation.
- Reports: sales, gross profit, expenses, inventory valuation and export/print.
- Staff roles and audit history.
- Subscription status and Owner-controlled manual activation after external payment is independently checked. Do not build in-app payment proof, transaction-ID submission or screenshot upload. Never store banking passwords, PINs, OTPs or wallet login credentials.

### AK Market (public listings, separate from private POS)
- Public shop profile and published product listings only.
- Listing fields: owner UID, shop ID, title, description, category, price/currency, stock/availability, location, image paths, status, created/updated timestamps.
- Photo picker, crop/compress, multiple photos, saved drafts, edit/archive/delete by owner.
- Search, category/location/price filters, sort, pagination and product detail.
- Like/save, comments with rate limits, seller contact/share, report/block.
- Seller verification markers only after a real verification process.
- Admin moderation queue, prohibited-item policy, spam detection, takedown and appeal audit.
- Never expose private customer, debt, purchase, staff or shop ledger data in public listing documents.

### Marketing and social
- Reusable ad layouts from the seller's own listing images and price.
- Export image and caption; use Android share sheet for Facebook, TikTok, Viber and Telegram where available.
- Label platform sharing as user-initiated sharing. Direct publishing requires each platform's approved API, OAuth scopes and review; do not claim automatic posting without it.
- Track ad draft/export/share events only with transparent privacy notice.

### Distribution and updates
- Signed release APK built with a protected signing key; keep keystore/password out of Git.
- Stable public download/release page and QR code; don't use expiring CI artifacts as the customer download URL.
- Updates must be signed with the same key and package ID. Sideloaded Android updates require user confirmation; no silent-install promise.
- Burmese installation guide, version/changelog, privacy policy, terms and support contact.

## Suggested architecture

- Keep current Capacitor Android wrapper and existing POS code while adding modules incrementally.
- Firebase Authentication for identity; Firestore for structured records; Cloud Storage for images; Cloud Functions for privileged operations; App Check where supported.
- Tenant-owned records must be scoped by authenticated UID/shop membership and enforced by Firestore/Storage rules. Never rely on client-side filters alone.
- Public marketplace data must live in a separate, explicitly public collection containing only approved fields. Private shop data stays under private tenant paths.
- Use server-side validation for price, ownership, listing status, manual subscription activation and moderation. Admin actions must be auditable.
- Keep payment outside the POS. The Platform Owner manually grants the selected subscription period after independently checking the external payment; record the grant in an auditable Owner log. Do not imply automatic wallet settlement.
- Offline POS writes need a queue, conflict policy, stable IDs and visible sync status before being advertised as reliable.

## Security and privacy launch gates

- Review Firestore rules and add Storage rules before enabling photo uploads.
- Enforce owner/shop membership and role checks on every read/write.
- Validate image MIME type, file size, dimensions and ownership; block executable content.
- Add rate limits, App Check, abuse reporting, moderation and backup/restore tests.
- Do not store passwords in app data; do not log tokens, payment details or personal data.
- Test account deletion/export, data retention, access revocation and lost-device scenarios.
- Run a threat model and a security test against OWASP MASVS/MASTG before production claims.

## Release gates (must pass before calling it production-ready)

1. Preserve current features and create a tested backup.
2. Unit/integration tests for POS totals, inventory movement, refunds, debts and subscription expiry.
3. Firestore and Storage rules emulator tests, including cross-shop access-denial tests.
4. Firebase project configuration and deployment confirmed; never invent API keys or claim a deployment from a Git commit.
5. Test photo upload, public listing moderation, private tenant isolation and offline recovery.
6. Install signed release APK on real Android devices and verify upgrade from prior release.
7. Verify printer models, KPay manual review, social share targets and low-end phone performance.
8. Publish privacy policy, terms, support process and customer installation/update guide.

## Research references

- Baymard marketplace UX benchmark: https://baymard.com/ux-benchmark/collections/marketplace
- OWASP Mobile Application Security: https://owasp.org/projects/mobile-application-security
- OWASP MASVS: https://mas.owasp.org/MASVS/
- Firebase Storage Security Rules: https://firebase.google.com/docs/reference/security/storage
- Firebase layered security learning path: https://developers.google.com/learn/pathways/firebase-security-layers
- Firebase project best practices: https://firebase.google.com/docs/projects/dev-workflows/general-best-practices

These are design and security references, not endorsements or permission to reproduce another company's proprietary product.
