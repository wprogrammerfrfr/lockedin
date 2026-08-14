/* LockedIn service worker — app shell cache; never cache Supabase auth. */
const CACHE = "lockedin-shell-v2";
const SHELL = ["/", "/manifest.webmanifest"];

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

  if (
    url.hostname.includes("supabase") ||
    url.pathname.includes("/auth/") ||
    url.pathname.startsWith("/api/")
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
