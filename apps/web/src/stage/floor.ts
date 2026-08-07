// Faixa reservada no pe do palco (spec 06). O dado parava embaixo da placa
// de resultado e o numero ficava ilegivel; agora a mesa termina onde a placa
// comeca.
//
// A dice-box monta o mundo a partir de `container.clientWidth/clientHeight`
// (paredes em `±0.93*containerHeight`), entao encurtar o `.stage` encurta a
// mesa de verdade — nao e truque visual. Mas ela NAO observa o container: so
// rele no `window.resize`. Quem muda a faixa tem que avisar o renderer
// (`RollRenderer.resize`).

import { useCallback, useLayoutEffect, useReducer, useRef } from "react";
import type { RefObject } from "react";
import type { RollRenderer } from "../renderers/types";

// Teto da faixa em vh. Celular deitado tem ~390px de altura: sem teto, uma
// placa de 250px deixaria a mesa com 140px e o dado sem para onde rolar.
export const STAGE_FLOOR_MAX_VH = 45;

// Respiro entre o topo da placa e a parede, pra o dado nao encostar nela.
export const STAGE_FLOOR_GAP_PX = 8;

// Faixa inicial, antes de existir placa pra medir. Vale no primeiro
// carregamento — e o valor que a dice-box le na CONSTRUCAO, entao precisa
// ser proximo do real, senao a primeira rolagem sai com a mesa errada.
export const STAGE_FLOOR_DEFAULT_PX = 210;

/**
 * Altura a reservar embaixo, medida da placa de resultado que esta na tela.
 *
 * Usa `offsetHeight`, nao `getBoundingClientRect().top`: a animacao de
 * entrada tem `translateY(8px)` e contamina a POSICAO durante o fade (medindo
 * por posicao a folga dava 24px onde o padding e 32px). Altura nao sofre com
 * translate.
 */
export function measureFloor(plate: HTMLElement | null, overlay: HTMLElement | null): number {
  if (plate === null) return 0;
  const padding =
    overlay === null ? 0 : Number.parseFloat(getComputedStyle(overlay).paddingBottom) || 0;
  return Math.ceil(plate.offsetHeight + padding + STAGE_FLOOR_GAP_PX);
}

/**
 * Valor CSS da faixa. O `min()` fica no CSS (nao resolvido aqui) de proposito:
 * girar o aparelho muda `vh` e o teto reaplica sozinho, sem precisar de nova
 * medida.
 */
export function floorValue(px: number): string {
  return `min(${px}px, ${STAGE_FLOOR_MAX_VH}vh)`;
}

/**
 * Reserva a faixa antes de cada rolagem e so entao rola.
 *
 * A ordem importa e nao e negociavel:
 *
 *   commit da placa -> medir -> `renderer.resize()` -> `roll()`
 *
 * - medir antes do commit pegaria a placa da rolagem ANTERIOR (o `animate`
 *   dos dois apps troca o resultado e dispara a rolagem no mesmo handler);
 * - redimensionar com dado no ar move as paredes por baixo dos dados em voo,
 *   e a fisica empurra o que ficou fora.
 *
 * A faixa so CRESCE dentro da sessao: se encolhesse a cada rolagem baixinha,
 * o mundo mudaria de tamanho toda vez e o dado mudaria de tamanho junto
 * (o tamanho aparente depende da diagonal do palco).
 */
export function useStageFloor(
  stageRef: RefObject<HTMLElement | null>,
  overlayRef: RefObject<HTMLElement | null>,
  rendererRef: RefObject<RollRenderer | null>,
): (run: () => void) => void {
  const pendingRef = useRef<(() => void) | null>(null);
  const reservedRef = useRef(STAGE_FLOOR_DEFAULT_PX);
  const [, forcarCommit] = useReducer((n: number) => n + 1, 0);

  const queueRoll = useCallback((run: () => void) => {
    pendingRef.current = run;
    // O commit e nosso, nao emprestado: sem isto a rolagem so sairia se
    // QUEM CHAMOU tivesse mudado algum estado no mesmo handler. Funciona
    // hoje (os dois apps trocam o resultado antes de rolar) e quebraria
    // calado no dia em que alguem rolasse sem mexer em estado. React junta
    // este commit com o de quem chamou, entao continua sendo um so.
    forcarCommit();
  }, []);

  // Sem lista de dependencias: roda depois de TODO commit, e e o commit que
  // acabou de por a placa na tela que interessa.
  useLayoutEffect(() => {
    const run = pendingRef.current;
    if (run === null) return;
    pendingRef.current = null;
    const stage = stageRef.current;
    const overlay = overlayRef.current;
    const plate = overlay?.querySelector<HTMLElement>(".result-display") ?? null;
    const wanted = measureFloor(plate, overlay);
    if (stage !== null && wanted > reservedRef.current) {
      reservedRef.current = wanted;
      stage.style.setProperty("--stage-bottom", floorValue(wanted));
      rendererRef.current?.resize?.();
    }
    run();
  });

  return queueRoll;
}
