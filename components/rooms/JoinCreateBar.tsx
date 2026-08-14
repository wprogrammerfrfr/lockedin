"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PomodoroCreateFields } from "@/components/rooms/PomodoroCreateFields";
import {
  createPomodoroRoom,
  createRoom,
  joinRoom,
} from "@/features/rooms/api";
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
  const router = useRouter();
  const [step, setStep] = useState<"lobby" | "name">("lobby");
  const [code, setCode] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [kind, setKind] = useState<"vote" | "pomodoro">("vote");
  const [workMinutes, setWorkMinutes] = useState(50);
  const [breakMinutes, setBreakMinutes] = useState(10);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!authed) {
      onNeedAuth();
      return;
    }
    const name = sessionName.trim();
    if (!name) {
      toast.error("Give this session a name first.");
      return;
    }
    if (name.length > 80) {
      toast.error("Session name must be 80 characters or fewer.");
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
      toast.error(userFacingError(err, "Could not create room"));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!authed) {
      onNeedAuth();
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter a 6-digit room code");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const room = await joinRoom(supabase, code);
      router.push(`/rooms/${room.code}`);
    } catch (err) {
      const msg = userFacingError(err, "Could not join");
      if (/room_full/i.test(err instanceof Error ? err.message : msg)) {
        toast.error("Room is full (max 6)");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  if (step === "name") {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <p className="font-display text-base font-bold text-slate-900">
            Name this session
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Required. This title shows in the room and on your dashboard.
          </p>
        </div>
        <Input
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value.slice(0, 80))}
          placeholder="e.g. CS midterm grind"
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
            Enter room
          </Button>
          <Button
            className="w-full rounded-xl"
            variant="outline"
            disabled={busy}
            onClick={() => setStep("lobby")}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(digitsOnly(e.target.value))}
          placeholder="6-digit code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="off"
          className="rounded-xl font-mono tabular-nums tracking-[0.2em]"
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleJoin();
          }}
        />
        <Button
          className="w-full rounded-xl"
          disabled={busy}
          onClick={handleJoin}
          variant="outline"
        >
          Join
        </Button>
      </div>

      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
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
        Create room
      </Button>
    </div>
  );
}
