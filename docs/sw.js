/* AK Sale Software PWA cache.
   The app shell can open offline; Firebase login and cloud data still require internet. */
const CACHE_NAME = "ak-sale-v24";
const APP_SHELL = [
  "./",
  "./index.html",
  "./global.html",
  "./community.html",
  "./app.html",
  "./pos.html",
  "./firebase-config.js",
  "./download.html",
  "./manifest.webmanifest",
  "./ak-logo.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("ak-sale-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() =>
        caches.match(request).then(cached => cached || caches.match("./index.html"))
      )
    );
    return;
  }

  const isStaticAsset = ["script", "style", "image", "font"].includes(request.destination)
    || /\.(?:js|css|svg|png|webp|jpg|jpeg|woff2?)$/i.test(url.pathname);

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
