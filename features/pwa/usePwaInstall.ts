"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  iosInstallSurface,
  type IosInstallSurface,
} from "@/features/pwa/ios-install";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return media || ios;
}

function readIosSurface(): IosInstallSurface | null {
  if (typeof navigator === "undefined") return null;
  if (isStandaloneDisplay()) return null;
  return iosInstallSurface(
    navigator.userAgent,
    navigator.platform,
    navigator.maxTouchPoints,
  );
}

function subscribeStandalone(onStoreChange: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", onStoreChange);
  window.addEventListener("appinstalled", onStoreChange);
  return () => {
    mq.removeEventListener("change", onStoreChange);
    window.removeEventListener("appinstalled", onStoreChange);
  };
}

function subscribeNoop() {
  return () => undefined;
}

export function usePwaInstall() {
  const installed = useSyncExternalStore(
    subscribeStandalone,
    isStandaloneDisplay,
    () => false,
  );
  const iosSurface = useSyncExternalStore(
    subscribeNoop,
    readIosSurface,
    () => null,
  );

  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome === "accepted";
  }, [deferred]);

  return {
    installed,
    canInstall: Boolean(deferred) && !installed,
    isIos: iosSurface !== null && !installed,
    iosSurface: installed ? null : iosSurface,
    promptInstall,
  };
}
