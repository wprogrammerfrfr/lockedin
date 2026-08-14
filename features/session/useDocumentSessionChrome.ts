"use client";

import { useEffect, useRef } from "react";
import type { SessionState } from "@/features/session/types";
import { formatMs } from "@/features/session/format";

const DEFAULT_TITLE = "LockedIn — Focus Tracking for Students";

function faviconColor(session: SessionState): string {
  switch (session) {
    case "LOCKED_IN":
      return "#84cc16";
    case "ON_BREAK":
    case "CHOOSING_BREAK":
    case "BREAK_DONE":
      return "#f59e0b";
    case "TAPPED_OUT":
      return "#a8a3b5";
    default:
      return "#94a3b8";
  }
}

function ensureFaviconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>("link[data-lockedin-favicon]");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-lockedin-favicon", "1");
    document.head.appendChild(link);
  }
  return link;
}

function paintFavicon(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  // rounded rect — no circle for main UI; favicon is a tiny chrome exception
  const r = 6;
  ctx.moveTo(r, 0);
  ctx.arcTo(32, 0, 32, 32, r);
  ctx.arcTo(32, 32, 0, 32, r);
  ctx.arcTo(0, 32, 0, 0, r);
  ctx.arcTo(0, 0, 32, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("LI", 16, 17);
  ensureFaviconLink().href = canvas.toDataURL("image/png");
}

export function useDocumentSessionChrome(
  session: SessionState,
  elapsedMs: number,
  breakRemainingMs: number,
) {
  const lastTitleRef = useRef("");
  const elapsedRef = useRef(elapsedMs);
  const breakRef = useRef(breakRemainingMs);
  elapsedRef.current = elapsedMs;
  breakRef.current = breakRemainingMs;

  useEffect(() => {
    paintFavicon(faviconColor(session));
  }, [session]);

  useEffect(() => {
    const apply = () => {
      let title = DEFAULT_TITLE;
      if (session === "LOCKED_IN") {
        title = `[ ${formatMs(elapsedRef.current, true)} ] Locked In`;
      } else if (
        session === "ON_BREAK" ||
        session === "CHOOSING_BREAK" ||
        session === "BREAK_DONE"
      ) {
        title = `[ ${formatMs(breakRef.current || elapsedRef.current, true)} ] Break`;
      } else if (session === "TAPPED_OUT") {
        title = `[ ${formatMs(elapsedRef.current, true)} ] Tapped Out`;
      }
      if (title !== lastTitleRef.current) {
        document.title = title;
        lastTitleRef.current = title;
      }
    };

    apply();
    const id = window.setInterval(apply, 1000);
    return () => {
      window.clearInterval(id);
      document.title = DEFAULT_TITLE;
      lastTitleRef.current = "";
    };
  }, [session]);
}
