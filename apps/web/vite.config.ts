import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Caminhos RELATIVOS no HTML gerado. O app Android serve este mesmo build
  // de dentro do APK, numa subpasta (assets/stage/) — com o padrao "/" o
  // bundle pedia "/assets/..." da raiz do host e nada carregava: o dado 3D
  // simplesmente nao aparecia. Na web o efeito e nulo (servido da raiz).
  base: "./",
  // Porta fixa fora do range padrao do Vite (5173+) pra nao colidir com
  // outros dev servers da maquina.
  server: {
    port: 5273,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Offline primeiro (PWA de mesa): precache de TUDO que a rolagem
      // local precisa — incluindo as texturas .webp dos dados, que o padrao
      // do workbox nao cobre. Sem sala obviamente nao ha (rede e so relay).
      includeAssets: ["texture-felt.png"],
      workbox: {
        // mp3 entra: a lib faz `throw` no initialize() se um arquivo de som
        // faltar. Sem precache, o app offline perderia o renderer inteiro —
        // nao so o audio.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,webmanifest,mp3,woff2}"],
        // config.js e resolvido em RUNTIME pelo container (entrypoint le as
        // envs); precachear congelaria a URL do backend do build.
        globIgnores: ["**/config.js"],
        // O chunk da dice-box-threejs passa de 500KB; texturas somam alguns
        // MB. O teto padrao (2MB/arquivo) ja basta, mas deixamos folga.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: "index.html",
      },
      manifest: {
        // App servido da raiz de rolai.app (ver docs/deployment.md).
        id: "/",
        start_url: "/",
        name: "Rolaí",
        short_name: "rolai",
        description: "Dice roller multiplayer para mesas de RPG",
        lang: "pt-BR",
        display: "standalone",
        background_color: "#111418",
        theme_color: "#1D9E75",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/__tests__/setup.ts"],
  },
});
