import { defineConfig } from "@playwright/test";

/**
 * E2E de sala: dois navegadores de verdade contra o backend de verdade.
 *
 * Local, NÃO no CI (mesma decisão da cobertura, ver
 * docs/manual-test-checklist.md). Subir backend + Redis + web num runner e
 * lidar com timing de WebSocket custa mais do que este punhado de testes
 * paga — o valor deles é encurtar a seção 1 do checklist manual, não virar
 * portão de PR.
 *
 * Pré-requisito: backend em :8420 e `npm run dev` em :5273.
 * Uso: npm run e2e -w @rolai/web
 */
export default defineConfig({
  testDir: "./e2e",
  // Sala é assíncrona por natureza; o retry esconderia flakiness real.
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:5273",
    // Sem headless o teste rouba a tela de quem estiver trabalhando.
    headless: true,
  },
  reporter: [["list"]],
});
