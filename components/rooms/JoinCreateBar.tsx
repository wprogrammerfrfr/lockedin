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

export function JoinCreateBar({
  authed,
  onNeedAuth,
}: {
  authed: boolean;
  onNeedAuth: () => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"vote" | "pomodoro">("vote");
  const [workMinutes, setWorkMinutes] = useState(50);
  const [breakMinutes, setBreakMinutes] = useState(10);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!authed) {
      onNeedAuth();
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const room =
        kind === "pomodoro"
          ? await createPomodoroRoom(supabase, workMinutes, breakMinutes)
          : await createRoom(supabase);
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
    if (!code.trim()) {
      toast.error("Enter a room code");
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

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Join code"
          maxLength={8}
          className="rounded-xl font-mono uppercase"
        />
        <Button
          className="rounded-xl"
          disabled={busy}
          onClick={handleJoin}
          variant="outline"
        >
          Join
        </Button>
        <Button className="rounded-xl" disabled={busy} onClick={handleCreate}>
          Create room
        </Button>
      </div>
      <PomodoroCreateFields
        kind={kind}
        onKindChange={setKind}
        workMinutes={workMinutes}
        breakMinutes={breakMinutes}
        onWorkChange={setWorkMinutes}
        onBreakChange={setBreakMinutes}
      />
    </div>
  );
}
