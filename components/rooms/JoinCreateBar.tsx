"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoomQrScanDialog } from "@/components/rooms/RoomQrScanDialog";
import { Input } from "@/components/ui/input";
import { PomodoroCreateFields } from "@/components/rooms/PomodoroCreateFields";
import {
  createPomodoroRoom,
  createRoom,
  joinRoom,
} from "@/features/rooms/api";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function JoinCreateBar({
  authed,
  onNeedAuth,
}: {
  authed: boolean;
  onNeedAuth: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<"lobby" | "name">("lobby");
  const [code, setCode] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [kind, setKind] = useState<"vote" | "pomodoro">("vote");
  const [workMinutes, setWorkMinutes] = useState(50);
  const [breakMinutes, setBreakMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  async function handleCreate() {
    if (!authed) {
      onNeedAuth();
      return;
    }
    const name = sessionName.trim();
    if (!name) {
      toast.error(t("room.toast.nameRequired"));
      return;
    }
    if (name.length > 80) {
      toast.error(t("room.toast.nameTooLong"));
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const room =
        kind === "pomodoro"
          ? await createPomodoroRoom(
              supabase,
              workMinutes,
              breakMinutes,
              name,
            )
          : await createRoom(supabase, name);
      router.push(`/rooms/${room.code}`);
    } catch (err) {
      toast.error(userFacingError(err, t("room.toast.createFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function joinWithCode(raw: string) {
    if (!authed) {
      onNeedAuth();
      return;
    }
    if (!/^\d{6}$/.test(raw)) {
      toast.error(t("room.toast.invalidCode"));
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const room = await joinRoom(supabase, raw);
      router.push(`/rooms/${room.code}`);
    } catch (err) {
      const msg = userFacingError(err, t("room.toast.joinFailed"));
      if (/room_full/i.test(err instanceof Error ? err.message : msg)) {
        toast.error(t("room.toast.roomFull"));
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    await joinWithCode(code);
  }

  if (step === "name") {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="font-display text-base font-bold text-foreground">
            {t("room.nameSession")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("room.nameSessionDesc")}
          </p>
        </div>
        <Input
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value.slice(0, 80))}
          placeholder={t("timer.sessionNamePlaceholder")}
          maxLength={80}
          autoFocus
        />
        <PomodoroCreateFields
          kind={kind}
          onKindChange={setKind}
          workMinutes={workMinutes}
          breakMinutes={breakMinutes}
          onWorkChange={setWorkMinutes}
          onBreakChange={setBreakMinutes}
        />
        <div className="flex flex-col gap-2">
          <Button className="w-full rounded-xl" disabled={busy} onClick={handleCreate}>
            {t("room.enter")}
          </Button>
          <Button
            className="w-full rounded-xl"
            variant="outline"
            disabled={busy}
            onClick={() => setStep("lobby")}
          >
            {t("settings.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(digitsOnly(e.target.value))}
            placeholder={t("room.codePlaceholder")}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl font-mono tabular-nums tracking-[0.2em]"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleJoin();
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0 rounded-xl px-3"
            disabled={busy}
            aria-label={t("room.scanTitle")}
            onClick={() => {
              if (!authed) {
                onNeedAuth();
                return;
              }
              setScanOpen(true);
            }}
          >
            <ScanLine className="h-4 w-4" />
          </Button>
        </div>
        <Button
          className="w-full rounded-xl"
          disabled={busy}
          onClick={() => void handleJoin()}
          variant="outline"
        >
          {t("room.joinShort")}
        </Button>
      </div>
      <RoomQrScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onCode={(scanned) => {
          setCode(scanned);
          void joinWithCode(scanned);
        }}
      />

      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <span className="h-px flex-1 bg-slate-200" />
        {t("common.or")}
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <Button
        className="w-full rounded-xl"
        disabled={busy}
        onClick={() => {
          if (!authed) {
            onNeedAuth();
            return;
          }
          setStep("name");
        }}
      >
        {t("room.create")}
      </Button>
    </div>
  );
}
