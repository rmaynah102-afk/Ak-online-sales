'use strict';
const fs=require('fs'),path=require('path'),sharp=require('sharp');
(async()=>{
 const root=path.join(__dirname,'..'),source=path.join(root,'ak-logo.svg'),res=path.join(root,'android/app/src/main/res');
 const densities={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
 for(const [density,size] of Object.entries(densities)){
  const dir=path.join(res,'mipmap-'+density);fs.mkdirSync(dir,{recursive:true});
  await sharp(source).resize(size,size).png().toFile(path.join(dir,'ic_launcher.png'));
  await sharp(source).resize(size,size).png().toFile(path.join(dir,'ic_launcher_round.png'));
  await sharp(source).resize(Math.round(size*1.5),Math.round(size*1.5),{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(path.join(dir,'ic_launcher_foreground.png'));
 }
 const any=path.join(res,'mipmap-anydpi-v26');fs.mkdirSync(any,{recursive:true});
 const xml='<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>\n';
 fs.writeFileSync(path.join(any,'ic_launcher.xml'),xml);fs.writeFileSync(path.join(any,'ic_launcher_round.xml'),xml);
 const values=path.join(res,'values');fs.mkdirSync(values,{recursive:true});const cp=path.join(values,'colors.xml');
 let colors=fs.existsSync(cp)?fs.readFileSync(cp,'utf8'):'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n';
 // Capacitor already creates ic_launcher_background.xml. Do not define the same resource twice.
 colors=colors.replace(/<color\s+name="ic_launcher_background">[\s\S]*?<\/color>\s*/g,'');
 fs.writeFileSync(cp,colors);console.log('AK Sale Android launcher icons generated.');
})().catch(e=>{console.error(e);process.exit(1)});
