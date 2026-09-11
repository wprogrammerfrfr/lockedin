/* LockedIn service worker — app shell cache; never cache Supabase auth. */
const CACHE = "lockedin-shell-v5";
const SHELL = [
  "/",
  "/lockin",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Cross-origin images (including OAuth avatars) must stay under the
  // browser's normal image-loading rules. Safari PWA fetch interception can
  // otherwise turn opaque no-cors responses into failed requests.
  if (url.origin !== self.location.origin) return;

  if (
    url.hostname.includes("supabase") ||
    url.pathname.includes("/auth/") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Never intercept Next/Turbopack bundles — cache-first here causes
  // "module factory is not available" after HMR / rebuilds.
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.includes("hot-update")
  ) {
    return;
  }

  if (event.request.method !== "GET") return;

  const isDocument =
    event.request.mode === "navigate" ||
    (event.request.headers.get("accept") || "").includes("text/html");

  const networkFirst =
    isDocument ||
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/rooms") ||
    url.pathname.startsWith("/explore");

  if (networkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          if (res.ok && url.origin === self.location.origin) {
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(event.request).then((c) => c || caches.match("/")),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          if (res.ok && url.origin === self.location.origin) {
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    }),
  );
});
