// Dois navegadores na mesma sala, contra o backend de verdade.
//
// É o único nível em que dá pra provar que a rolagem de um chega no outro:
// jsdom não tem WebSocket real nem WebGL, e o teste de hook usa um fake.
//
// A escolha de UM arquivo enxuto é deliberada (docs/test-plan-android.md,
// seção E2): o que não couber aqui continua no checklist manual, que é mais
// barato de manter do que uma suíte de browser.

import { test, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

/** Cria a sala pelo backend, como o botão "Criar" faz. */
async function criarSala(request: { post: (u: string) => Promise<{ json: () => Promise<{ code: string }> }> }) {
  const r = await request.post("http://localhost:8420/rooms");
  return (await r.json()).code;
}

/** Abre uma aba já dentro da sala, com apelido próprio. */
async function entrar(browser: Browser, code: string, nome: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.addInitScript((n) => {
    window.localStorage.setItem("rolai.player-name", n);
    // Texto puro: o teste é sobre o protocolo da sala, não sobre WebGL —
    // e headless não tem GPU pra animar dado de verdade.
    window.localStorage.setItem("rolai.quality-tier", '"text"');
  }, nome).then(() => ctx.newPage());
  await page.goto(`/?room=${code}`);
  await expect(page.getByText(nome, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  return page;
}

test("rolagem de um jogador aparece no outro", async ({ browser, request }) => {
  const code = await criarSala(request);
  const ana = await entrar(browser, code, "ana");
  const bia = await entrar(browser, code, "bia");

  await ana.getByRole("textbox", { name: /notação/i }).fill("2d6");
  await ana.getByRole("button", { name: /^rolar/i }).click();

  // A outra ponta recebe pelo WebSocket e escreve no histórico.
  await expect(bia.getByText("ana", { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await expect(bia.getByText("2d6", { exact: false }).first()).toBeVisible({ timeout: 15_000 });
});

// REGRESSAO 2026-08-20: arrastar o seletor de cor reabria o WebSocket a cada
// movimento, estourava o ws_connect_limit_per_minute do backend e o 4429
// resultante era tratado como recusa definitiva — quem mexeu na cor era
// expulso da própria mesa e perdia o código salvo.
test("arrastar a cor do dado não derruba ninguém da sala", async ({ browser, request }) => {
  const code = await criarSala(request);
  const ana = await entrar(browser, code, "ana");
  const bia = await entrar(browser, code, "bia");

  // Em tela estreita o menu vive atrás do botão "Menu"; num viewport de
  // desktop os links já estão visíveis. Cobre os dois.
  const menu = ana.getByRole("button", { name: "Menu" });
  if (await menu.isVisible()) await menu.click();
  await ana.getByRole("button", { name: "Preferências" }).click();
  const cor = ana.locator('input[type="color"]').first();
  await expect(cor).toBeVisible({ timeout: 10_000 });

  // 40 mudanças seguidas, como um arrasto de verdade — o relato original
  // registrou 28 conexões num arrasto só. O número precisa passar do
  // ws_connect_limit_per_minute (30) do backend, senão o teste passaria
  // mesmo com o bug de volta: foi o que aconteceu com 20.
  for (let i = 0; i < 40; i++) {
    await cor.evaluate((el: HTMLInputElement, v: string) => {
      // O React intercepta o setter de `value` do input pra rastrear o
      // estado; atribuir direto NÃO dispara o onChange dele. Sem o setter
      // nativo o teste mexia no DOM e o app não ficava sabendo — ele passava
      // até com o bug de volta, que é o pior tipo de teste.
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, `#0000${i.toString(16).padStart(2, "0")}`);
  }

  // O que importa: continua na sala, e a outra ponta também.
  await ana.waitForTimeout(2000);
  await expect(ana).toHaveURL(new RegExp(`room=${code}`));
  await expect(bia).toHaveURL(new RegExp(`room=${code}`));

  // E ainda dá pra rolar depois disso.
  await ana.keyboard.press("Escape");
  await ana.getByRole("textbox", { name: /notação/i }).fill("1d20");
  await ana.getByRole("button", { name: /^rolar/i }).click();
  await expect(bia.getByText("1d20", { exact: false }).first()).toBeVisible({ timeout: 15_000 });
});
