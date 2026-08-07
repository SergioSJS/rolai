// Instala o build do apps/web nos assets do app Android, pro palco de dados
// 3D funcionar SEM REDE (modo avião, avião de verdade, mesa no sítio).
//
// Sem isto, o palco carrega `https://rolai.app/?stream=1` numa WebView: o
// cálculo da rolagem já era offline (bundle headless), mas o dado 3D não
// aparecia sem internet — o app "funcionava" mostrando só números.
//
// O que vai junto: bundle JS/CSS, as 38 texturas e os 75 sons. Nada de
// service worker (`sw.js` e `workbox-*`): dentro do APK não há atualização
// pela rede pra gerenciar, e um SW registrado sobre o WebViewAssetLoader só
// adiciona uma camada de cache que ninguém precisa e que atrapalha depurar.
//
// Uso: npm run build:stage -w @rolai/web (roda o build antes).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const dist = path.join(webRoot, "dist");
const destino = path.resolve(
  webRoot,
  "..",
  "android",
  "app",
  "src",
  "main",
  "assets",
  "stage",
);

if (!fs.existsSync(dist)) {
  console.error("dist/ não existe — rode `npm run build -w @rolai/web` antes.");
  process.exit(1);
}

// Service worker fica de fora (ver cabeçalho). `.vite` é metadado de build.
const IGNORAR = [
  /^sw\.js$/,
  /^workbox-.*\.js$/,
  // registerSW.js registra o service worker; sem o sw.js (excluido acima) o
  // registro falha e o erro aparece no console do palco. Dentro do APK nao
  // ha o que um SW resolva — os arquivos ja estao locais.
  /^registerSW\.js$/,
  /^\.vite$/,
  /^config\.js$/,
];

function copiar(origem, alvo) {
  fs.mkdirSync(alvo, { recursive: true });
  let arquivos = 0;
  let bytes = 0;
  for (const entrada of fs.readdirSync(origem, { withFileTypes: true })) {
    if (IGNORAR.some((re) => re.test(entrada.name))) continue;
    const de = path.join(origem, entrada.name);
    const para = path.join(alvo, entrada.name);
    if (entrada.isDirectory()) {
      const sub = copiar(de, para);
      arquivos += sub.arquivos;
      bytes += sub.bytes;
    } else {
      fs.copyFileSync(de, para);
      arquivos += 1;
      bytes += fs.statSync(de).size;
    }
  }
  return { arquivos, bytes };
}

fs.rmSync(destino, { recursive: true, force: true });
const { arquivos, bytes } = copiar(dist, destino);

// config.js: no APK a URL do backend vem das preferências do app, não de um
// arquivo escrito por container. Um stub vazio evita 404 no console — o
// index.html referencia o script.
// index.html referencia o registerSW.js, que nao copiamos — tirar a tag
// evita erro de console e a tentativa de registro.
const indexPath = path.join(destino, "index.html");
fs.writeFileSync(
  indexPath,
  fs
    .readFileSync(indexPath, "utf8")
    .replace(/<script[^>]*registerSW\.js[^>]*><\/script>\s*/g, ""),
);

fs.writeFileSync(
  path.join(destino, "config.js"),
  "// Sem config de runtime dentro do APK: o servidor vem das preferências.\n" +
    "window.__ROLAI_CONFIG__ = {};\n",
);

const mb = (bytes / 1024 / 1024).toFixed(1);
console.log(`palco instalado em assets/stage: ${arquivos} arquivos, ${mb} MB`);
