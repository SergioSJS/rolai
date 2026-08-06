// Gera os icones PWA (public/icon-192.png, icon-512.png,
// icon-512-maskable.png) sem nenhuma dependencia: PNG escrito na mao
// (zlib do Node) com um dado estilizado sobre fundo verde (theme_color).
// Uso: node scripts/generate-icons.mjs

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BG = [0x1d, 0x9e, 0x75]; // #1D9E75
const DIE = [0xf5, 0xf5, 0xf5];
const PIP = [0x11, 0x14, 0x18];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filtro none
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function drawIcon(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };

  // Fundo: maskable precisa preencher o canvas inteiro (safe zone); o
  // icone normal usa cantos arredondados com alpha.
  const corner = maskable ? 0 : Math.round(size * 0.18);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (corner > 0) {
        const cx = x < corner ? corner : x >= size - corner ? size - corner - 1 : x;
        const cy = y < corner ? corner : y >= size - corner ? size - corner - 1 : y;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > corner * corner) {
          set(x, y, [0, 0, 0], 0);
          continue;
        }
      }
      set(x, y, BG);
    }
  }

  // Dado: quadrado branco arredondado central com face "5".
  const dieSize = Math.round(size * (maskable ? 0.42 : 0.55));
  const dieR = Math.round(dieSize * 0.16);
  const dieX0 = Math.round((size - dieSize) / 2);
  const dieY0 = dieX0;
  const inDie = (x, y) => {
    if (x < dieX0 || x >= dieX0 + dieSize || y < dieY0 || y >= dieY0 + dieSize) {
      return false;
    }
    const lx = Math.min(x - dieX0, dieX0 + dieSize - 1 - x);
    const ly = Math.min(y - dieY0, dieY0 + dieSize - 1 - y);
    if (lx >= dieR || ly >= dieR) return true;
    const dx = dieR - lx;
    const dy = dieR - ly;
    return dx * dx + dy * dy <= dieR * dieR;
  };

  const pipR = Math.max(2, Math.round(dieSize * 0.075));
  const pipOff = Math.round(dieSize * 0.26);
  const c = size / 2;
  const pips = [
    [c - pipOff, c - pipOff],
    [c + pipOff, c - pipOff],
    [c, c],
    [c - pipOff, c + pipOff],
    [c + pipOff, c + pipOff],
  ];
  const inPip = (x, y) =>
    pips.some(([pxx, pyy]) => (x - pxx) ** 2 + (y - pyy) ** 2 <= pipR * pipR);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inDie(x, y)) continue;
      set(x, y, inPip(x, y) ? PIP : DIE);
    }
  }

  return encodePng(size, px);
}

const publicDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
);
fs.mkdirSync(publicDir, { recursive: true });
for (const [name, size, maskable] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-512-maskable.png", 512, true],
]) {
  fs.writeFileSync(path.join(publicDir, name), drawIcon(size, { maskable }));
  console.log(`gerado public/${name}`);
}
