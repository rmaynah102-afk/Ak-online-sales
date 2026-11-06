# AK Sale Software — Firebase Deployment Setup (မြန်မာ)

ဤစာတမ်းသည် GitHub Actions မှ Firebase Hosting, Firestore Rules, Storage Rules နှင့် Cloud Functions ကို deploy လုပ်ရန်အတွက်သာ ဖြစ်သည်။

## လိုအပ်သော Secret

GitHub repository `rmaynah102-afk/Ak-online-sales` ထဲတွင် အောက်ပါ Repository Secret တစ်ခုကို ထည့်ရမည်။

- **Name:** `FIREBASE_SERVICE_ACCOUNT_AK_ONLIN_SALES`
- **Value:** Firebase project `ak-onlin-sales` အတွက် ခွင့်ပြုချက်ရှိသော Google Cloud Service Account key JSON ဖိုင်၏ အကြောင်းအရာ အပြည့်အစုံ။

## Service Account key ဖန်တီးခြင်း

1. Google Cloud Console ကိုဖွင့်ပြီး project **ak-onlin-sales** ကိုရွေးပါ။
2. **IAM & Admin → Service Accounts** သို့ဝင်ပါ။
3. Deployment အတွက် သီးသန့် Service Account တစ်ခုဖန်တီးခြင်းကို ဦးစားပေးပါ။ ရှိပြီးသား account ကို သုံးမည်ဆိုလျှင် project နှင့် deployment ခွင့်ပြုချက်များကို အရင်စစ်ပါ။
4. Hosting, Firestore/Storage Rules နှင့် Cloud Functions deploy လုပ်ရန် လိုအပ်သည့် IAM roles ကို အနည်းဆုံးလိုအပ်သည့်အတိုင်းသာ ပေးပါ။ ပုံမှန်အားဖြင့် Firebase Admin, Cloud Functions Admin, Service Account User, Cloud Build ဆိုင်ရာ deploy permission နှင့် Service Usage ဆိုင်ရာ permission များ လိုနိုင်သည်။ Project ပေါ်မူတည်၍ Cloud Run/Artifact Registry permission များလည်း လိုနိုင်သည်။
5. Service Account → **Keys → Add key → Create new key → JSON** ကိုရွေးပြီး key ကို ကိုယ်ပိုင်ဖုန်း/ကွန်ပျူတာထဲသို့သာ သိမ်းပါ။

## GitHub ထဲ Secret ထည့်ခြင်း (ဖုန်း Browser မှ)

1. GitHub တွင် `rmaynah102-afk/Ak-online-sales` repository ကိုဖွင့်ပါ။
2. **Settings → Secrets and variables → Actions** ကိုဖွင့်ပါ။
3. **New repository secret** ကိုနှိပ်ပါ။
4. Name ကို အတိအကျ `FIREBASE_SERVICE_ACCOUNT_AK_ONLIN_SALES` ဟုထည့်ပါ။
5. Value ထဲတွင် JSON ဖိုင်ကို text editor ဖြင့်ဖွင့်ပြီး အကြောင်းအရာအားလုံးကို paste လုပ်ပါ။ JSON ၏ အစနှင့်အဆုံး braces များပါဝင်ရမည်။
6. **Add secret** ကိုနှိပ်ပါ။

## Deploy အခြေအနေ စစ်ဆေးခြင်း

- Repository ၏ **Actions** tab ကိုဖွင့်ပါ။
- **Deploy AK Sale to Firebase Hosting and Firestore Rules** workflow ကိုရွေးပါ။
- နောက်ဆုံး run ၏ **Check Firebase service account secret** နှင့် **Deploy Hosting and Firestore Rules** အဆင့်များကိုကြည့်ပါ။
- Secret မရှိပါက workflow summary တွင် **Firebase deployment not performed** ဟုပြမည်။ Workflow အစိမ်းရောင်ဖြစ်ခြင်းတစ်ခုတည်းကို deploy အောင်မြင်သည်ဟု မယူဆပါနှင့်။
- Deploy step အမှန်တကယ် run ပြီး success ဖြစ်မှသာ Firebase resources တင်ပြီးဖြစ်သည်။

## လုံခြုံရေး

- Service Account JSON, private key, password, OTP တို့ကို ChatGPT chat, GitHub repository file, issue, commit, README သို့ မတင်ပါနှင့်။
- JSON ကို **Repository Secret** ထဲတွင်သာ ထည့်ပါ။
- Key ပေါက်ကြားပါက Google Cloud Console တွင် ချက်ချင်း revoke/delete လုပ်ပြီး key အသစ်ထုတ်ပါ။
- Service Account ကို မလိုအပ်သော Owner/Editor အခွင့်အရေး မပေးပါနှင့်။

---

# AK Sale Software — Firebase Deployment Setup (English)

The GitHub Actions workflow deploys Firebase Hosting, Firestore Rules, Storage Rules and Cloud Functions for project `ak-onlin-sales`.

Create a repository Actions secret named exactly `FIREBASE_SERVICE_ACCOUNT_AK_ONLIN_SALES`. Its value must be the complete JSON key of a Google Cloud service account authorized to deploy these resources.

Prefer a dedicated deployment service account with least-privilege IAM roles. Depending on enabled Firebase/Google Cloud services, deployment may require Firebase Admin, Cloud Functions Admin, Service Account User, Cloud Build, Service Usage, and Cloud Run/Artifact Registry permissions.

In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**, enter the exact name above, paste the complete JSON file contents as the value, and save.

Never commit or share the JSON key in chat, repository files, issues, or logs. Verify that the Actions run actually executes the deploy step; a successful workflow with skipped deployment steps does not mean Firebase was deployed.
