"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Dev: kill any leftover SW/caches from a prior production run so Turbopack
    // modules are never served stale (IceCreamBowl "module factory" crashes).
    if (process.env.NODE_ENV !== "production") {
      void (async () => {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((k) => k.startsWith("lockedin-shell"))
              .map((k) => caches.delete(k)),
          );
        }
      })();
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return null;
}
