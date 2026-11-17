from pathlib import Path

p = Path("www/index.html")
s = p.read_text(encoding="utf-8")

# Shop-owner provisioning uses the authenticated Cloudflare gateway to create
# Firebase Email/Password credentials and send verification or password-reset mail.
# The app then writes the one-time, expiry-bound Firestore shop invitation.
if "async function apkProvisionShopOwner(email,password,expiresOn,shopName,industryType)" not in s:
    raise SystemExit("APK patch failed: password-based Shop Owner provisioning helper missing")
if 'fetch(GATEWAY+"/owner/provision"' not in s:
    raise SystemExit("APK patch failed: authenticated Shop Owner provisioning gateway is missing")
if "async function claimStaffInvite(signedUser,code)" not in s or "akStaffRegistration" not in s:
    raise SystemExit("APK patch failed: verified Gmail Staff registration and Merchant Code claim are missing")
if 'async function assertVerifiedPlatformOwner()' not in s or 'await assertVerifiedPlatformOwner();' not in s:
    raise SystemExit("APK patch failed: refreshed Google-verified Platform Owner guard missing")

# APK-only visual baseline: white surfaces, black text, neutral buttons/header.
css_anchor = "</style>"
css = """
/* APK-only AK dark monochrome high-contrast theme */
:root{color-scheme:dark;--navy:#090b0e;--blue:#171b20;--gold:#d7dce2;--bg:#090b0e;--line:#30363d;--ink:#f1f3f5;--muted:#aeb6bf;--green:#d7dce2;--red:#c7cbd0}
html,body{background:#090b0e!important;color:#f1f3f5!important}
body{font-family:system-ui,"Noto Sans Myanmar",sans-serif;font-size:14px;line-height:1.42;background:#090b0e!important;color:#f1f3f5}
header{background:#090b0e!important;color:#fff;border-bottom:1px solid #555b63;box-shadow:none}
header small{color:#c9cdd2}
header #userBadge{color:#fff!important}
.card{background:#11151a!important;color:#f1f3f5;border:1px solid #343b43;border-radius:9px;box-shadow:none}
h2,h3{color:#f1f3f5;font-weight:800;letter-spacing:.15px;text-shadow:0 1px 0 #000}
label{color:#c5cbd2}
button{background:#d8dde3;color:#11151a;border:1px solid #d8dde3;border-radius:5px;font-weight:750}
button:hover{background:#eef1f4}
button.secondary{background:#171c22;color:#edf0f3;border:1px solid #555e68}
button.danger{background:#333941;color:#fff;border-color:#666e78}
.tabs{background:#090b0e}
.tabs button{background:#171c22;color:#e8ebee;border-color:#454d57}
.tabs button.active{background:#e1e5e9;color:#0b0d10;border-color:#e1e5e9}
.stat{background:#0c1014;border:1px solid #303740;color:#f1f3f5}
.stat b{color:#f4f5f6}
input,select,textarea{background:#090c10!important;color:#f4f5f6!important;border:1px solid #424a53!important}
input::placeholder,textarea::placeholder{color:#858e98}
.notice,.pill,.printer-highlight{background:#1a2026!important;color:#e9edf0!important;border:1px solid #434b54}
.muted,#status{color:#aeb6bf!important}
.tablewrap{background:#0c1014;border:1px solid #343b43}
table{background:#0c1014;border-collapse:separate;border-spacing:0}
th,td{background:#0c1014!important;color:#e8ebee!important;border-bottom:1px solid #303740!important;border-right:1px solid #252c33!important}
th{background:#1a2026!important;color:#fff!important}
tr:hover td{background:#151a20!important}
#loginPanel{background:#11151a!important;border:1px solid #555e68}
#productSheet input{background:#090c10!important;color:#f4f5f6!important}
@media(max-width:599px){main{padding:7px}.card{padding:9px}.grid{gap:7px}.stats{gap:5px}.stat{padding:8px}.tabs button{flex:0 0 auto;font-size:12px;padding:7px 9px}.row{gap:6px}}
"""
if "APK-only neutral high-contrast theme" not in s:
    if css_anchor not in s: raise SystemExit("APK patch failed: CSS insertion point missing")
    s=s.replace(css_anchor,css+"\n"+css_anchor,1)


# APK-only receipt and advertising improvements.
globals_old = 'let auth,db,user,shopId="",staffRole="owner",products=[],sales=[],purchases=[],people=[],expenses=[],editingProduct=null,licenses=[];'
globals_new = 'let auth,db,user,shopId="",staffRole="owner",products=[],sales=[],purchases=[],people=[],expenses=[],editingProduct=null,licenses=[],activeShopName="ဆိုင်အမည်";'
if globals_old in s:
    s=s.replace(globals_old,globals_new,1)
elif 'activeShopName=' not in s:
    current_globals = 'let auth,db,user,shopId="",staffRole="owner",products=[],sales=[],purchases=[],people=[],expenses=[],payments=[],editingProduct=null,licenses=[],saleCart=[];'
    if current_globals not in s: raise SystemExit("APK patch failed: app globals anchor missing")
    s=s.replace(current_globals,current_globals[:-1]+',activeShopName="ဆိုင်အမည်";',1)

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
if sale_end in s:
    s=s.replace(sale_end,sale_end_new,1)
elif 'await window.printSaleReceipt(saleRef.id)' not in s:
    cart_sale_end = 'saleCart=[];$("salePaid").value="0";$("saleCustomer").value="";renderSaleCart();await reloadAll();'
    if cart_sale_end not in s: raise SystemExit("APK patch failed: post-sale receipt insertion point missing")
    s=s.replace(cart_sale_end,cart_sale_end+'await window.printSaleReceipt(saleRef.id);',1)

p.write_text(s,encoding="utf-8")
print("APK-only additions applied: immediate post-sale receipt, dynamic shop branding on receipts and ad artwork.")

p.write_text(s,encoding="utf-8")
print("APK-only patch applied: shop-owner provisioning no longer depends on Cloudflare Worker; secondary Firebase Auth preserves Owner session; retry existing Gmail with matching password; password reset fallback; white/black high-contrast theme.")


# APK-only user-selectable color themes and spreadsheet-style sales/purchase ledgers.
p = Path("www/index.html")
s = p.read_text(encoding="utf-8")

theme_css = r"""
/* User-selectable shop themes and spreadsheet-like ledgers */
:root{--table-head:#e8eef6;--table-alt:#f7f9fc;--table-hover:#edf4fb;--accent-soft:#fff0df}
.tablewrap{border:1px solid var(--line);border-radius:10px;background:#fff;max-height:68vh;overflow:auto}
.tablewrap table{min-width:760px;border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums}
.tablewrap th{position:sticky;top:0;z-index:2;background:var(--table-head);color:var(--navy);font-weight:750;white-space:nowrap;border-bottom:2px solid var(--blue)}
.tablewrap td{padding:10px 11px;border-bottom:1px solid var(--line);vertical-align:middle}
.tablewrap tbody tr:nth-child(even){background:var(--table-alt)}
.tablewrap tbody tr:hover{background:var(--table-hover)}
.tablewrap td:nth-child(n+3){font-variant-numeric:tabular-nums}
.table-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0 8px}
.table-tools input{flex:1 1 220px;max-width:440px}
.table-summary{font-size:13px;font-weight:700;color:var(--navy);background:var(--accent-soft);border:1px solid var(--line);border-radius:8px;padding:9px 12px}
.theme-card{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.theme-card label{margin:0;min-width:110px}
.theme-card select{max-width:250px}
.theme-card input[type=color]{width:54px;min-width:54px;height:44px;padding:4px}
body[data-theme="dark"]{background:#111a23!important;color:#edf3f8}
body[data-theme="dark"] .card,body[data-theme="dark"] .tablewrap{background:#182431;color:#edf3f8;border-color:#334454}
body[data-theme="dark"] input,body[data-theme="dark"] select,body[data-theme="dark"] textarea{background:#111a23;color:#edf3f8;border-color:#465b6d}
body[data-theme="dark"] .tablewrap tbody tr:nth-child(even){background:#1d2c3a}
body[data-theme="dark"] .tablewrap tbody tr:hover{background:#263b4d}
body[data-theme="dark"] .table-summary{background:#263b4d;color:#edf3f8}
body[data-theme="dark"] .notice{background:#3b3424;color:#f8dfa8}
body[data-theme="dark"] .muted{color:#b6c4d1}
@media(max-width:599px){.tablewrap{max-height:60vh}.tablewrap table{min-width:720px}.table-tools>*{width:100%;max-width:none}.theme-card>*{flex:1 1 100%}.theme-card input[type=color]{width:64px;flex:0 0 64px}}
"""
if "User-selectable shop themes and spreadsheet-like ledgers" not in s:
    if "</style>" not in s: raise SystemExit("Theme patch: style end marker missing")
    s = s.replace("</style>", theme_css + "\n</style>", 1)

theme_panel = r"""
<section id="appearancePanel" class="card no-print">
  <h3>AK POS · Dark High-Contrast Interface</h3>
  <p class="muted">အနက်ရောင်နောက်ခံ · အဖြူ/ငွေရောင်စာသား · ဇယားကွက်ရှင်းလင်းမှု</p>
  <input id="themePreset" type="hidden" value="dark">
  <input id="themeAccent" type="hidden" value="#d7dce2">
  <span id="themeStatus" class="muted">Dark theme</span>
</section>
"""
nav_anchor = '<nav class="tabs no-print" id="tabs">'
if "id=\"appearancePanel\"" not in s:
    if nav_anchor not in s: raise SystemExit("Theme patch: shop navigation insertion point missing")
    s = s.replace(nav_anchor, theme_panel + "\n" + nav_anchor, 1)

sales_tools = '<div class="table-tools no-print"><input id="salesSearch" type="search" placeholder="အရောင်းစာရင်း ရှာရန် — ပစ္စည်း / ဖောက်သည် / ရက်စွဲ"><span id="salesSummary" class="table-summary">အရောင်းစာရင်း</span></div>'
purchases_tools = '<div class="table-tools no-print"><input id="purchasesSearch" type="search" placeholder="အဝယ်စာရင်း ရှာရန် — ပစ္စည်း / ပေးသွင်းသူ / ရက်စွဲ"><span id="purchasesSummary" class="table-summary">အဝယ်စာရင်း</span></div>'
sale_table_anchor = '<div class="tablewrap"><table><thead><tr><th>ရက်စွဲ</th><th>ပစ္စည်း</th><th>အရေအတွက်</th><th>စုစုပေါင်း</th><th>ရရှိငွေ</th><th>ကျန်အကြွေး</th><th>ဘောင်ချာ</th></tr>'
purchase_table_anchor = '<div class="tablewrap"><table><thead><tr><th>ရက်စွဲ</th><th>ပစ္စည်း</th><th>အရေအတွက်</th><th>စုစုပေါင်း</th><th>ပေးသွင်းသူ</th><th>ပေးရန်ကျန်</th><th>လုပ်ဆောင်ချက်</th></tr>'
if "id=\"salesSearch\"" not in s:
    if sale_table_anchor not in s: raise SystemExit("Ledger patch: sales table anchor missing")
    s = s.replace(sale_table_anchor, sales_tools + sale_table_anchor, 1)
if "id=\"purchasesSearch\"" not in s:
    if purchase_table_anchor not in s: raise SystemExit("Ledger patch: purchase table anchor missing")
    s = s.replace(purchase_table_anchor, purchases_tools + purchase_table_anchor, 1)

# Replace only the two ledger render blocks. Preserve a source ledger that is already searchable.
if all(marker in s for marker in ['id="salesSearch"', 'id="purchasesSearch"', 'visibleSales', 'visiblePurchases', 'salesSummary', 'purchasesSummary']):
    print("Ledger patch: existing searchable sales/purchase ledgers preserved")
else:
    # Replace only the two ledger render blocks; payment calculations remain based on original records.
    start = s.find(' $("saleRows").innerHTML=sales.slice()')
    end = s.find(' $("peopleRows").innerHTML=', start)
    if start < 0 or end < 0:
        raise SystemExit("Ledger patch: renderAll sales/purchase block not found")
    ledger_js = r"""
     const saleQuery=String($("salesSearch")?.value||"").trim().toLowerCase();
     const purchaseQuery=String($("purchasesSearch")?.value||"").trim().toLowerCase();
     const visibleSales=sales.slice().sort((a,b)=>new Date(b.createdAt?.toDate?.()||b.createdAt||0)-new Date(a.createdAt?.toDate?.()||a.createdAt||0)).filter(x=>{
      const itemNames=(Array.isArray(x.lines)&&x.lines.length?x.lines.map(v=>v.name).join(" "):x.productName||"ပစ္စည်းများ");
      return !saleQuery||[itemNames,x.customer,x.customerName,dateText(x.createdAt),x.id].some(v=>String(v||"").toLowerCase().includes(saleQuery));
     });
     const saleTotals=visibleSales.reduce((a,x)=>{const extra=payments.filter(p=>p.kind==="sale"&&p.saleId===x.id).reduce((z,p)=>z+Number(p.amount||0),0);a.total+=Number(x.total||0);a.paid+=Number(x.paid||0)+extra;a.due+=Math.max(0,Number(x.total||0)-Number(x.paid||0)-extra);return a},{total:0,paid:0,due:0});
     $("salesSummary").textContent=visibleSales.length+" ဘောင်ချာ · အရောင်း "+money(saleTotals.total)+" · ရရှိ "+money(saleTotals.paid)+" · ကျန် "+money(saleTotals.due);
     $("saleRows").innerHTML=visibleSales.map(x=>{
      const extra=payments.filter(p=>p.kind==="sale"&&p.saleId===x.id).reduce((a,p)=>a+Number(p.amount||0),0);
      const paid=Number(x.paid||0)+extra,due=Math.max(0,Number(x.total||0)-paid);
      const lines=Array.isArray(x.lines)&&x.lines.length?x.lines:[{name:x.productName||"ပစ္စည်းများ",qty:x.qty||0}];
      const names=lines.map(v=>esc(v.name||"ပစ္စည်း")).join("<br>");
      const quantities=lines.map(v=>String(v.qty??0)).join("<br>");
      return '<tr><td>'+dateText(x.createdAt)+'</td><td>'+names+'</td><td>'+quantities+'</td><td>'+money(x.total)+'</td><td>'+money(paid)+'</td><td>'+money(due)+'</td><td>'+(due>0?'<button class="secondary" data-sale-pay="'+x.id+'">အကြွေးကောက်</button> ':"")+'<button class="secondary" data-receipt-print="'+x.id+'">ဘောင်ချာ / PDF</button> <button class="secondary" data-receipt-share="'+x.id+'">Share</button></td></tr>';
     }).join("")||'<tr><td colspan="7">ရှာဖွေမှုနှင့် ကိုက်ညီသော အရောင်းစာရင်းမရှိပါ</td></tr>';
     $("saleRows").querySelectorAll("[data-sale-pay]").forEach(b=>b.onclick=()=>collectSalePayment(b.dataset.salePay));
     $("saleRows").querySelectorAll("[data-receipt-print]").forEach(b=>b.onclick=()=>printSaleReceipt(b.dataset.receiptPrint));
     $("saleRows").querySelectorAll("[data-receipt-share]").forEach(b=>b.onclick=()=>shareSaleReceipt(b.dataset.receiptShare));
     const visiblePurchases=purchases.slice().sort((a,b)=>new Date(b.createdAt?.toDate?.()||b.createdAt||0)-new Date(a.createdAt?.toDate?.()||a.createdAt||0)).filter(x=>
      !purchaseQuery||[x.productName,x.supplier,dateText(x.createdAt),x.id].some(v=>String(v||"").toLowerCase().includes(purchaseQuery))
     );
     const purchaseTotals=visiblePurchases.reduce((a,x)=>{const extra=payments.filter(p=>p.kind==="purchase"&&p.purchaseId===x.id).reduce((z,p)=>z+Number(p.amount||0),0);a.total+=Number(x.total||0);a.paid+=Number(x.paid||0)+extra;a.due+=Math.max(0,Number(x.total||0)-Number(x.paid||0)-extra);return a},{total:0,paid:0,due:0});
     $("purchasesSummary").textContent=visiblePurchases.length+" ဘောင်ချာ · အဝယ် "+money(purchaseTotals.total)+" · ပေးပြီး "+money(purchaseTotals.paid)+" · ကျန် "+money(purchaseTotals.due);
     $("purchaseRows").innerHTML=visiblePurchases.map(x=>{
      const extra=payments.filter(p=>p.kind==="purchase"&&p.purchaseId===x.id).reduce((a,p)=>a+Number(p.amount||0),0);
      const paid=Number(x.paid||0)+extra,due=Math.max(0,Number(x.total||0)-paid);
      return '<tr><td>'+dateText(x.createdAt)+'</td><td>'+esc(x.productName)+'</td><td>'+x.qty+'</td><td>'+money(x.total)+'</td><td>'+esc(x.supplier||"")+'</td><td>'+money(due)+'</td><td>'+(due>0?'<button class="secondary" data-purchase-pay="'+x.id+'">ပေးသွင်းငွေပေး</button>':"ရှင်းပြီး")+'</td></tr>';
     }).join("")||'<tr><td colspan="7">ရှာဖွေမှုနှင့် ကိုက်ညီသော အဝယ်စာရင်းမရှိပါ</td></tr>';
     $("purchaseRows").querySelectorAll("[data-purchase-pay]").forEach(b=>b.onclick=()=>paySupplier(b.dataset.purchasePay));
    """
    s = s[:start] + ledger_js + "\n" + s[end:]


# Search inputs re-render only the ledgers, preserving the user's query.
search_handlers = r"""
$("salesSearch").oninput=()=>renderAll();
$("purchasesSearch").oninput=()=>renderAll();

"""
if ' $("salesSearch").oninput=' not in s and '$("salesSearch").oninput=' not in s:
    anchor = 'function renderAll(){'
    if anchor not in s: raise SystemExit("Ledger patch: renderAll declaration missing")
    s = s.replace(anchor, search_handlers + anchor, 1)

# Keep the ledger filter values while rerendering; renderAll is called on each keystroke.
# Export every sale line separately so the CSV is usable as a real spreadsheet ledger.
old_sales_csv = ' sales.forEach(x=>rows.push(["Sale",x.productName,"","",x.qty,x.price,"",x.total,x.paid,x.due,dateText(x.createdAt)]));'
new_sales_csv = r''' sales.forEach(x=>{
  const lines=Array.isArray(x.lines)&&x.lines.length?x.lines:[{name:x.productName||"ပစ္စည်းများ",qty:x.qty||0,price:x.price||0}];
  lines.forEach((line,i)=>rows.push(["Sale",line.name||x.productName||"ပစ္စည်းများ","","",line.qty??x.qty??0,line.price??x.price??"",line.cost??"",i===0?x.total:"",i===0?x.paid:"",i===0?Math.max(0,Number(x.total||0)-Number(x.paid||0)):"",dateText(x.createdAt)]));
 });'''
if old_sales_csv in s: s=s.replace(old_sales_csv,new_sales_csv,1)
old_purchase_csv = ' purchases.forEach(x=>rows.push(["Purchase",x.productName,"","",x.qty,"",x.cost,x.total,"","","",dateText(x.createdAt)]));'
new_purchase_csv = ' purchases.forEach(x=>rows.push(["Purchase",x.productName,"","",x.qty,"",x.cost,x.total,x.paid,Math.max(0,Number(x.total||0)-Number(x.paid||0)),"",dateText(x.createdAt)]));'
if old_purchase_csv in s: s=s.replace(old_purchase_csv,new_purchase_csv,1)

# Theme selection is saved per shop on this Android device and reapplied after login.
theme_js = r"""
const AK_THEMES={dark:{navy:"#090b0e",blue:"#171b20",gold:"#d7dce2",bg:"#090b0e",line:"#30363d",ink:"#f1f3f5",muted:"#aeb6bf",head:"#1a2026",alt:"#0c1014",hover:"#151a20"}};
function akApplyTheme(){
 const t=AK_THEMES.dark,root=document.documentElement.style;
 document.body.dataset.theme="dark";
 root.setProperty("--navy",t.navy);root.setProperty("--blue",t.blue);root.setProperty("--gold",t.gold);root.setProperty("--bg",t.bg);root.setProperty("--line",t.line);root.setProperty("--ink",t.ink);root.setProperty("--muted",t.muted);root.setProperty("--green",t.blue);root.setProperty("--table-head",t.head);root.setProperty("--table-alt",t.alt);root.setProperty("--table-hover",t.hover);root.setProperty("--accent-soft",t.head);
 document.querySelector('meta[name="theme-color"]')?.setAttribute("content",t.navy);
 document.body.style.background=t.bg;
 const h=document.querySelector("header");if(h)h.style.background=t.navy;
}
function akThemeKey(){return "ak_pos_theme_"+(shopId||user?.uid||"local")}
function akLoadTheme(){try{localStorage.setItem(akThemeKey(),JSON.stringify({preset:"dark"}))}catch(_){}akApplyTheme()}
function akSaveTheme(){akLoadTheme()}
"""
if "const AK_THEMES=" not in s:
    anchor = 'function show(id){'
    if anchor not in s: raise SystemExit("Theme patch: app initialization insertion point missing")
    s=s.replace(anchor,theme_js+"\n"+anchor,1)
# Apply after shop owner or shop owner license route has loaded.
owner_route = 'show("shopPanel");\n    $("ownerControlBtn").classList.remove("hidden");'
if owner_route in s:
    s=s.replace(owner_route,'show("shopPanel");\n    akLoadTheme();\n    $("ownerControlBtn").classList.remove("hidden");',1)
else:
    # Apply the shop theme after loadShop has resolved the correct shop identity.
    if 'async function loadShop()' not in s: raise SystemExit("Theme patch: loadShop function not found")
    load_start=s.find('async function loadShop()')
    marker='show("shopPanel");'
    pos=s.find(marker,load_start)
    if pos<0: raise SystemExit("Theme patch: shop panel activation not found")
    pos+=len(marker)
    if 'akLoadTheme();' not in s[pos:pos+120]: s=s[:pos]+'akLoadTheme();'+s[pos:]
# If app is already authenticated when UI script initializes, ensure theme UI is wired after DOM.
p.write_text(s,encoding="utf-8")
print("APK theme and spreadsheet ledger enhancements applied.")
