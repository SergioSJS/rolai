// Instala o bundle headless (dist-headless/rolai-headless.js) nos assets
// do app Android e gera systems.json ao lado — a tela de configuracoes
// nativa le esse arquivo pra montar o seletor de sistema sem precisar de
// WebView. Fonte unica de verdade: o proprio bundle recem-buildado
// (executado em Node; o entry registra `rolai` em globalThis).
// Uso: npm run build:headless (ja roda este script no final).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const bundle = path.join(webRoot, "dist-headless", "rolai-headless.js");
const assetsDir = path.resolve(
  webRoot,
  "..",
  "android",
  "app",
  "src",
  "main",
  "assets",
  "headless",
);

if (!fs.existsSync(bundle)) {
  console.error(`bundle nao encontrado: ${bundle} — rode vite build antes`);
  process.exit(1);
}

// Executa o IIFE em Node pra extrair systems() da fonte de verdade.
// O rules-engine so precisa de globalThis.crypto (Node 18+).
await import(pathToFileURL(bundle).href);
const rolai = globalThis.rolai;
if (!rolai || typeof rolai.systems !== "function") {
  console.error("o bundle nao registrou globalThis.rolai — entry quebrado?");
  process.exit(1);
}
const systems = rolai.systems();
JSON.parse(systems); // valida que e JSON parseavel

fs.mkdirSync(assetsDir, { recursive: true });
fs.copyFileSync(bundle, path.join(assetsDir, "rolai-headless.js"));
fs.writeFileSync(path.join(assetsDir, "systems.json"), systems);
console.log(`instalado em ${assetsDir}: rolai-headless.js, systems.json`);
