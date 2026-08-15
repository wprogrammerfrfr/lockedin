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
  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Locked", 32, 48);
  const lockedWidth = ctx.measureText("Locked").width;
  const gap = 3;
  const padX = 5;
  const padY = 4;
  ctx.font = "bold 28px sans-serif";
  const inWidth = ctx.measureText("in").width;
  const badgeW = inWidth + padX * 2;
  const badgeH = 28;
  const badgeX = 32 + lockedWidth + gap;
  const badgeY = 48 - 22;
  // Lime wrap around same-size "in"
  ctx.fillStyle = "#a3e635";
  const r = 5;
  ctx.beginPath();
  ctx.moveTo(badgeX + r, badgeY);
  ctx.arcTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeH, r);
  ctx.arcTo(badgeX + badgeW, badgeY + badgeH, badgeX, badgeY + badgeH, r);
  ctx.arcTo(badgeX, badgeY + badgeH, badgeX, badgeY, r);
  ctx.arcTo(badgeX, badgeY, badgeX + badgeW, badgeY, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("in", badgeX + padX, 48);
  // Green baseline under full logo
  const logoRight = badgeX + badgeW;
  ctx.fillStyle = "#a3e635";
  ctx.fillRect(32, 54, logoRight - 32, 3);
  ctx.font = "20px monospace";
  ctx.fillStyle = "#0f172a";
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
