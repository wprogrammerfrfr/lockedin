/** Client-only PNG export for StoryExportCard (9:16). */

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

async function canvasFallback(
  el: HTMLElement,
  filename: string,
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
  grad.addColorStop(0, "#bbf7d0");
  grad.addColorStop(1, "#f1f5f9");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);

  const text = el.innerText || "LockedIn";
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 48px sans-serif";
  ctx.fillText("LockedIn", 80, 120);
  ctx.font = "36px monospace";
  const lines = text.split("\n").slice(0, 12);
  lines.forEach((line, i) => {
    ctx.fillText(line.slice(0, 40), 80, 220 + i * 56);
  });

  downloadDataUrl(canvas.toDataURL("image/png"), filename);
}

export async function exportStoryPng(
  el: HTMLElement | null,
  filename = "lockedin-story.png",
) {
  if (!el) throw new Error("Export target missing");

  try {
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(el, {
      width: 1080,
      height: 1920,
      pixelRatio: 1,
      cacheBust: true,
    });
    downloadDataUrl(dataUrl, filename);
  } catch {
    await canvasFallback(el, filename);
  }
}
