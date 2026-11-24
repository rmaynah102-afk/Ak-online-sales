// AK V2 Barcode Label / Sticker Printer. Uses the current V2 products collection.
(()=>{
 const code39={"0":"nnnwwnwnn","1":"wnnwnnnnw","2":"nnwwnnnnw","3":"wnwwnnnnn","4":"nnnwwnnnw","5":"wnnwwnnnn","6":"nnwwwnnnn","7":"nnnwnnwnw","8":"wnnwnnwnn","9":"nnwwnnwnn","A":"wnnnnwnnw","B":"nnwnnwnnw","C":"wnwnnwnnn","D":"nnnnwwnnw","E":"wnnnwwnnn","F":"nnwnwwnnn","G":"nnnnnwwnw","H":"wnnnnwwnn","I":"nnwnnwwnn","J":"nnnnwwwnn","K":"wnnnnnnww","L":"nnwnnnnww","M":"wnwnnnnwn","N":"nnnnwnnww","O":"wnnnwnnwn","P":"nnwnwnnwn","Q":"nnnnnnwww","R":"wnnnnnwwn","S":"nnwnnnwwn","T":"nnnnwnwwn","U":"wwnnnnnnw","V":"nwwnnnnnw","W":"wwwnnnnnn","X":"nwnnwnnnw","Y":"wwnnwnnnn","Z":"nwwnwnnnn","-":"nwnnnnwnw",".":"wwnnnnwnn"," ":"nwwnnnwnn","$":"nwnwnwnnn","/":"nwnwnnnwn","+":"nwnnnwnwn","%":"nnnwnwnwn"};
 function code39Svg(value){
  const raw=String(value||"").toUpperCase();
  if(!raw||raw.length>32||![...raw].every(c=>code39[c]))return "";
  const chars="*"+raw+"*";let x=2,rects="";
  for(let ci=0;ci<chars.length;ci++){const pat=code39[chars[ci]];for(let k=0;k<9;k++){const w=pat[k]==="w"?3:1;if(k%2===0)rects+='<rect x="'+x+'" y="0" width="'+w+'" height="36" fill="#000"/>';x+=w}x+=1}
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(x+1)+' 36" preserveAspectRatio="xMidYMid meet">'+rects+'</svg>';
 }
 window.akRefreshV2LabelProducts=function(){
  const sel=document.getElementById("akV2LabelProduct");if(!sel)return;
  const old=sel.value;
  sel.innerHTML='<option value="">ပစ္စည်းရွေးပါ</option>'+((Array.isArray(products)?products:[]).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.sku||p.barcode||"No barcode")+'</option>').join(""));
  if(old)sel.value=old;
 };
 window.akPrintV2Labels=function(){
  const status=document.getElementById("akV2LabelStatus");
  const id=document.getElementById("akV2LabelProduct")?.value;
  const p=(Array.isArray(products)?products:[]).find(x=>String(x.id)===String(id));
  const copies=Number(document.getElementById("akV2LabelCopies")?.value||1);
  const size=document.getElementById("akV2LabelSize")?.value||"30x20";
  const columns=Number(document.getElementById("akV2LabelColumns")?.value||1);
  const gap=Math.max(0,Math.min(10,Number(document.getElementById("akV2LabelGap")?.value||0)));
  const ox=Math.max(-20,Math.min(20,Number(document.getElementById("akV2LabelOffsetX")?.value||0)));
  const oy=Math.max(-20,Math.min(20,Number(document.getElementById("akV2LabelOffsetY")?.value||0)));
  if(!p){alert("ပစ္စည်းရွေးပါ");return}
  if(!Number.isInteger(copies)||copies<1||copies>300){alert("Sticker အရေအတွက် 1 မှ 300 အတွင်း ထည့်ပါ");return}
  if(!Number.isInteger(columns)||columns<1||columns>3){alert("ကော်လံ 1 မှ 3 အတွင်း ရွေးပါ");return}
  const code=String(p.sku||p.barcode||"").trim(),barcode=code39Svg(code);
  if(!barcode){alert("SKU / Barcode မရှိပါ သို့မဟုတ် Code 39 မထောက်ပံ့သော ကုဒ်ဖြစ်သည်။ A-Z၊ 0-9၊ - . space $ / + % ကို သုံးပါ။");return}
  const [w,h]=size.split("x").map(Number);
  const show=id=>document.getElementById(id)?.checked;
  const align=document.getElementById("akV2LabelAlign")?.value||"center";
  const name=show("akV2LabelShowName")?'<div class="nm">'+esc(p.name)+'</div>':"";
  const price=show("akV2LabelShowPrice")?'<div class="pr">'+esc(money(p.retail||0))+'</div>':"";
  const digits=show("akV2LabelShowCode")?'<div class="digits">'+esc(code)+'</div>':"";
  const cell='<article class="label">'+name+price+'<div class="bars">'+barcode+'</div>'+digits+'</article>';
  const items=Array.from({length:copies},()=>cell).join("");
  const win=window.open("","_blank");
  if(!win){alert("Print Window မဖွင့်နိုင်ပါ။ Browser / App Pop-up ခွင့်ပြုပါ");return}
  win.document.open();
  win.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AK Barcode Labels</title><style>*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#000}.sheet{display:grid;grid-template-columns:repeat('+columns+', '+w+'mm);grid-auto-rows:'+h+'mm;column-gap:'+gap+'mm;row-gap:'+gap+'mm;transform:translate('+ox+'mm,'+oy+'mm);padding:0}.label{width:'+w+'mm;height:'+h+'mm;overflow:hidden;display:flex;flex-direction:column;justify-content:center;align-items:'+(align==="left"?"flex-start":align==="right"?"flex-end":"center")+';text-align:'+align+';padding:1mm;font-size:'+(w<=30?"6":"8")+'pt;line-height:1.05}.nm{font-weight:bold;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.pr{font-weight:bold}.bars{width:92%;height:'+(h>=30?"12":"8")+'mm}.bars svg{width:100%;height:100%}.digits{font-size:6pt;letter-spacing:.5px}@page{size:auto;margin:0}@media screen{body{padding:10px;background:#eee}.sheet{background:#fff;max-width:max-content;margin:auto}}@media print{.sheet{break-after:auto}}</style></head><body><main class="sheet">'+items+'</main></body></html>');
  win.document.close();
  if(status)status.textContent=copies+" ခု Label Print စာမျက်နှာ ပြင်ဆင်ပြီးပါပြီ။ Print dialog မှ Label Printer နှင့် စာရွက်အရွယ်အစားကို ရွေးပါ။ Printer ၏ paper gap/size ကို စမ်းညှိပါ။";
  setTimeout(()=>{try{win.focus();win.print()}catch(e){if(status)status.textContent="Print မစနိုင်ပါ: "+(e.message||e)}},500);
 };
})();