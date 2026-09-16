export async function shareOrCopyInvite(link: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      return "copied" as const;
    }
  } catch {
    /* fall through */
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title: "LockedIn room",
        text: "Join my LockedIn room",
        url: link,
      });
      return "shared" as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled" as const;
      }
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = link;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied ? ("copied" as const) : ("failed" as const);
}
