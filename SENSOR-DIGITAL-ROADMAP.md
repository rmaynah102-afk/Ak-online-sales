# AK Sale — Device, Sensor & Digital Integration Roadmap

This document distinguishes browser capabilities from future native hardware integrations. Do not advertise an integration as available until it has been implemented and tested on supported Android models.

## Available in the current web code
- Camera barcode/QR scanning through the browser BarcodeDetector API when supported by the browser/device, camera permission, and HTTPS.
- Bluetooth/USB HID barcode scanners that behave like a keyboard and type into the focused product-code field.
- Android share sheet for user-confirmed sharing.
- Android Print Service/system print dialog where supported by the device and printer app.

## Not verified as direct native integrations
- Bluetooth Classic/BLE ESC-POS thermal printer commands.
- USB OTG printer protocol or cash-drawer control.
- NFC tag/card reading or payment.
- Fingerprint/face biometric login or staff attendance.
- GPS/geofencing, accelerometer, gyroscope, ambient-light, proximity, temperature, or external sensors.
- Automatic TikTok publishing or automatic Viber message sending.
- Automatic bank or mobile-wallet payment confirmation.

## Safe implementation sequence
1. Select exact hardware models and obtain vendor API/protocol documentation.
2. Implement a Capacitor Android plugin/native bridge with minimum required permissions.
3. Explain data collection and request user consent where appropriate.
4. Test permission denial, connection loss, offline mode, battery use, and Android-version differences.
5. Add compatibility notes and a manual fallback.
6. Complete security review and real-device QA before enabling the feature for customers.

## Recommended priority for a hardware shop
1. Reliable barcode scanning and stock lookup.
2. Thermal receipt printing for a named printer model.
3. Cash-drawer integration only when supported by that printer.
4. Offline-first queue and conflict-safe cloud synchronization.
5. Role-based staff access and audit logs.
6. Payment provider integration through an authorized merchant API with server-side verification.

Do not collect biometric, location, or sensor data unless the feature genuinely needs it. Never store raw biometric templates or payment credentials in browser storage. Do not claim universal hardware compatibility.
