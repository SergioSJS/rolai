// Cena three.js pro tier 3D do baralho (specs/08-baralho.md) — plano de
// caixa fina (BoxGeometry) com a face da carta de um lado e o verso do
// outro: rotacionar o mesh 180deg troca qual lado a camera ve, sem
// precisar trocar material nenhum (ao contrario do truque de duas faces
// planas empilhadas que o flip CSS usa).
//
// SEM fisica (cannon-es): dado precisa de fisica porque o valor final tem
// que parecer resultado de uma queda real. Carta so precisa flipar e
// pousar num lugar decidido — um tween manual (posicao/rotacao/escala com
// easing) fica leve e sem dependencia nova, e o resultado visual e o
// mesmo tipo de "arremesso que pousa" que o dado ja tem.
//
// Layout responsivo: a distancia entre cartas e CALCULADA a partir da
// largura visivel da camera (mesmo raciocinio do CardStack em CSS —
// puxar muita carta tem que comprimir a fileira, nunca cortar na tela).

import * as THREE from "three";
import type { Card } from "@rolai/deck-engine";
import { CardBack, cardComponent } from "./cardFormat";
import { cardTexture } from "./cardTexture";

const CARD_WIDTH = 1.4;
const CARD_HEIGHT = CARD_WIDTH * (336 / 240);
const CARD_DEPTH = 0.002;

// Fracao MINIMA da carta que fica sempre visivel (mesmo raciocinio do
// CardStack em CSS) — nunca tampa tudo, mesmo com muita carta.
const MIN_REVEAL_RATIO = 0.16;
// Overlap MINIMO forcado entre cartas vizinhas, mesmo com tela de sobra —
// cobre qualquer fresta de sub-pixel na rasterizacao ENTRE duas malhas
// (nao dentro de uma textura so — isso a moldura solida em cardTexture.tsx
// ja cobre). depthTest esta OFF nestas cartas (renderOrder decide quem
// fica por cima, ver playCards), entao overlap generoso so tampa mais
// canto da carta de baixo — sem risco de zbrigar. Valor grande de
// proposito: testes com margem pequena (8%) ainda relataram fresta.
const CORNER_SAFETY_MARGIN = CARD_WIDTH * 0.22;
const TOSS_DURATION_MS = 650;
// Rotacao termina BEM antes da posicao (janela curta e propositalmente
// menor que STAGGER_MS abaixo): uma caixa fina de canto (~90deg de giro)
// fica larga em Z por um instante — se duas cartas vizinhas passam por
// esse instante ao mesmo tempo, uma atravessa a outra visualmente. Girar
// rapido e escalonar cartas com folga garante que so uma carta por vez
// esta "de canto".
const ROTATION_DURATION_MS = 320;
const STAGGER_MS = 200;

function easeOutBack(t: number): number {
  const c1 = 1.4;
  const c3 = c1 + 1;
  const x = t - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

function easeOutCubic(t: number): number {
  const x = t - 1;
  return x * x * x + 1;
}

interface ActiveCard {
  mesh: THREE.Mesh;
  startAt: number;
  from: { y: number; z: number; rotY: number; rotZ: number; scale: number };
  to: { x: number; y: number; z: number; rotY: number; rotZ: number };
}

export class CardScene3D {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private frameHandle: number | null = null;
  private active: ActiveCard[] = [];
  // Token que invalida rasterizacoes/tosses de uma leva anterior — evita
  // que a textura de uma carta puxada ANTES apareca tarde por cima da
  // leva atual (a mesma armadilha de "promise que resolve fora de ordem").
  private drawToken = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    // Y=0 (era 0.4): camera olhando de CIMA pra baixo faz CADA carta
    // projetar com um leve keystone (topo mais estreito que a base) —
    // cartas vizinhas, em X diferente, tem keystone levemente diferente
    // uma da outra, e a costura entre elas para de alinhar (relatado como
    // "carta meio inclinada"/linha na borda). Camera no MESMO plano Z das
    // cartas (nivelada, sem olhar de cima) elimina o keystone de vez —
    // nao e mascaramento (borda grossa em cardTexture.tsx), e a causa
    // sumindo de verdade.
    this.camera.position.set(0, 0, 6.2);
    this.camera.lookAt(0, 0, 0);
    // SEM luz na cena de proposito (ver materiais em playCards): a carta e
    // uma textura pronta (arte da carta), nao uma superficie que precisa de
    // luz simulada pra "parecer 3D" como o dado. Luz + material padrao
    // (MeshStandardMaterial) MULTIPLICA a cor da textura pela luz — num
    // fundo quase todo branco isso estourava pra um branco "queimado", e o
    // resultado variava entre GPU/WebView (mobile x desktop liam a mesma
    // luz de um jeito visualmente diferente, ver specs/08-baralho.md).
  }

  mount(container: HTMLElement): void {
    this.container = container;
    // SEM antialias: a linha fina residual na costura entre cartas
    // vizinhas (depois de escurecer a lateral da caixa, ver playCards) e o
    // proprio blend de AA suavizando a borda da caixa contra o que esta
    // atras — desligar MSAA elimina esse blend. Troca: a silhueta da carta
    // (fora da costura) fica sem suavizacao nenhuma.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    // SEM tone mapping: material unlit (ver playCards) nao tem luz pra
    // "estourar" — a cor que sai e a textura, ponto. Tone mapping (que
    // existe pra comprimir luz de CENA acima de 1.0) so introduzia mais
    // uma variavel de diferenca visual entre aparelhos sem resolver nada
    // aqui.
    renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);

    const tick = () => {
      this.frameHandle = requestAnimationFrame(tick);
      this.step();
      renderer.render(this.scene, this.camera);
    };
    tick();
  }

  private resize(): void {
    const container = this.container;
    const renderer = this.renderer;
    if (!container || !renderer) return;
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // Largura visivel no plano z=0, dada a camera atual — mesmo papel do
  // "budget" em px do CardStack (CSS), so que em unidades de mundo.
  private visibleWidthAtOrigin(): number {
    const distance = this.camera.position.z;
    const visibleHeight = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * distance;
    return visibleHeight * this.camera.aspect;
  }

  // Descarta os meshes da leva anterior e sobe uma nova — cada carta
  // rasteriza sua textura (async, cacheada) e entra assim que estiver
  // pronta, escalonada por `delayMs` como o flip CSS.
  playCards(cards: Card[]): void {
    this.clearMeshes();
    const token = ++this.drawToken;
    if (cards.length === 0) return;

    const budget = this.visibleWidthAtOrigin() * 0.86;
    const natural = CARD_WIDTH * cards.length;
    const rawStep =
      natural <= budget
        ? CARD_WIDTH
        : Math.max(CARD_WIDTH * MIN_REVEAL_RATIO, (budget - CARD_WIDTH) / cards.length);
    // Overlap MINIMO sempre, mesmo com tela de sobra (rawStep == CARD_WIDTH
    // no caso "cabe tudo" acima): a arte da carta tem canto arredondado
    // (alfa zero fora do raio), e duas cartas so ENCOSTANDO (overlap zero)
    // deixam uma fresta triangular no topo/base da costura, onde NENHUMA
    // das duas cobre o pixel — mostra o fundo do palco por tras (reportado
    // em teste real, canto superior). CORNER_SAFETY_MARGIN e generoso o
    // bastante pra cobrir o raio real da arte sem precisar medi-lo.
    const step = Math.min(rawStep, CARD_WIDTH - CORNER_SAFETY_MARGIN);
    const rowWidth = CARD_WIDTH + step * (cards.length - 1);
    const startX = -rowWidth / 2 + CARD_WIDTH / 2;

    cards.forEach((card, i) => {
      const geometry = new THREE.BoxGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH);
      // Laterais (+x, -x, +y, -y) invisiveis: carta e fina como papel.
      // Qualquer face lateral 3D solida cria uma linha/fatia visivel em perspectiva
      // (especialmente nos cantos arredondados e no desnivel vertical entre cartas).
      const edge = new THREE.MeshBasicMaterial({
        visible: false,
      });
      const placeholder = new THREE.MeshBasicMaterial({
        visible: false,
      });
      // Ordem do BoxGeometry: +x,-x,+y,-y,+z(front),-z(back).
      const materials = [edge, edge, edge, edge, placeholder, placeholder];
      const mesh = new THREE.Mesh(geometry, materials);
      mesh.visible = false;
      // Quem fica por cima na regiao de sobreposicao e ISTO, nao Z — ver
      // comentario abaixo sobre a costura.
      mesh.renderOrder = i;
      this.scene.add(mesh);

      const targetX = startX + i * step;
      const targetY = -i * 0.05;
      // MESMO Z pra toda carta (era `i * CARD_DEPTH * 1.5`, um Z levemente
      // diferente por carta pra decidir quem fica por cima). Motivo da
      // troca: com a camera em perspectiva, duas cartas vizinhas em Z
      // DIFERENTES nao alinham mais na costura — a mais perto "cresce" um
      // pouco mais que a mais longe, abrindo uma fresta de 1-2px que
      // mostra o fundo do palco por tras (uma linha fina na borda,
      // reportada em teste real; nao e AA nem cor de material — e
      // paralaxe pura, some com Z=0 pra todas). Quem decide a ordem visual
      // agora e `renderOrder` (acima), nao mais Z.
      const targetZ = 0;

      void Promise.all([
        cardTexture(card.id, cardComponent(card)),
        cardTexture("back", CardBack),
      ]).then(([face, back]) => {
        if (token !== this.drawToken) {
          // Leva descartada enquanto a textura carregava — nao reaproveita
          // o mesh de uma pilha que ja saiu de cena.
          geometry.dispose();
          return;
        }
        // MeshBasicMaterial: sem luz multiplicando a textura, a cor que sai
        // e a arte da carta tal e qual (ver constructor). transparent:true
        // continua necessario — sem isso o three.js IGNORA o alfa do canvas
        // (cantos arredondados da carta viravam preto solido). depthTest/
        // depthWrite:false igual edge/placeholder acima — TODO material do
        // MESMO mesh precisa combinar nisso, senao a costura entre a face
        // (testa profundidade) e a borda (nao testa) fica inconsistente
        // dentro da propria carta.
        materials[4] = new THREE.MeshBasicMaterial({
          map: face,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });
        materials[5] = new THREE.MeshBasicMaterial({
          map: back,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });
        mesh.material = materials;

        const from = {
          y: targetY + 2.4,
          z: targetZ + 1.2,
          // PI: comeca de COSTAS pra camera (verso visivel, carta
          // "coberta") e desenrola ate 0 (face). Giro UNICO de proposito —
          // voltas extra de flourish passavam pela zona "de canto" (larga
          // em Z) mais de uma vez, aumentando a chance de uma carta
          // atravessar a vizinha durante o giro.
          rotY: Math.PI,
          rotZ: 0.5,
          scale: 0.5,
        };
        const to = {
          x: targetX,
          y: targetY,
          z: targetZ,
          rotY: 0,
          // SEM tilt (era +-0.02 rad): a carta e um retangulo reto, e um
          // tilt alternado entre vizinhas faz os retangulos nao coincidirem
          // mais na costura — abre uma fresta em cunha mostrando o fundo do
          // palco por tras, bem visivel contra a carta escurecida (ver
          // cardTexture.tsx). O "tilt casual" nao valia esse artefato.
          rotZ: 0,
        };

        // Aplica o estado INICIAL inteiro (posicao+rotacao+escala) antes
        // de ficar visivel — so setar a posicao e deixar rotacao/escala no
        // default (0 / 1x) fazia a carta nascer de FRENTE, ja mostrando o
        // valor, e so "virar de costas" de repente quando o tween comecava
        // — dois movimentos onde devia ter um so.
        mesh.position.set(targetX, from.y, from.z);
        mesh.rotation.set(0, from.rotY, from.rotZ);
        mesh.scale.setScalar(from.scale);
        mesh.visible = true;

        this.active.push({ mesh, startAt: performance.now() + i * STAGGER_MS, from, to });
      });
    });
  }

  private step(): void {
    if (this.active.length === 0) return;
    const now = performance.now();
    for (const item of this.active) {
      const elapsed = now - item.startAt;
      if (elapsed < 0) continue; // ainda na fila (stagger)
      const t = Math.min(1, elapsed / TOSS_DURATION_MS);
      const posT = easeOutCubic(t);
      const rotT = easeOutBack(Math.min(1, elapsed / ROTATION_DURATION_MS));
      item.mesh.position.set(
        item.to.x,
        item.from.y + (item.to.y - item.from.y) * posT,
        item.from.z + (item.to.z - item.from.z) * posT,
      );
      item.mesh.rotation.y = item.from.rotY + (item.to.rotY - item.from.rotY) * rotT;
      item.mesh.rotation.z = item.from.rotZ + (item.to.rotZ - item.from.rotZ) * rotT;
      const scale = item.from.scale + (1 - item.from.scale) * posT;
      item.mesh.scale.setScalar(scale);
    }
    if (this.active.every((item) => now - item.startAt >= TOSS_DURATION_MS)) {
      this.active = [];
    }
  }

  private clearMeshes(): void {
    for (const child of [...this.scene.children]) {
      if (child instanceof THREE.Mesh) {
        this.scene.remove(child);
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of materials) m.dispose();
      }
    }
    this.active = [];
  }

  dispose(): void {
    this.drawToken++;
    if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle);
    this.resizeObserver?.disconnect();
    this.clearMeshes();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
    this.container = null;
  }
}
