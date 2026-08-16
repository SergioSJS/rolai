// Rasteriza um componente de carta (@letele/playing-cards, SVG React) num
// THREE.CanvasTexture — a malha 3D (components/CardStage3D.tsx) usa isso
// como material da face. Cache por chave (id da carta, ou "back") pra nao
// re-renderizar a MESMA face toda vez que ela aparece de novo.

import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import type { CardSvgComponent } from "@letele/playing-cards";

// Resolucao da textura — nitida o bastante pro card ocupar boa parte da
// tela sem pesar (a lib usa viewBox 240x336, 5:7 — mantido aqui).
const TEXTURE_WIDTH = 480;
const TEXTURE_HEIGHT = Math.round((TEXTURE_WIDTH * 336) / 240);

const cache = new Map<string, Promise<THREE.CanvasTexture>>();

function rasterize(Component: CardSvgComponent): Promise<THREE.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const markup = renderToStaticMarkup(<Component />);
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = TEXTURE_WIDTH;
      canvas.height = TEXTURE_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("sem contexto 2d pra rasterizar carta"));
        return;
      }
      // Moldura SOLIDA primeiro, arte por cima recuada — nao um contorno
      // desenhado DEPOIS tentando alinhar com a transparencia da propria
      // arte (testado: sempre sobrava 1-2px sem cobertura em algum canto,
      // por raio/antialiasing da arte nao bater exato com o meu). Assim a
      // moldura e 100% opaca ate o proprio arredondado dela, sem depender
      // de nada da arte — a costura entre cartas vizinhas no tier 3D
      // (CardStage3D/cardScene3D.ts) nunca acha fundo do palco por tras,
      // so a moldura escura.
      const radius = canvas.width * 0.035;
      const border = 4;
      ctx.fillStyle = "#0a0c0a";
      ctx.beginPath();
      ctx.roundRect(0, 0, canvas.width, canvas.height, radius);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(
        border,
        border,
        canvas.width - border * 2,
        canvas.height - border * 2,
        Math.max(0, radius - border),
      );
      ctx.clip();
      ctx.drawImage(img, border, border, canvas.width - border * 2, canvas.height - border * 2);
      ctx.restore();

      // A arte da carta e branco quase puro — sem luz de cena pra "estourar"
      // (ver cardScene3D.ts), o branco cru fica correto tecnicamente, mas
      // ainda queima os olhos contra o tema escuro do app (contraste alto
      // demais, nao artefato de render). Escala DIRETA dos canais RGB (nao
      // blend mode "multiply" via fillRect) — testado que o blend mode
      // nao escurecia visivelmente o bastante; escrever o pixel na mao
      // garante o resultado exato, sem depender de como cada motor de
      // canvas (Chrome desktop x WebView Android) interpreta compositing.
      // Alfa (i+3) fica intocado — a moldura ja e opaca, a arte clipada
      // tambem, entao isto so escurece cor, nunca abre transparencia nova.
      const CARD_DIM_FACTOR = 0.72;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = Math.round((pixels[i] ?? 0) * CARD_DIM_FACTOR);
        pixels[i + 1] = Math.round((pixels[i + 1] ?? 0) * CARD_DIM_FACTOR);
        pixels[i + 2] = Math.round((pixels[i + 2] ?? 0) * CARD_DIM_FACTOR);
      }
      ctx.putImageData(imageData, 0, 0);
      const texture = new THREE.CanvasTexture(canvas);
      // API de r143 (nao a "colorSpace" das versoes novas) — a mesma que o
      // dice-box-threejs embarcado usa, ver package.json.
      texture.encoding = THREE.sRGBEncoding;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      resolve(texture);
    };
    img.onerror = () => reject(new Error("falha ao rasterizar carta (SVG invalido?)"));
    img.src = svgDataUrl;
  });
}

// `key` identifica a face (card.id, ou "back" pro verso) — chama de novo
// com a mesma key devolve a MESMA textura (cache), nunca rasteriza duas
// vezes a carta identica.
export function cardTexture(key: string, Component: CardSvgComponent): Promise<THREE.CanvasTexture> {
  let cached = cache.get(key);
  if (!cached) {
    cached = rasterize(Component);
    cache.set(key, cached);
  }
  return cached;
}
