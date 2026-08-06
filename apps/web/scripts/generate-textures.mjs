// Gera public/texture-felt.png: feltro verde de mesa de jogo, 512x512,
// tileable (ruido por pixel + fibras curtas — repete sem emenda visivel).
// Sem dependencias (mesmo encoder PNG do generate-icons.mjs).
// Uso: node scripts/generate-textures.mjs

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 512;
const BASE = [23, 66, 46]; // verde feltro escuro

// PRNG deterministico (mulberry32) pra textura ser reproduzivel.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  ihdr[8] = 8;
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

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

function drawFelt(size) {
  const px = Buffer.alloc(size * size * 4);
  const rand = mulberry32(20260805);
  // Ruido fino por pixel (a trama do feltro) + variacao suave em blocos
  // (manchas de desgaste). Blocos alinhados a grade de 32px com wrap pra
  // manter o tile sem emenda.
  const GRID = 32;
  const cells = size / GRID;
  const wear = [];
  for (let i = 0; i < cells * cells; i++) wear.push((rand() - 0.5) * 14);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / GRID) % cells;
      const gy = Math.floor(y / GRID) % cells;
      const n = (rand() - 0.5) * 18; // trama
      const w = wear[gy * cells + gx]; // desgaste
      const i = (y * size + x) * 4;
      px[i] = clamp(BASE[0] + n * 0.6 + w);
      px[i + 1] = clamp(BASE[1] + n + w);
      px[i + 2] = clamp(BASE[2] + n * 0.7 + w);
      px[i + 3] = 255;
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
fs.writeFileSync(path.join(publicDir, "texture-felt.png"), drawFelt(SIZE));
console.log(`gerado public/texture-felt.png (${SIZE}x${SIZE})`);
