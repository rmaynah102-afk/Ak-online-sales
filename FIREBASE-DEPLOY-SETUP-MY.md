# AK Sale Software — Firebase Setup & Deployment (မြန်မာ)

## လက်ရှိ အခြေအနေ

- Firebase Hosting ကို GitHub Actions မှ Deploy လုပ်နိုင်ရန် Service Account Secret ရှိပြီး၊ Hosting deploy ကို စမ်းသပ်အောင်မြင်ထားသည်။
- Workflow အသစ်သည် Hosting ပြီးနောက် Firestore Rules နှင့် Storage Rules ကို ထပ်မံ Deploy လုပ်ရန် ကြိုးစားမည်။ Rules API / Storage IAM permission မလုံလောက်ပါက သက်ဆိုင်ရာ Step မှာ မအောင်မြင်ကြောင်း ပြမည်။
- Cloud Functions များကို အလိုအလျောက် Deploy မလုပ်ပါ။ Subscription ငွေစစ်ခြင်း၊ License ဖွင့်ခြင်း၊ Device Management၊ Cloud Backup တို့သည် Functions ပေါ်မူတည်သည်။

## လိုအပ်သော အဆင့်များ

1. **Service Account:** GitHub Repository → Settings → Secrets and variables → Actions ထဲရှိ `FIREBASE_SERVICE_ACCOUNT_AK_ONLIN_SALES` Secret ကို ထိန်းသိမ်းပါ။ JSON private key ကို ChatGPT၊ Screenshot၊ Commit သို့မဟုတ် Public file ထဲ မထည့်ပါနှင့်။
2. **Rules permissions:** Rules deployment မအောင်မြင်ပါက Firebase Project IAM ထဲတွင် Service Account ကို လိုအပ်သည့် အနည်းဆုံး Firebase Rules / Storage permission ပေးပြီး Workflow ကို ပြန် Run လုပ်ပါ။
3. **Cloud Functions / Billing:** Functions deploy သည် Firebase Blaze နှင့် Google Cloud Billing လိုအပ်နိုင်သည်။ Billing သည် အသုံးပြုမှုအလိုက် ကုန်ကျစရိတ်ရှိနိုင်သဖြင့် Owner က Billing အကျိုးဆက်ကို လက်ခံပြီးမှသာ ဖွင့်ပါ။
4. **Functions deploy opt-in:** Billing ကို Owner ကိုယ်တိုင် ချိတ်ဆက်ပြီးနောက် GitHub Repository → Settings → Secrets and variables → Actions → Variables တွင် `AK_ENABLE_FUNCTIONS_DEPLOY` ကို `true` ထားပြီး Firebase workflow ကို ပြန် Run လုပ်ပါ။ ဒီ Variable သည် Billing ကို မဖွင့်ပေးပါ၊ Deploy ခွင့်ပြုချက်ကိုသာ ဖွင့်ပေးသည်။

## Deploy စစ်ဆေးရန်

- GitHub → Actions → Deploy AK Sale Firebase Resources ကိုဖွင့်ပါ။
- Hosting, Rules, Functions Step တစ်ခုချင်းစီ၏ Result ကို သီးခြားစစ်ပါ။
- Workflow အစိမ်းရောင်ဖြစ်ရုံဖြင့် Cloud Functions deploy ပြီးပြီဟု မယူဆပါနှင့်။ Functions Step ကို Skip လုပ်ထားပါက Subscription payment approval, License activation, Device management နှင့် Cloud backup တို့ မရနိုင်သေးပါ။
- Firebase Console ထဲတွင် Firestore Rules, Storage Rules နှင့် Functions များ၏ Live state ကို စစ်ဆေးပါ။

## လုံခြုံရေး

- Firebase Web App config သည် Client-side public config ဖြစ်ပြီး Service Account private key မဟုတ်ပါ။
- Service Account JSON, private key, Android signing keystore, password နှင့် OTP များကို Repository ထဲ မတင်ပါနှင့်။
- Rules များကို စမ်းသပ်မပြီးခင် Firestore ကို Public read/write မဖွင့်ပါနှင့်။
- KBZPay ငွေဝင်မှုကို Owner က ကိုယ်တိုင်စစ်ဆေးပြီးမှ License Approve လုပ်ပါ။

---

# AK Sale Software — Firebase Setup & Deployment (English)

Firebase Hosting deployment has succeeded using the GitHub Actions service-account secret. The updated workflow also attempts Firestore and Storage Rules deployment; inspect each step because the service account may still need the minimum required IAM permissions.

Cloud Functions are intentionally gated. Subscription payment approval, license activation, device management and cloud backups depend on those functions.

Cloud Functions deployment may require Firebase Blaze and a linked Google Cloud Billing account, which can incur usage charges. Do not enable billing unless the owner has reviewed and accepted the costs. After billing is linked by the owner, set the GitHub Actions repository variable `AK_ENABLE_FUNCTIONS_DEPLOY` to `true` and rerun the Firebase workflow. This variable does not enable billing; it only permits the workflow's Functions deployment step.

Never commit or share service-account JSON, private keys, signing keystores, passwords or OTPs. A green workflow alone does not prove every Firebase component deployed; verify Hosting, Rules and Functions step results separately in Firebase Console.
