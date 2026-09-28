/* eslint-env serviceworker */

const APP_CACHE_PREFIX = "instamusic-code-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clearOwnedCaches().then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/") || event.request.mode === "navigate") {
    return;
  }
});

async function clearOwnedCaches() {
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith(APP_CACHE_PREFIX)).map((name) => caches.delete(name)));
}
