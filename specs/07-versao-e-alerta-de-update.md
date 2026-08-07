# 07 — versão à vista e aviso de APK novo

## Objetivo

Quem instalou o APK uma vez ficava naquela versão pra sempre. Não há Play
Store no caminho (a distribuição é pelas Releases do GitHub —
`.github/workflows/release.yml`), então não existe atualização automática nem
jeito de saber o que está rodando no aparelho.

O app passa a mostrar a versão instalada e a avisar, na própria tela que abre,
quando existe uma Release mais nova.

## Escopo

- `UpdateCheck` (`apps/android/.../UpdateCheck.kt`): consulta
  `GET https://api.github.com/repos/SergioSJS/rolai/releases/latest`, compara
  `tag_name` com `BuildConfig.VERSION_NAME` e devolve a Release quando ela é
  maior.
- `SettingsActivity` (que é o **launcher** do app, não uma tela escondida)
  mostra `Rolaí <versão>` e, se houver novidade, um bloco tocável que abre a
  página da Release no navegador.

### Regras que não são detalhe

- **Falha é silêncio.** Sem rede, com a API fora do ar, ou no limite de
  requisições anônimas do GitHub, a tela não mostra aviso nenhum. O app roda
  100% offline menos sala (AGENTS.md) — um aviso de update não pode ser o que
  quebra isso.
- **Nada é baixado nem instalado pelo app.** O aviso abre a página; quem
  instala é a pessoa. Baixar o APK sozinho exigiria `REQUEST_INSTALL_PACKAGES`,
  e o projeto só pede permissão estritamente necessária (`docs/security.md`).
- **Nenhuma identificação.** GET anônimo, sem token e sem nada do aparelho.
- **Comparação é numérica, campo a campo.** Alfabeticamente `"0.9.0"` é maior
  que `"0.12.0"`; o projeto já passou da 0.9, então comparar como texto mandaria
  "atualizar" para uma versão mais velha. Coberto por teste.
- **Uma consulta a cada 6h** (`MIN_INTERVAL_MS`), com cache em memória: abrir a
  tela dez vezes não vira dez GETs.

## Fora de escopo

- Baixar ou instalar o APK pelo app.
- Notificação fora do app (barra de status) — o aviso vive na tela que a pessoa
  abre.
- Canal de beta/pre-release: `releases/latest` já ignora prerelease.

## Critérios de aceite

1. A versão instalada aparece na tela de configurações.
2. Com uma Release mais nova publicada, o bloco aparece e abre a página dela.
3. Em modo avião, a tela abre igual e sem aviso — nada de erro, toast ou espera.
4. `./gradlew testDebugUnitTest` verde, incluindo a comparação numérica.

## Verificação feita (2026-08-07)

- 8 testes JVM em `UpdateCheckTest` (normalização, comparação numérica, corpo
  sem tag, corpo que não é JSON, fallback de URL).
- Resposta real da API conferida: `tag_name: "v0.12.4"` e `html_url` no formato
  esperado pelo parser.
- Confirmação visual no aparelho ficou pendente (Poco estava bloqueado na hora).
