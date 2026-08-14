export function isTypingTarget(event: KeyboardEvent): boolean {
  const el = event.target;
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("[contenteditable='true']"));
}

export function isDialogOpen(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector(
      '[role="dialog"][data-state="open"], [data-slot="dialog-content"]',
    ),
  );
}

export function matchLockIn(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && event.key === "Enter";
}

export function matchBreak(event: KeyboardEvent): boolean {
  return event.code === "Space" && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey;
}

export function matchTapOut(event: KeyboardEvent): boolean {
  return event.key === "Escape";
}
