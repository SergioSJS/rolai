# Roadmap de implementação

Ordem pensada pra reduzir risco cedo — cada etapa é testável isoladamente
antes da próxima começar. Não pule etapas.

1. **`01-rules-engine.md`** — parser + profiles. Zero rede, zero UI. Testável
   100% com `vitest`.
2. **`02-backend-relay.md`** — relay de sala em FastAPI. Testável com
   `pytest` + WS de teste, sem depender do frontend nem do rules-engine
   rodando de verdade (usa payloads mockados).
3. **`03-frontend-web.md`** — integra rules-engine + dice-box + conexão com
   o backend real. Esta é a etapa que valida o conceito fim-a-fim — depois
   dela, testável manualmente com duas abas do navegador.
4. **`04-android-overlay.md`** — só começa depois da 03 estar funcionando.
   TWA + Foreground Service + overlay.
5. **`05-deployment.md`** — compose files pros dois alvos (Hostinger e
   CasaOS), CI.

Cada spec abaixo define: objetivo, critérios de aceite, e o que fica
explicitamente fora de escopo naquela etapa (pra não misturar
preocupações). Ao terminar uma etapa, todos os critérios de aceite devem
passar antes de iniciar a próxima.
