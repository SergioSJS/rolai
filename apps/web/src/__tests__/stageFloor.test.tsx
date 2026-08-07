import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { useRef } from "react";
import type { RollRenderer } from "../renderers/types";
import {
  STAGE_FLOOR_DEFAULT_PX,
  STAGE_FLOOR_GAP_PX,
  STAGE_FLOOR_MAX_VH,
  floorValue,
  measureFloor,
  useStageFloor,
} from "../stage/floor";
import { impactAt, scaleCompensation, WORLD_TO_PX } from "../renderers/diceBox";
import type { BarrierEdge, PhysicsBody } from "../renderers/diceBox";

// Placa falsa: o jsdom nao faz layout, entao a altura vem carimbada.
function plateOf(height: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "result-display";
  Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
  return el;
}

describe("medida da faixa", () => {
  it("soma altura da placa, padding do overlay e o respiro", () => {
    const overlay = document.createElement("div");
    overlay.style.paddingBottom = "32px";
    expect(measureFloor(plateOf(174), overlay)).toBe(174 + 32 + STAGE_FLOOR_GAP_PX);
  });

  it("sem placa na tela nao ha o que reservar", () => {
    expect(measureFloor(null, document.createElement("div"))).toBe(0);
  });

  // Regressao: medir por getBoundingClientRect().top durante o fade dava 8px
  // a menos, porque a animacao de entrada tem translateY(8px). offsetHeight
  // nao sofre com transform.
  it("usa altura, nao posicao (o fade tem translateY)", () => {
    const plate = plateOf(174);
    plate.getBoundingClientRect = () => ({ top: 999 }) as DOMRect;
    expect(measureFloor(plate, null)).toBe(174 + STAGE_FLOOR_GAP_PX);
  });

  it("o teto em vh fica no CSS, pra girar o aparelho reaplicar sozinho", () => {
    expect(floorValue(240)).toBe(`min(240px, ${STAGE_FLOOR_MAX_VH}vh)`);
  });
});

// A ordem e o coracao da coisa: medir com a placa na tela, avisar o renderer,
// e SO ENTAO rolar. Redimensionar com dado no ar move as paredes por baixo
// dos dados em voo.
describe("ordem de reserva e rolagem", () => {
  function Palco({
    height,
    renderer,
    onRoll,
  }: {
    height: number;
    renderer: RollRenderer;
    onRoll: () => void;
  }) {
    const stageRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<RollRenderer | null>(renderer);
    const queueRoll = useStageFloor(stageRef, overlayRef, rendererRef);
    return (
      <div>
        <div className="stage" ref={stageRef} />
        <div className="stage-overlay" ref={overlayRef}>
          <div
            className="result-display"
            ref={(el) => {
              if (el) Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
            }}
          />
        </div>
        <button onClick={() => queueRoll(onRoll)}>rolar</button>
      </div>
    );
  }

  function fakeRenderer(log: string[]): RollRenderer {
    return {
      init: vi.fn(async () => undefined),
      roll: vi.fn(async () => undefined),
      clear: vi.fn(),
      resize: vi.fn(() => log.push("resize")),
      dispose: vi.fn(),
    };
  }

  it("placa alta: reserva, avisa o renderer e so depois rola", () => {
    const log: string[] = [];
    const alta = STAGE_FLOOR_DEFAULT_PX + 90;
    const { container, getByText } = render(
      <Palco height={alta} renderer={fakeRenderer(log)} onRoll={() => log.push("roll")} />,
    );
    act(() => getByText("rolar").click());
    expect(log).toEqual(["resize", "roll"]);
    const stage = container.querySelector<HTMLElement>(".stage");
    expect(stage?.style.getPropertyValue("--stage-bottom")).toBe(
      floorValue(alta + STAGE_FLOOR_GAP_PX),
    );
  });

  // A faixa so cresce: encolher a cada rolagem baixinha mudaria o tamanho do
  // mundo — e o do dado junto — a toda rolagem.
  it("placa que cabe na faixa atual nao mexe no mundo", () => {
    const log: string[] = [];
    const { container, getByText } = render(
      <Palco height={40} renderer={fakeRenderer(log)} onRoll={() => log.push("roll")} />,
    );
    act(() => getByText("rolar").click());
    expect(log).toEqual(["roll"]);
    expect(container.querySelector<HTMLElement>(".stage")?.style.getPropertyValue("--stage-bottom")).toBe("");
  });
});

describe("compensacao de escala do dado", () => {
  // Palco inteiro = nada a compensar.
  it("sem faixa reservada, fator 1", () => {
    expect(scaleCompensation(1280, 833, 833)).toBe(1);
  });

  // 1280x833 com faixa de 240px: o dado cresceria ~30% sem correcao.
  it("palco encurtado encolhe o dado de volta", () => {
    const fator = scaleCompensation(1280, 593, 833);
    expect(fator).toBeGreaterThan(0.7);
    expect(fator).toBeLessThan(0.8);
  });

  it("nunca aumenta o dado, e tem piso", () => {
    expect(scaleCompensation(1280, 900, 833)).toBe(1);
    expect(scaleCompensation(1280, 1, 833)).toBe(0.5);
  });
});

describe("brilho das barreiras", () => {
  const parede = (): PhysicsBody => ({
    mass: 0,
    position: { x: 0, y: 0, z: 0 },
    velocity: { length: () => 0 },
  });
  const walls = { top: parede(), bottom: parede(), left: parede(), right: parede() };
  const die = (x: number, y: number, speed: number): PhysicsBody => ({
    mass: 1,
    position: { x, y, z: 0 },
    velocity: { length: () => speed },
  });
  const ctx = {
    walls,
    containerWidth: 1000,
    containerHeight: 600,
    sinceLast: () => 999,
  };

  it("nas bordas horizontais a posicao e o X do dado", () => {
    expect(impactAt({ body: walls.bottom, target: die(200, -500, 400) }, ctx)).toEqual({
      edge: "bottom",
      pos: 500 + 200 * WORLD_TO_PX,
    });
    expect(impactAt({ body: walls.top, target: die(-40, 500, 400) }, ctx)?.edge).toBe("top");
  });

  // Y do mundo cresce pra cima, y da tela pra baixo: bater em cima da mesa
  // tem que acender na METADE DE CIMA da tela.
  it("nas verticais a posicao e o Y, invertido pra tela", () => {
    const impacto = impactAt({ body: walls.left, target: die(-500, 200, 400) }, ctx);
    expect(impacto).toEqual({ edge: "left", pos: 300 - 200 * WORLD_TO_PX });
    expect(impacto!.pos).toBeLessThan(300);
  });

  // A passada headless roda a fisica inteira antes de qualquer dado aparecer.
  it("nao acende durante o simulate", () => {
    const evento = { body: walls.bottom, target: die(0, 0, 400) };
    expect(impactAt(evento, { ...ctx, animstate: "simulate" })).toBeNull();
  });

  it("ignora colisao que nao e com parede (outro dado, mesa)", () => {
    expect(impactAt({ body: parede(), target: die(0, 0, 400) }, ctx)).toBeNull();
  });

  // Dado encostado tremendo gera contato o tempo todo.
  it("ignora toque lento", () => {
    expect(impactAt({ body: walls.bottom, target: die(0, 0, 5) }, ctx)).toBeNull();
  });

  it("dados que batem juntos na MESMA borda viram um brilho so", () => {
    const recente = (edge: BarrierEdge) => (edge === "bottom" ? 5 : 999);
    expect(
      impactAt({ body: walls.bottom, target: die(0, 0, 400) }, { ...ctx, sinceLast: recente }),
    ).toBeNull();
    // Borda diferente no mesmo instante continua acendendo.
    expect(
      impactAt({ body: walls.left, target: die(0, 0, 400) }, { ...ctx, sinceLast: recente }),
    ).not.toBeNull();
  });

  // Mundo recriado pelo setDimensions: a parede guardada nao existe mais.
  it("sem parede no mundo atual, nao acende", () => {
    const vazio = { ...ctx, walls: {} };
    expect(impactAt({ body: walls.bottom, target: die(0, 0, 400) }, vazio)).toBeNull();
  });
});
