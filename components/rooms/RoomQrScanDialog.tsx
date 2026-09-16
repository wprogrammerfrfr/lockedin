"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImageIcon, QrCode, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseRoomCodeFromPayload } from "@/features/rooms/parse-room-invite";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue?: string }[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

function RoomQrScanOverlay({
  onClose,
  onCode,
}: {
  onClose: () => void;
  onCode: (code: string) => void;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cameraError, setCameraError] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const handlePayload = useCallback(
    (payload: string) => {
      const code = parseRoomCodeFromPayload(payload);
      if (!code) return false;
      stopCamera();
      onClose();
      onCode(code);
      return true;
    },
    [onCode, onClose, stopCamera],
  );

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const Detector = window.BarcodeDetector;
        let detector: BarcodeDetectorLike | null = null;
        if (Detector) {
          try {
            detector = new Detector({ formats: ["qr_code"] });
          } catch {
            detector = null;
          }
        }

        let jsQr: typeof import("jsqr") | null = null;
        if (!detector) {
          jsQr = await import("jsqr");
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const tick = async () => {
          if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
            rafRef.current = requestAnimationFrame(() => void tick());
            return;
          }
          const v = videoRef.current;
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          if (ctx && canvas.width > 0 && canvas.height > 0) {
            ctx.drawImage(v, 0, 0);
            if (detector) {
              try {
                const codes = await detector.detect(v);
                for (const c of codes) {
                  if (c.rawValue && handlePayload(c.rawValue)) return;
                }
              } catch {
                /* frame skip */
              }
            } else if (jsQr) {
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const found = jsQr.default(image.data, canvas.width, canvas.height);
              if (found?.data && handlePayload(found.data)) return;
            }
          }
          rafRef.current = requestAnimationFrame(() => void tick());
        };

        rafRef.current = requestAnimationFrame(() => void tick());
      } catch {
        if (!cancelled) setCameraError(true);
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [handlePayload, stopCamera]);

  async function onFileChange(file: File | null) {
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const Detector = window.BarcodeDetector;
      if (Detector) {
        const detector = new Detector({ formats: ["qr_code"] });
        const codes = await detector.detect(bitmap);
        for (const c of codes) {
          if (c.rawValue && handlePayload(c.rawValue)) return;
        }
      }
      const jsQr = await import("jsqr");
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQr.default(image.data, canvas.width, canvas.height);
      if (found?.data && handlePayload(found.data)) return;
      toast.error(t("room.toast.qrNotFound"));
    } catch {
      toast.error(t("room.toast.qrNotFound"));
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <QrCode className="h-5 w-5 text-emerald-400" />
          {t("room.scanTitle")}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-xl text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative mx-4 flex flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10">
        {!cameraError ? (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              playsInline
              muted
            />
            <div
              className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_24px_rgba(52,211,153,0.35)]"
              aria-hidden
            />
          </>
        ) : (
          <p className="max-w-xs px-6 text-center text-sm text-zinc-400">
            {t("room.scanCameraDenied")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 p-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            void onFileChange(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full rounded-xl border-white/10 bg-zinc-900 text-white",
          )}
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          {t("room.scanFromPhoto")}
        </Button>
      </div>
    </motion.div>
  );
}

export function RoomQrScanDialog({
  open,
  onOpenChange,
  onCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCode: (code: string) => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <RoomQrScanOverlay
          onClose={() => onOpenChange(false)}
          onCode={onCode}
        />
      ) : null}
    </AnimatePresence>
  );
}
