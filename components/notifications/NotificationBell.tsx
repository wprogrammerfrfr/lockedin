"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationList } from "@/components/notifications/NotificationList";
import { useNotifications } from "@/features/notifications/useNotifications";
import { cn } from "@/lib/utils";

const GAP_PX = 8;
const MARGIN_PX = 8;
const PANEL_WIDTH_PX = 18 * 16;
const PANEL_MAX_HEIGHT_PX = 20 * 16;

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function panelStyleFor(
  rect: DOMRect,
  align: "sidebar" | "header",
): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(PANEL_WIDTH_PX, vw - MARGIN_PX * 2);
  const left = clamp(rect.right - width, MARGIN_PX, vw - width - MARGIN_PX);

  if (align === "header") {
    const top = rect.bottom + GAP_PX;
    const available = vh - top - MARGIN_PX;
    return {
      top,
      left,
      width,
      maxHeight: Math.max(120, Math.min(PANEL_MAX_HEIGHT_PX, available)),
    };
  }

  const bottom = vh - rect.top + GAP_PX;
  const available = rect.top - GAP_PX - MARGIN_PX;
  return {
    bottom,
    left: clamp(rect.left, MARGIN_PX, vw - width - MARGIN_PX),
    width,
    maxHeight: Math.max(120, Math.min(PANEL_MAX_HEIGHT_PX, available)),
  };
}

export function NotificationBell({
  enabled = true,
  menuAlign = "sidebar",
}: {
  enabled?: boolean;
  menuAlign?: "sidebar" | "header";
}) {
  const { items, unread, markRead, markAll } = useNotifications(enabled);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    setPanelStyle(panelStyleFor(el.getBoundingClientRect(), menuAlign));
  }, [menuAlign]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative rounded-xl"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-slate-500" />
        {unread > 0 && (
          <span
            className={cn(
              "absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-lime-500",
            )}
          />
        )}
      </Button>
      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            className="fixed z-[100] overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-soft"
            style={panelStyle}
          >
            <NotificationList
              items={items}
              onMarkRead={markRead}
              onMarkAll={markAll}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
