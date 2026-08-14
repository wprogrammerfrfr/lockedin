import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <h1 className="font-display text-2xl font-bold text-slate-900">
        Page not found
      </h1>
      <p className="max-w-md text-sm text-slate-500">
        That route doesn&apos;t exist — maybe the username moved or the room
        closed.
      </p>
      <Button asChild className="rounded-xl">
        <Link href="/lockin">Go to Lock In</Link>
      </Button>
    </div>
  );
}
