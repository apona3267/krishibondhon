/* কৃষিবন্ধন (KRISHIBONDHON) — PWA Service Worker v1.0 */
const CACHE_NAME = "krishibondhon-pwa-v1";
const OFFLINE_URL = "./offline.html";

const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./privacy-policy.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

// External dynamic APIs that must ALWAYS bypass the Service Worker cache
const BYPASS_HOST_PATTERNS = [
  "firestore.googleapis.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "firebaseinstallations.googleapis.com",
  "firebaseio.com",
  "firebasestorage.googleapis.com",
  "api.cloudinary.com"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Only handle http/https requests
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Never intercept Firebase Auth, Firestore realtime listeners, or Cloudinary uploads
  if (BYPASS_HOST_PATTERNS.some((host) => url.hostname.includes(host))) {
    return;
  }

  // Page navigations: Network-First so GitHub updates appear immediately, Offline fallback if disconnected
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok && url.origin === self.location.origin) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Same-origin static assets (icons, manifest, html): Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});
