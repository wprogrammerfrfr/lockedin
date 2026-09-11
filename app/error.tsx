"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <h1 className="font-display text-2xl font-bold text-foreground">
        Something broke
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred. Try again."}
      </p>
      <div className="flex gap-2">
        <Button type="button" className="rounded-xl" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/lockin">Back to Lock In</Link>
        </Button>
      </div>
    </div>
  );
}
