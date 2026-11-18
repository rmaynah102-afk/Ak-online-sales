const CACHE="ak-sale-pos-offline-v1";
const CORE=["./","./index.html","./manifest.webmanifest","./icon.svg","../firebase-config.js"];
const FIREBASE=[
 "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
 "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
 "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"
];
self.addEventListener("install",event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(CORE);
 // Cache Firebase runtime scripts while online so the app can initialize on later offline launches.
 await Promise.all(FIREBASE.map(async url=>{try{const response=await fetch(url,{mode:"no-cors"});if(response.ok||response.type==="opaque")await cache.put(url,response)}catch(_){}}));
 await self.skipWaiting();
})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
 const keys=await caches.keys();await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
 await self.clients.claim();
})()));
self.addEventListener("fetch",event=>{
 const request=event.request;if(request.method!=="GET")return;
 const url=new URL(request.url),sameOrigin=url.origin===self.location.origin;
 const firebaseScript=request.destination==="script"&&url.hostname==="www.gstatic.com"&&url.pathname.startsWith("/firebasejs/10.12.2/");
 if(!sameOrigin&&!firebaseScript)return;
 event.respondWith((async()=>{
  try{
   const response=await fetch(request);
   if(response.ok||response.type==="opaque"){const cache=await caches.open(CACHE);cache.put(request,response.clone()).catch(()=>{});}
   return response;
  }catch(error){
   const cached=await caches.match(request);if(cached)return cached;
   if(sameOrigin){const shell=await caches.match("./index.html");if(shell&&request.mode==="navigate")return shell;}
   throw error;
  }
 })());
});