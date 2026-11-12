(function(){
"use strict";
const MAX=60,events=[],seen=new Set();
const safeText=value=>String(value||"").replace(/(?:AIza[0-9A-Za-z_-]{30,}|[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,})/g,"[redacted]").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[email]").slice(0,220);
function add(level,module,message){
 const item={time:new Date().toISOString(),level,module,message:safeText(message)};
 const key=item.level+"|"+item.module+"|"+item.message;
 if(seen.has(key))return;seen.add(key);events.unshift(item);if(events.length>MAX){const gone=events.pop();seen.delete(gone.level+"|"+gone.module+"|"+gone.message)}
 render();
}
window.addEventListener("error",e=>add("error","JavaScript",e.message||"Application error"));
window.addEventListener("unhandledrejection",e=>add("error","Async task",e.reason?.message||"Unhandled asynchronous error"));
window.addEventListener("offline",()=>add("warning","Network","Internet connection lost"));
window.addEventListener("online",()=>add("info","Network","Internet connection restored"));
window.addEventListener("ak:sync-error",e=>add("error","Cloud Sync",e.detail?.message||"Cloud sync failed"));
window.addEventListener("ak:sync-success",()=>add("info","Cloud Sync","Cloud sync completed"));
window.addEventListener("ak:printer-error",e=>add("warning","Printer",e.detail?.message||"Printer operation failed"));
window.addEventListener("ak:printer-success",()=>add("info","Printer","Printer operation completed"));
function status(){
 const online=navigator.onLine;
 const conn=document.getElementById("akConnectionStatus")?.textContent||"Connection status unavailable";
 const fb=document.getElementById("fbStatus")?.textContent||"Cloud status not reported";
 const printer=window.akPrinterBridge||window.AKPrinterBridge;
 const printerText=document.getElementById("akPrinterStatus")?.textContent||"Printer status not reported";
 return {online,conn:safeText(conn),fb:safeText(fb),printer:printer?safeText(printerText):safeText(printerText)};
}
function issues(){
 const s=status(),list=[];
 if(!s.online)list.push(["error","Internet","Offline ဖြစ်နေသည်","Internet ပြန်ချိတ်ပြီး Sync Now ကိုနှိပ်ပါ"]);
 if(/ပြတ်တောက်|မအောင်မြင်|failed|error|conflict|မရပါ/i.test(s.fb))list.push(["warning","Cloud Sync",s.fb,"Network နှင့် Login သက်တမ်းစစ်ပြီး Sync Now ကိုနှိပ်ပါ"]);
 if(/printer.*fail|print.*error|ပရင်တာ.*မရ|မချိတ်နိုင်|အမှား/i.test(s.printer))list.push(["warning","Printer",s.printer,"Android Print Service၊ Bluetooth/Wi-Fi ချိတ်ဆက်မှုနှင့် printer permission စစ်ပါ"]);
 for(const e of events.slice(0,12))if(e.level==="error")list.push(["error",e.module,e.message,"အက်ပ်ကို မပိတ်ခင် Backup လုပ်ပြီး အမှားအချက်အလက်ကို Owner ထံပြပါ"]);
 return list.slice(0,30);
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function ensureView(){
 let view=document.getElementById("aiMonitor");if(view)return view;
 const main=document.querySelector("main");if(!main)return null;
 view=document.createElement("section");view.id="aiMonitor";view.className="view";
 view.innerHTML='<div class="panel"><h2>AI စနစ်စောင့်ကြည့်ရေး</h2><p class="ak-health-muted">စက်တွင်း Diagnostics · အမှားရှာဖွေမှုနှင့် အကြံပြုချက်များ။ လက်ရှိဗားရှင်းတွင် Generative AI Server မချိတ်ထားပါ။</p><div id="akHealthKpis" class="ak-health-grid"></div><div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" id="akHealthRefresh">ပြန်စစ်ရန်</button><button type="button" id="akHealthSync">Cloud Sync Now</button><button type="button" id="akHealthExport">Diagnostics CSV ထုတ်ရန်</button></div><h3>တွေ့ရှိထားသော ပြဿနာများ</h3><div class="tablewrap"><table class="ak-health-table"><thead><tr><th>အဆင့်</th><th>အချိန်</th><th>စနစ်</th><th>အခြေအနေ</th><th>အကြံပြုချက်</th></tr></thead><tbody id="akHealthIssues"></tbody></table></div><h3>မှတ်တမ်း</h3><div class="tablewrap"><table class="ak-health-table"><thead><tr><th>အချိန်</th><th>အဆင့်</th><th>နေရာ</th><th>အသေးစိတ်</th></tr></thead><tbody id="akHealthEvents"></tbody></table></div><p class="ak-health-muted">လုံခြုံရေးကန့်သတ်ချက်: ဒီမော်နီတာသည် ငွေစာရင်း၊ ကုန်ပစ္စည်း၊ လိုင်စင်၊ Role သို့မဟုတ် Security Rules ကို အလိုအလျောက်မပြင်ပါ။ Password၊ Token နှင့် ငွေစာရင်းအသေးစိတ်များကို မစုဆောင်းပါ။</p></div>';
 const home=document.getElementById("home");main.insertBefore(view,home||main.firstChild);
 document.getElementById("akHealthRefresh").addEventListener("click",render);
 document.getElementById("akHealthSync").addEventListener("click",()=>{if(typeof window.akSyncNow==="function"){window.akSyncNow();add("info","Cloud Sync","Manual sync requested")}else add("warning","Cloud Sync","Sync action is not available in this session")});
 document.getElementById("akHealthExport").addEventListener("click",exportCsv);
 return view;
}
function render(){
 const view=ensureView();if(!view)return;
 const s=status(),list=issues(),errorCount=list.filter(x=>x[0]==="error").length,warnCount=list.filter(x=>x[0]==="warning").length;
 const k=document.getElementById("akHealthKpis");if(k)k.innerHTML='<div class="ak-health-kpi"><span>Internet</span><strong>'+ (s.online?"Online":"Offline")+'</strong></div><div class="ak-health-kpi"><span>ပြဿနာ</span><strong>'+list.length+'</strong></div><div class="ak-health-kpi"><span>အရေးကြီး</span><strong>'+errorCount+'</strong></div><div class="ak-health-kpi"><span>သတိပေး</span><strong>'+warnCount+'</strong></div>';
 const tbody=document.getElementById("akHealthIssues");if(tbody)tbody.innerHTML=list.length?list.map(i=>'<tr><td><span class="ak-health-pill '+(i[0]==="error"?"ak-health-bad":"ak-health-warn")+'">'+(i[0]==="error"?"အရေးကြီး":"သတိပေး")+'</span></td><td>'+esc(new Date().toLocaleString())+'</td><td>'+esc(i[1])+'</td><td>'+esc(i[2])+'</td><td>'+esc(i[3])+'</td></tr>').join(""):'<tr><td colspan="5"><span class="ak-health-pill ak-health-ok">အဆင်ပြေ</span> လက်ရှိစစ်ဆေးမှုတွင် အမှားမတွေ့ပါ။</td></tr>';
 const ev=document.getElementById("akHealthEvents");if(ev)ev.innerHTML=events.length?events.map(e=>'<tr><td>'+esc(new Date(e.time).toLocaleString())+'</td><td>'+esc(e.level)+'</td><td>'+esc(e.module)+'</td><td>'+esc(e.message)+'</td></tr>').join(""):'<tr><td colspan="4">မှတ်တမ်းမရှိသေးပါ။</td></tr>';
}
function exportCsv(){
 const rows=[["time","level","module","message"],...events.map(e=>[e.time,e.level,e.module,e.message])];
 const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\r\n");
 const a=document.createElement("a"),url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));a.href=url;a.download="ak-diagnostics.csv";a.click();URL.revokeObjectURL(url);
}
window.AKHealthMonitor={add,render,status,issues,snapshot:()=>events.map(e=>({...e}))};
document.addEventListener("DOMContentLoaded",()=>{ensureView();render();
 const cloud=document.getElementById("fbStatus"),printer=document.getElementById("akPrinterStatus");
 if(typeof MutationObserver!=="undefined") [cloud,printer].filter(Boolean).forEach(node=>new MutationObserver(()=>render()).observe(node,{childList:true,subtree:true,characterData:true}));
});
setTimeout(()=>{ensureView();render()},0);
setInterval(()=>{if(document.getElementById("aiMonitor")?.classList.contains("active"))render()},15000);
})();