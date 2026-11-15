from pathlib import Path

p = Path("www/index.html")
s = p.read_text(encoding="utf-8")

anchor = '$("createShopBtn").onclick=async()=>'
helper = r"""
async function apkProvisionShopOwner(email,password){
  const appName="ak-owner-provision-"+Date.now();
  const secondary=firebase.initializeApp(PROJECT,appName);
  const secondaryAuth=secondary.auth();
  secondaryAuth.languageCode="my";
  let account=null,accountReused=false;
  try{
    try{
      const credential=await secondaryAuth.createUserWithEmailAndPassword(email,password);
      account=credential.user;
    }catch(createError){
      if(createError.code!=="auth/email-already-in-use")throw createError;
      try{
        const credential=await secondaryAuth.signInWithEmailAndPassword(email,password);
        account=credential.user;
        accountReused=true;
      }catch(loginError){
        if(["auth/wrong-password","auth/invalid-credential","auth/user-not-found"].includes(loginError.code)){
          await secondaryAuth.sendPasswordResetEmail(email).catch(()=>{});
          throw new Error("ဤ Gmail ဖြင့် အကောင့်ရှိပြီးသားဖြစ်သည်။ Password Reset Link ပို့ရန် ကြိုးစားထားပါသည်။ Gmail Inbox/Spam စစ်ပြီး Password အသစ်သတ်မှတ်ကာ ပြန်လုပ်ပါ။");
        }
        throw loginError;
      }
    }
    await account.reload();
    const uid=account.uid,emailVerified=account.emailVerified===true;
    let verificationEmailSent=false,verificationError="";
    if(!emailVerified){
      try{await account.sendEmailVerification();verificationEmailSent=true;}
      catch(e){verificationError=String(e.message||e).slice(0,120);}
    }
    return {ok:true,uid,email,emailVerified,verificationEmailSent,verificationError,accountReused,credentialManagedBy:"firebase-secondary-auth"};
  }finally{
    try{await secondaryAuth.signOut();}catch(_){}
    try{await secondary.delete();}catch(_){}
  }
}
"""
if anchor not in s:
    raise SystemExit("APK patch failed: shop-owner create handler anchor not found")
if "async function apkProvisionShopOwner" not in s:
    s = s.replace(anchor, helper + "\n" + anchor, 1)

old = 'const token=await ownerToken();const resp=await fetch(GATEWAY+"/owner/provision",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({email,password,apiKey:PROJECT.apiKey})});const data=await resp.json();if(!resp.ok||!data.ok){if(data.passwordResetSent)throw Error("ဤ Gmail ဖြင့် အကောင့်ရှိပြီးသားဖြစ်သည်။ Password Reset Link ကို ဆိုင်ရှင်ထံ ပို့ထားပါပြီ။ ဆိုင်ရှင်က Password အသစ်သတ်မှတ်ပြီးနောက် အကောင့်ဖန်တီးမှုကို ပြန်လုပ်ပါ။");if(data.error==="shop_owner_email_exists_use_password_recovery")throw Error("ဤ Gmail အကောင့်ရှိပြီးသားဖြစ်သည်။ ဆိုင်ရှင်၏ Gmail မှ Password Recovery ပြုလုပ်ပြီး ပြန်စမ်းပါ။");throw Error(data.error||"Account creation failed")}'
new = 'const data=await apkProvisionShopOwner(email,password);if(!data.ok||!data.uid)throw Error("Firebase မှ အကောင့်ဖန်တီးမှု အတည်မပြုနိုင်ပါ");'
if old not in s:
    raise SystemExit("APK patch failed: expected Worker-dependent shop-owner provisioning code not found")
s = s.replace(old, new, 1)

# Do not allow an unverified or non-Owner session to provision shop accounts.
owner_guard_old = '$("createShopBtn").onclick=async()=>{const out=$("ownerStatus");try{const email='
owner_guard_new = '$("createShopBtn").onclick=async()=>{const out=$("ownerStatus");try{if(!isPlatformOwner()||!user||user.emailVerified!==true)throw Error("Verified Platform Owner အကောင့်ဖြင့်သာ ဆိုင်ရှင်အကောင့် ဖန်တီးနိုင်ပါသည်။");const email='
if owner_guard_old not in s:
    raise SystemExit("APK patch failed: shop-owner authorization guard anchor not found")
s = s.replace(owner_guard_old, owner_guard_new, 1)

# APK-only visual baseline: white surfaces, black text, neutral buttons/header.
css_anchor = "</style>"
css = """
/* APK-only AK navy and orange high-contrast theme */
:root{--navy:#10233f;--blue:#174a7e;--gold:#f28c28;--bg:#f3f6fa;--line:#d9e1ec;--ink:#172536;--muted:#607086;--green:#16734a;--red:#b42318}
body{background:linear-gradient(180deg,#eaf0f7 0%,#f7f9fc 220px,#f3f6fa 100%);color:var(--ink)}
header{background:linear-gradient(110deg,#10233f,#174a7e);color:#ffffff;border-bottom:3px solid #f28c28;box-shadow:0 3px 14px rgba(16,35,63,.16)}
header small{color:#dbe7f5}
header #userBadge{color:#ffffff!important}
button{background:#174a7e;color:#ffffff;border:1px solid #174a7e;border-radius:9px}
button:hover{background:#10233f}
button.secondary{background:#ffffff;color:#174a7e;border:1px solid #b9c9dc}
.tabs button.active{background:#f28c28;color:#172536;border-color:#f28c28}
th{background:#e8eef6;color:#10233f}
.stat{background:linear-gradient(145deg,#ffffff,#f5f8fc);border:1px solid #d9e1ec;border-radius:12px;box-shadow:0 2px 8px rgba(16,35,63,.06)}
input,select,textarea{border:1px solid #c7d3e1;border-radius:8px}
:focus-visible{outline:3px solid rgba(242,140,40,.45);outline-offset:2px}
"""
if "APK-only neutral high-contrast theme" not in s:
    if css_anchor not in s: raise SystemExit("APK patch failed: CSS insertion point missing")
    s=s.replace(css_anchor,css+"\n"+css_anchor,1)


# APK-only receipt and advertising improvements.
globals_old = 'let auth,db,user,shopId="",staffRole="owner",products=[],sales=[],purchases=[],people=[],expenses=[],editingProduct=null,licenses=[];'
globals_new = 'let auth,db,user,shopId="",staffRole="owner",products=[],sales=[],purchases=[],people=[],expenses=[],editingProduct=null,licenses=[],activeShopName="ဆိုင်အမည်";'
if globals_old not in s: raise SystemExit("APK patch failed: app globals anchor missing")
s=s.replace(globals_old,globals_new,1)

owner_title = '$("shopTitle").textContent="AK Hardware & Electrical · Owner POS";'
if owner_title not in s: raise SystemExit("APK patch failed: owner shop title anchor missing")
s=s.replace(owner_title,'activeShopName="AK Hardware & Electrical";'+owner_title,1)
license_title = '$("shopTitle").textContent=lic.data().shopName||"ဆိုင် Dashboard";'
if license_title not in s: raise SystemExit("APK patch failed: licensed shop title anchor missing")
s=s.replace(license_title,'activeShopName=String(lic.data().shopName||"ဆိုင်အမည်");'+license_title,1)

# Add a shop/brand name field to the ad composer, rather than hard-coding AK branding.
ad_contact = '<div><label>ဆက်သွယ်ရန်</label><input id="adContact" placeholder="ဖုန်း / Viber"></div>'
ad_contact_new = '<div><label>ကြော်ငြာပေါ် ဆိုင်အမည်</label><input id="adBrand" placeholder="ဆိုင်အမည်"></div>'+ad_contact
if ad_contact not in s: raise SystemExit("APK patch failed: ad contact field anchor missing")
s=s.replace(ad_contact,ad_contact_new,1)
s=s.replace('const name=$("adName").value.trim(),price=$("adPrice").value,contact=$("adContact").value.trim(),file=$("adPhoto").files[0],canvas=$("adCanvas"),ctx=canvas.getContext("2d");',
            'const name=$("adName").value.trim(),price=$("adPrice").value,contact=$("adContact").value.trim(),brand=$("adBrand").value.trim()||activeShopName||"ဆိုင်အမည်",file=$("adPhoto").files[0],canvas=$("adCanvas"),ctx=canvas.getContext("2d");',1)
s=s.replace('ctx.fillText("AK HARDWARE & ELECTRICAL",540,105);','ctx.fillText(brand.slice(0,32),540,105);',1)
s=s.replace('ctx.fillText("AK",540,540);ctx.font="bold 38px system-ui";ctx.fillText("Hardware & Electrical",540,610);','ctx.fillText(brand.slice(0,24),540,540);',1)
s=s.replace('contact||"ဆက်သွယ်ရန် · AK Hardware & Electrical"','contact||"ဆက်သွယ်ရန်"',1)
s=s.replace('($("adContact").value||"AK Hardware & Electrical")','($("adContact").value||$("adBrand").value||activeShopName||"")',1)

# Use the actual shop name on all sale receipt outputs.
s=s.replace('push("AK Hardware & Electrical",27,true,"center");','push(activeShopName||"ဆိုင်အမည်",27,true,"center");',1)
s=s.replace('const text=["AK Hardware & Electrical","ဘောင်ချာ: "','const text=[activeShopName||"ဆိုင်အမည်","ဘောင်ချာ: "',1)
s=s.replace('c.fillText("AK Hardware & Electrical",360,82);','c.fillText(activeShopName||"ဆိုင်အမည်",360,82);',1)
old_receipt = '<h2>AK Hardware & Electrical</h2><p>ဘောင်ချာ: '
new_receipt = """<h2>'+esc(activeShopName||"ဆိုင်အမည်")+'</h2><p>ဘောင်ချာ: """
s=s.replace(old_receipt,new_receipt,1)

# After a successful sale, immediately open that sale's receipt for print/PDF.
sale_end = '  await reloadAll();\n }catch(e){alert(errText(e))}\n};\n$("savePurchase").onclick=async()=>'
sale_end_new = '   await reloadAll();\n   await window.printSaleReceipt(saleRef.id);\n  }catch(e){alert(errText(e))}\n };\n $("savePurchase").onclick=async()=>'
if sale_end not in s: raise SystemExit("APK patch failed: post-sale receipt insertion point missing")
s=s.replace(sale_end,sale_end_new,1)

p.write_text(s,encoding="utf-8")
print("APK-only additions applied: immediate post-sale receipt, dynamic shop branding on receipts and ad artwork.")

p.write_text(s,encoding="utf-8")
print("APK-only patch applied: shop-owner provisioning no longer depends on Cloudflare Worker; secondary Firebase Auth preserves Owner session; retry existing Gmail with matching password; password reset fallback; white/black high-contrast theme.")
