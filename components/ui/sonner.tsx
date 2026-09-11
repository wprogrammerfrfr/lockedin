"use client";

import { useTheme } from "@/lib/theme/ThemeProvider";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-soft",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-slate-900 group-[.toast]:text-white dark:group-[.toast]:bg-zinc-100 dark:group-[.toast]:text-zinc-950",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-foreground",
          error:
            "group-[.toaster]:border-border group-[.toaster]:bg-muted",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
