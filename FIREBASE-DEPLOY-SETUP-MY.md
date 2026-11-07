# AK Sale Software — Firebase Setup & Deployment (မြန်မာ)

## လက်ရှိအခြေအနေ

- AK Sale ၏ Web App Firebase client config ကို `firebase-config.js` မှ အလိုအလျောက်ဖတ်မည်။ ဤ config သည် Web App အတွက် public client config ဖြစ်ပြီး Service Account private key မဟုတ်ပါ။
- GitHub Actions ၏ `Deploy AK Sale to Firebase Resources` workflow သည် လက်ရှိတွင် **Firebase Hosting ကိုသာ** deploy လုပ်သည်။
- `firestore.rules` နှင့် `storage.rules` ကို Repository ထဲတွင် ထားရှိသော်လည်း လက်ရှိ workflow က Live Firebase သို့ deploy မလုပ်ပါ။
- `functions/index.js` ထဲရှိ callable Cloud Functions များကိုလည်း လက်ရှိ workflow က deploy မလုပ်ပါ။

## Firebase အပြည့်အစုံ ချိတ်ရန် လိုအပ်နေသောအရာများ

1. **Firestore / Storage Rules:** GitHub Actions Service Account တွင် Firebase Rules API deploy permission မရှိသေးပါ။ Rules Admin ဆိုင်ရာ IAM permission ကို Project Owner က စစ်ဆေးပြီးမှ deploy လုပ်နိုင်မည်။
2. **Cloud Functions:** AK Sale ၏ Payment Approval, Device Control, Cloud Backup စသည့် Server Functions များ deploy လုပ်ရန် Firebase Blaze plan နှင့် Google Cloud Billing လိုအပ်နိုင်သည်။ Billing ကို ပိုင်ရှင်၏ ခွင့်ပြုချက်မရှိဘဲ မဖွင့်ရ။
3. **Service Account Secret:** GitHub Repository Settings → Secrets and variables → Actions ထဲရှိ `FIREBASE_SERVICE_ACCOUNT_AK_ONLIN_SALES` ကို အသုံးပြုသည်။ Secret value ကို ChatGPT၊ commit သို့မဟုတ် public file ထဲ မထည့်ရ။

## Deploy အခြေအနေကို စစ်ဆေးရန်

- GitHub → Actions → Deploy AK Sale to Firebase Resources ကိုဖွင့်ပါ။
- Workflow summary ထဲတွင် Hosting deploy step အောင်မြင်ကြောင်းကိုသာ အတည်ပြုပါ။
- Workflow အစိမ်းရောင်ဖြစ်ရုံဖြင့် Firestore Rules၊ Storage Rules သို့မဟုတ် Cloud Functions deploy ပြီးပြီဟု မယူဆပါနှင့်။
- Live Firebase Rules နှင့် Functions အခြေအနေကို Firebase Console မှ Project Owner က သီးခြားစစ်ဆေးရန် လိုအပ်သည်။

## လုံခြုံရေး

- Firebase Web App config သည် browser/app ထဲတွင် အသုံးပြုရန် public client configuration ဖြစ်သည်။ လုံခြုံရေးကို Firestore/Storage Rules၊ Authentication နှင့် API key restrictions တို့ဖြင့် ကာကွယ်ရမည်။
- Service Account JSON၊ private key၊ keystore၊ password နှင့် OTP တို့ကို Repository ထဲ မတင်ရ။
- Billing plan၊ IAM permissions သို့မဟုတ် Firebase Console settings များကို Project Owner ခွင့်ပြုချက်မရှိဘဲ မပြောင်းရ။

---

# AK Sale Software — Firebase Setup & Deployment (English)

The Firebase Web App client configuration is loaded from `firebase-config.js`. This is public browser configuration, not a service-account private key.

The current GitHub Actions workflow deploys **Firebase Hosting only**. It does not deploy Firestore Rules, Storage Rules or Cloud Functions.

Firestore and Storage Rules are present in the repository but are not deployed by the current workflow because the deployment service account lacks Firebase Rules API permission. The project owner must review and grant the minimum required IAM permission before deploying rules.

Callable Cloud Functions in `functions/index.js` are not deployed by the current workflow. Deployment may require Firebase Blaze and a linked Google Cloud Billing account. Do not enable billing without the owner's explicit approval.

The workflow uses the GitHub Actions secret `FIREBASE_SERVICE_ACCOUNT_AK_ONLIN_SALES`. Never commit or share service-account JSON, private keys, keystores, passwords or OTPs.

A green workflow confirms Hosting only. Verify Firestore Rules, Storage Rules and Functions separately in Firebase Console before relying on cloud payments, backups or device management.