/** Client-only PNG export for StoryExportCard (9:16) and feed summary cards. */

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header ?? "")?.[1] ?? "image/png";
  const binary = atob(data ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function canvasFallbackBlob(el: HTMLElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const rect = el.getBoundingClientRect();
  const width = Math.max(540, Math.round(rect.width) || 540);
  const height = Math.max(540, Math.round(rect.height) || 720);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#bbf7d0");
  grad.addColorStop(1, "#f1f5f9");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const text = el.innerText || "LockedIn";
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("LockedIn", 32, 48);
  ctx.font = "20px monospace";
  const lines = text.split("\n").slice(0, 16);
  lines.forEach((line, i) => {
    ctx.fillText(line.slice(0, 48), 32, 96 + i * 32);
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encode failed"))),
      "image/png",
    );
  });
}

async function canvasFallback(
  el: HTMLElement,
  filename: string,
): Promise<void> {
  const blob = await canvasFallbackBlob(el);
  downloadDataUrl(URL.createObjectURL(blob), filename);
}

/** Capture a DOM card as a PNG Blob for upload or download. */
export async function cardToPngBlob(el: HTMLElement | null): Promise<Blob> {
  if (!el) throw new Error("Export target missing");

  try {
    const { toBlob, toPng } = await import("html-to-image");
    const blob = await toBlob(el, {
      pixelRatio: 2,
      cacheBust: true,
    });
    if (blob) return blob;
    const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true });
    return dataUrlToBlob(dataUrl);
  } catch {
    return canvasFallbackBlob(el);
  }
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
