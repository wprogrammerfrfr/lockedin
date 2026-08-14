"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.ComponentProps<"label">
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-slate-400",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
