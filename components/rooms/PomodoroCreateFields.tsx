"use client";

import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

const PRESETS = [
  { work: 50, break: 10, label: "50 / 10" },
  { work: 25, break: 5, label: "25 / 5" },
  { work: 45, break: 15, label: "45 / 15" },
];

export function PomodoroCreateFields({
  kind,
  onKindChange,
  workMinutes,
  breakMinutes,
  onWorkChange,
  onBreakChange,
}: {
  kind: "vote" | "pomodoro";
  onKindChange: (k: "vote" | "pomodoro") => void;
  workMinutes: number;
  breakMinutes: number;
  onWorkChange: (n: number) => void;
  onBreakChange: (n: number) => void;
}) {
  const { t } = useTranslation();

  const kindOptions = [
    ["vote", t("room.voteRoom")] as const,
    ["pomodoro", t("room.pomodoro")] as const,
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {kindOptions.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onKindChange(id)}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              kind === id
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-border bg-card text-muted-foreground hover:bg-background",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {kind === "pomodoro" && (
        <div className="space-y-2">
          <Label>{t("room.cadenceLabel")}</Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  onWorkChange(p.work);
                  onBreakChange(p.break);
                }}
                className={cn(
                  "rounded-xl border px-3 py-1.5 font-mono text-xs tabular-nums",
                  workMinutes === p.work && breakMinutes === p.break
                    ? "border-lime-400 bg-lime-50 text-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("room.pomodoroDesc")}</p>
        </div>
      )}
    </div>
  );
}
