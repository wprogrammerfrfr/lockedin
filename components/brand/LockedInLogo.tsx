import { cn } from "@/lib/utils";

type LockedInLogoProps = {
  className?: string;
  /** Icon-only: lime "in" badge (LinkedIn-style mark) */
  compact?: boolean;
  as?: "span" | "p" | "h1";
};

/**
 * Brand wordmark: Locked (slate) + same-size "in" in a lime wrap box,
 * with a lime baseline rule under the full mark for alignment.
 */
function InBadge() {
  return (
    <span
      className="inline-flex items-center justify-center rounded-[0.18em] bg-lime-400 px-[0.18em] pb-[0.08em] pt-[0.12em] leading-none"
      aria-hidden
    >
      <span className="text-[1em] font-bold leading-none tracking-tight text-white normal-case">
        in
      </span>
    </span>
  );
}

export function LockedInLogo({
  className,
  compact = false,
  as: Tag = "span",
}: LockedInLogoProps) {
  if (compact) {
    return (
      <Tag
        className={cn("inline-flex flex-col items-center", className)}
        aria-label="LockedIn"
      >
        <span
          className="inline-flex items-center justify-center rounded-md bg-lime-400 px-1.5 pb-0.5 pt-1 text-lg font-bold leading-none tracking-tight text-white"
          aria-hidden
        >
          in
        </span>
        <span className="mt-0.5 h-0.5 w-full rounded-full bg-lime-400" aria-hidden />
      </Tag>
    );
  }

  return (
    <Tag
      className={cn(
        "inline-flex flex-col items-stretch font-display text-slate-900 font-bold leading-none tracking-tight",
        className,
      )}
      aria-label="LockedIn"
    >
      <span className="inline-flex items-baseline gap-[0.08em] leading-none">
        <span className="leading-none">Locked</span>
        <InBadge />
      </span>
      <span
        className="mt-[0.12em] h-[0.08em] min-h-[2px] w-full rounded-full bg-lime-400"
        aria-hidden
      />
    </Tag>
  );
}
