# AK Sale Software — English User Guide

## Sign-in and shop setup
Open the app online. The verified platform Owner account is `painglin102@gmail.com`. Shop users must sign in with their own accounts and receive Owner approval for paid access. Set the shop name, currency, location and contact details before printing receipts.

## Products and barcode scanning
Add product name, SKU/barcode, category, unit, cost, retail price, wholesale price, stock and optional photo. The product form now includes a Camera Scan control. It uses Android/Chrome `BarcodeDetector` where available and requires camera permission over HTTPS. If the API is unavailable, update Chrome or use a Bluetooth/USB HID scanner that types into the focused code field. Test the exact scanner and barcode formats before relying on it.

## Sales, purchases and stock
Record quantity, price type, amount received and credit due for every sale. Record purchases and supplier payments. Review stock after returns, corrections and damaged goods. Never silently edit stock to hide a missing transaction.

## Customers, suppliers and finance
Keep customer/supplier records accurate. Record each collection/payment against the right person. Enter rent, wages, transport and other operating expenses separately. Profit reports are estimates and depend on accurate purchase costs and stock movements.

## Reports, printing and backup
Review sales, estimated gross profit, expenses, stock and receivables/payables. Printing depends on Android Print Service and the installed printer app. Direct Bluetooth ESC/POS printing is not guaranteed. Export a JSON backup regularly and store it outside the phone. Back up before restoring or loading cloud data.

## Cloud and subscriptions
Cloud sync must be tested with two accounts and two physical devices before commercial use. Current KBZPay payment approval is manual: the Owner must confirm the actual incoming transfer in KBZPay before activating a subscription. A screenshot alone is not proof of payment. Automatic merchant verification is not enabled.

## Marketing and integrations
Use Android Share to send advertisements to supported apps such as Viber. Automatic TikTok publishing is not implemented. Camera barcode/QR scanning is the only camera sensor integration added here; GPS, NFC, biometric and other sensors require separate native Android implementation and device testing. Bluetooth printers require a compatible print service or native bridge.

## Security and release checklist
Never share passwords, OTPs, Firebase service-account JSON, keystores or signing passwords. Test owner access, account data isolation, product-to-report calculations, backup/restore, payment approval, offline recovery, scanner, printer and at least two Android devices. A successful APK build alone does not prove production readiness.
