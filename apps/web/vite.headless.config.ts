// Build do bundle headless pra WebView do app Android
// (specs/04-android-overlay.md): rules-engine + profiles YAML embutidos
// (?raw) num unico arquivo IIFE, sem DOM, sem React, sem PWA.
// Uso: npm run build:headless (builda e instala nos assets do Android).

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist-headless",
    emptyOutDir: true,
    minify: true,
    lib: {
      entry: "src/headless.ts",
      formats: ["iife"],
      // O entry registra `rolai` em globalThis por conta propria; o `name`
      // so existe porque o formato iife do Rollup exige um.
      name: "RolaiHeadless",
    },
    rollupOptions: {
      output: {
        entryFileNames: "rolai-headless.js",
      },
    },
  },
});
