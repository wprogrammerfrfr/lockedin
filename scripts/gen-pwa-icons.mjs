import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const LIME = [132, 204, 22, 255];
const INK = [15, 23, 42, 255];
const CLEAR = [0, 0, 0, 0];

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([t, data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, c]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function setPx(px, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  px[i] = color[0];
  px[i + 1] = color[1];
  px[i + 2] = color[2];
  px[i + 3] = color[3];
}

function fillRect(px, size, x0, y0, x1, y1, color) {
  const xa = Math.max(0, Math.floor(x0));
  const ya = Math.max(0, Math.floor(y0));
  const xb = Math.min(size - 1, Math.ceil(x1));
  const yb = Math.min(size - 1, Math.ceil(y1));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) setPx(px, size, x, y, color);
  }
}

function roundedRectMask(size, radius, inset = 0) {
  const mask = new Float32Array(size * size);
  const r = radius;
  const x0 = inset;
  const y0 = inset;
  const x1 = size - 1 - inset;
  const y1 = size - 1 - inset;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let d = 0;
      if (x < x0 + r && y < y0 + r) {
        const dx = x - (x0 + r);
        const dy = y - (y0 + r);
        d = Math.hypot(dx, dy) - r;
      } else if (x > x1 - r && y < y0 + r) {
        const dx = x - (x1 - r);
        const dy = y - (y0 + r);
        d = Math.hypot(dx, dy) - r;
      } else if (x < x0 + r && y > y1 - r) {
        const dx = x - (x0 + r);
        const dy = y - (y1 - r);
        d = Math.hypot(dx, dy) - r;
      } else if (x > x1 - r && y > y1 - r) {
        const dx = x - (x1 - r);
        const dy = y - (y1 - r);
        d = Math.hypot(dx, dy) - r;
      } else if (x < x0) d = x0 - x;
      else if (x > x1) d = x - x1;
      else if (y < y0) d = y0 - y;
      else if (y > y1) d = y - y1;
      mask[y * size + x] = d <= 0 ? 1 : d < 1 ? 1 - d : 0;
    }
  }
  return mask;
}

function blend(px, size, mask, color) {
  for (let i = 0; i < size * size; i++) {
    const a = mask[i];
    if (a <= 0) continue;
    const o = i * 4;
    const srcA = (color[3] / 255) * a;
    const dstA = px[o + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) continue;
    px[o] = Math.round((color[0] * srcA + px[o] * dstA * (1 - srcA)) / outA);
    px[o + 1] = Math.round(
      (color[1] * srcA + px[o + 1] * dstA * (1 - srcA)) / outA,
    );
    px[o + 2] = Math.round(
      (color[2] * srcA + px[o + 2] * dstA * (1 - srcA)) / outA,
    );
    px[o + 3] = Math.round(outA * 255);
  }
}

function drawLI(px, size, pad) {
  const inner = size - pad * 2;
  const x = pad;
  const y = pad;
  const stroke = inner * 0.14;
  // L stem + foot
  fillRect(
    px,
    size,
    x + inner * 0.04,
    y + inner * 0.08,
    x + inner * 0.04 + stroke,
    y + inner * 0.92,
    INK,
  );
  fillRect(
    px,
    size,
    x + inner * 0.04,
    y + inner * 0.92 - stroke,
    x + inner * 0.48,
    y + inner * 0.92,
    INK,
  );
  // I stem
  fillRect(
    px,
    size,
    x + inner * 0.66,
    y + inner * 0.08,
    x + inner * 0.66 + stroke,
    y + inner * 0.92,
    INK,
  );
}

function render({ size, rounded, maskable }) {
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const c = maskable ? LIME : CLEAR;
    px.set(c, i * 4);
  }
  if (maskable) {
    drawLI(px, size, Math.round(size * 0.22));
  } else {
    const inset = rounded ? 0 : 0;
    const radius = Math.round(size * 0.22);
    const mask = roundedRectMask(size, radius, inset);
    blend(px, size, mask, LIME);
    drawLI(px, size, Math.round(size * 0.18));
  }
  return encodePng(size, size, px);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
mkdirSync(iconsDir, { recursive: true });

writeFileSync(
  join(iconsDir, "icon-192.png"),
  render({ size: 192, rounded: true, maskable: false }),
);
writeFileSync(
  join(iconsDir, "icon-512.png"),
  render({ size: 512, rounded: true, maskable: false }),
);
writeFileSync(
  join(iconsDir, "icon-512-maskable.png"),
  render({ size: 512, rounded: false, maskable: true }),
);
writeFileSync(
  join(root, "public", "apple-touch-icon.png"),
  render({ size: 180, rounded: true, maskable: false }),
);

console.log("Wrote PWA icons to public/icons and apple-touch-icon.png");
