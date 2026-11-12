# AK Sale POS — AI Monitoring and Desktop-Style UI Requirements

Status: implementation specification; do not treat these items as shipped until the APK and runtime tests pass.

## Carry-forward requirements from prior AK Sale conversations

- Keep the Platform Owner Control Center separate from each shop's POS workspace. Platform Owner enters their own POS by default and can switch to the Owner Control Center. A customer shop must never see Platform Owner controls or another shop's records.
- Platform Owner manages up to 100 customer shops. Shop owners self-register; Platform Owner manually issues and extends licenses. Plans: 30 days / 30,000 MMK; 90 days / 90,000 MMK; 180 days / 180,000 MMK; 365 days / 360,000 MMK. Expired accounts are locked without deleting their data; renewal restores access.
- Do not add in-app KPay, WavePay, KBZPay, payment screenshot, or checkout flows. Payment is handled externally; Platform Owner manually updates license validity.
- Shop Owner invites staff using Merchant Code. Maximum 3 staff per shop. Verified email, tenant isolation, role permissions, and per-user print permission are required.
- Device limit default 5, configurable by Platform Owner.
- POS scope: inventory/products, SKU/barcode, Hardware/Electrical categories, cost/retail/wholesale prices, stock and low-stock alerts, product photos, purchases, sales, cash/partial/credit, customers/suppliers, expenses, receivables/payables, profit/loss, reports, CSV export, printing, and backup/restore.
- Keep product advertisement creation/sharing for Viber and TikTok. A share-sheet handoff is acceptable; do not claim unattended TikTok posting.
- Remove Marketplace, sponsored-ad, complaint/review, and obsolete guide-page features from the APK.
- Keep the app free-tier-compatible. Do not require Firebase Blaze/pay-as-you-go or deploy Firebase Functions as a prerequisite.
- Do not expose API keys or AI provider secrets in the APK.

## AI features

The AI Assistant is a distinct screen/section, not embedded inside the POS, sales, inventory, or Owner Control Center screens.

1. **App health monitoring and repair guidance (newly requested):**
   - Collect privacy-minimized technical diagnostics: app version, Android/WebView version, connectivity state, sync queue state, last successful cloud sync, app exceptions, permission failures, and printer connection/error codes.
   - Detect repeated crashes, failed sign-in, sync conflicts, stuck pending writes, unavailable Firestore, and printer failures.
   - Show a clear issue list with severity, time, affected module, explanation, and recommended next action.
   - Provide safe self-recovery actions only where deterministic (retry sync, refresh session, clear stale cache after confirming cloud backup, re-check printer connection). Never silently delete shop data, reset credentials, alter licenses, or weaken security rules.
   - AI may explain diagnostic events and propose steps; it must not autonomously modify financial records, permissions, roles, licenses, or security rules.
   - Keep an auditable local diagnostic log and an Owner-visible system-health summary. Never include passwords, tokens, API keys, or full customer financial records in diagnostic payloads.
   - AI service calls must go through a protected server endpoint with secrets stored server-side. If no secure endpoint is configured, provide local diagnostics and rule-based guidance without pretending generative AI is connected.

2. **AI advertising:**
   - Use product photo and user-provided product details to draft product titles and promotional copy suitable for Viber/TikTok.
   - Preserve user approval before sharing. Do not invent product specifications or prices.

3. **AI security:**
   - Flag suspicious sign-in patterns, unauthorized access attempts, cross-tenant access denials, and privilege misuse.
   - Provide evidence and recommended action. Do not automatically ban accounts or change roles/licenses without Platform Owner approval.

4. **Ask ChatGPT from the app:**
   - Provide a separate assistant entry point. Keep it clearly separate from transactional screens.
   - No API key embedded in APK.

5. **Explicit exclusions:**
   - No AI sales forecasting, profit prediction, automatic financial advice, or automatic alteration of sales/profit records.
   - Do not mix AI chat into the cashier POS workflow.

## Desktop-style visual design

- Use a compact, professional business-software layout: rectangular panels, aligned columns, clear table headers, dense but readable rows, and visible totals/status columns.
- Prefer a consistent palette: deep navy/blue for navigation and primary actions; white or very light neutral table surfaces; slate/gray for secondary text and borders; green for successful/paid/active; amber for pending/warning/low stock; red for errors/expired/blocked.
- Use color consistently to communicate state, not as decoration. Maintain readable contrast.
- Dashboard should show multiple compact KPI tiles and recent-record tables at once.
- Tables should support search, sort, filters, sticky headers where practical, pagination or virtualized rows for large datasets, and CSV export where appropriate.
- On Android portrait, preserve usable touch targets and allow horizontal table scrolling or a compact column mode. In landscape/tablet, show more columns simultaneously. Do not shrink text to an unreadable size.
- Keep navigation and workspace context obvious: Platform Owner, Shop Owner, Manager, Cashier/Employee. Never expose controls outside the current role.
- Use consistent rectangular form fields, compact toolbars, clear empty/error/loading states, and confirmation for destructive actions.

## Release gates

- Add unit tests for diagnostics redaction, event classification, safe recovery actions, and role visibility.
- Add emulator tests for tenant isolation, license expiry, staff permissions, and any new rules.
- Add UI smoke tests for both the root website shell and dedicated APK shell.
- Build APK only after all CI checks pass. Verify the APK artifact and version. Then perform real Android sign-in, owner/shop separation, staff invite/claim, POS read/write, sync, license expiry/renewal, and printer checks before calling it production-ready.
- Keep the existing production branch and live Firestore data untouched until migration and rollback are verified.