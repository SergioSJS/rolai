# Checklist de teste manual (antes de subir versão)

Nasceu da sessão de 2026-08-20, em que uma bateria automatizada inteira
passou verde e o teste na mesa achou cinco problemas em vinte minutos —
nenhum deles do trabalho que estava sendo revisado.

A regra que organiza este documento: **teste o que nenhuma suíte alcança.**
O que já é coberto por `npm test`, `pytest` e `./gradlew test` não entra
aqui — perder tempo com isso é o que faz o checklist ser abandonado.

## Antes de começar: prepare o ambiente

Três armadilhas de ambiente já se disfarçaram de bug de produto. Elimine as
três antes de julgar qualquer coisa.

```bash
# 1. suba backend e web
cd services/backend && uv run python scripts/dev_local.py     # ou uvicorn app.main:app
cd apps/web && npm run dev -- --host

# 2. regenere o que o APK embarca (o palco fica velho EM SILÊNCIO)
npm run build:headless -w @rolai/web
npm run build:stage    -w @rolai/web

# 3. instale e RELIGUE o botão flutuante
cd apps/android && adb install -r app/build/outputs/apk/debug/app-debug.apk
```

- **Depois de `adb install -r`, desligue e religue o botão flutuante.** A
  WebView do palco continua com o `index.html` do APK ANTERIOR, cujos assets
  já não existem: você vê um retângulo branco com ícone de imagem quebrada e
  jura que o palco quebrou.
- **Prefira o servidor na rede** (`ws://<ip-do-mac>:8420` em "Servidor
  avançado") em vez de `adb reverse`. O túnel USB cai sozinho — três vezes
  numa tarde — e o sintoma é "conectando… / reconectando…" para sempre.
  Deixe "Endereço do app" no padrão, senão o palco 3D passa a vir pela rede
  e você perde o teste offline.
- **Quando algo falhar, olhe o motivo antes de teorizar**: `adb logcat | grep rolai`
  agora diz por que a sala caiu, e o backend loga `event=ws_open`/`ws_closed`
  com o código da sala.

---

## 1. Sala com duas pontas · ~5 min

Web e Android na mesma sala. É o fluxo com mais partes móveis e o menos
coberto por teste automatizado.

- [ ] Rolar dos dois lados; cada um vê o dado do outro **na cor de quem rolou**
- [ ] **Arrastar** (não clicar) o seletor de cor do dado 3, em sala. A outra
      ponta muda de cor uma vez, e **ninguém é expulso da sala**
- [ ] Trocar apelido em sala: reconecta e o roster atualiza nos dois
- [ ] Derrubar o backend com a sala aberta e subir de novo: reconecta sozinho
- [ ] Rolar com o backend fora do ar: aparece *"Sem conexão com a sala agora
      — essa rolagem ficou só com você"*. Rolagem que some calada é bug.
- [ ] Entrar por link (`?room=CODIGO`) numa aba nova: entra direto, sem modal

> Conferir no log do servidor: `grep rate_limited` tem que continuar vazio.
> Rajada de reconexão é o mecanismo que já expulsou gente da própria mesa.

## 2. Leitura do resultado no overlay Android · ~5 min

Tem teste de unidade para o texto e as cores, mas **nenhum vê pixel**.

- [ ] **Forbidden Lands** (3 pools): "base" / "perícia" / "equipamento" cada
      um na sua cor, dados ≥6 destacados
- [ ] **Vampiro v5**: headline com contagem de sucessos; fome em cor própria;
      10 em dourado
- [ ] **Ironsworn**: "ação vs desafio" na linha de detalhe
- [ ] **Infaernum**: várias flags na mesma linha, separadas por vírgula cinza
- [ ] **Baralho**: carta de copas/ouros em vermelho
- [ ] Histórico do overlay: nome de quem rolou em destaque, notação apagada

## 3. Som · ~3 min

Toda vez que o som quebrou, quebrou em silêncio — por definição, nenhuma
suíte percebe.

- [ ] Dado no app principal
- [ ] Dado na aba de stream **com a aba em primeiro plano**
- [ ] Dado na aba de stream **deixada em segundo plano durante o load**: sobe
      mudo (o console diz `aba em segundo plano: palco sem audio`) e o som
      **entra sozinho** quando você volta para ela
- [ ] Carta puxada no celular
- [ ] Carta puxada por outro jogador, ouvida no celular
- [ ] Carta na aba de stream
- [ ] Rolar dado no celular **não abaixa** a música que estiver tocando

## 4. Palco 3D · ~3 min

- [ ] Dado voa no app, no overlay do Android e na aba de stream
- [ ] **Modo avião no celular**: o dado 3D continua funcionando (palco vem do
      APK, não da rede)
- [ ] Puxar a primeira carta da sessão: entra em 3D, sem piscar o flip 2D
- [ ] Tiers "2D" e "texto puro" nas preferências continuam corretos

## 5. Preferências e sistemas · ~4 min

- [ ] Escolher um **modo que não é o primeiro da família** (ex.: Year Zero →
      Forbidden Lands), sair e voltar às configurações: o modo continua lá.
      *Este bug já apareceu duas vezes.*
- [ ] Trocar de sistema e conferir que a caixa de rolagem mostra o formulário
      certo, nos dois lados
- [ ] Alterar os 3 slots de cor e ver o preview mudar
- [ ] Entrar numa sala existente pelo celular com um código de 8 caracteres:
      entra normalmente (o aviso sobre o mínimo é informativo, não recusa)

## 6. Visual · ~3 min

Só depois de mexer no CSS ou no layout.

- [ ] Menu, painéis, resultado, modal de Preferências, Sala, histórico
- [ ] Janela estreita (mobile)
- [ ] Modo stream sobre fundo claro e sobre fundo escuro

---

## Onde falta teste — medindo antes de decidir

A cobertura é **local, de propósito**: serve pra escolher onde investir teste
antes de subir versão, não pra reprovar PR por decimal. Nenhuma delas roda no
CI.

```bash
npm run coverage -w @rolai/web                    # web    (HTML em coverage/)
cd services/backend && pytest --cov=app           # backend
cd apps/android && ./gradlew coverage             # android, testes JVM
```

Medido em 1.3.0:

| | cobertura de linhas |
| --- | --- |
| Backend | **93%** (774 linhas) |
| Web | **72%** (5.879 linhas) |
| Android (JVM) | **20%** (4.051 linhas) |

Os 20% do Android assustam menos do que parecem, e o detalhe explica por quê:

| classe | linhas | coberto |
| --- | --- | --- |
| `OutcomeCatalog` / `ProfileForm` | 190 | 100% |
| `RichTextPlan` | 88 | 95% |
| `ResultFormat` / `RolaiSettings` | 301 | 86% |
| `OverlayView` | 1125 | **0%** |
| `SettingsActivity` | 621 | **0%** |
| `OverlayService` | 485 | **0%** |

Activity, View e Service não rodam em JVM — o que os cobre é o instrumentado
(aparelho) e este checklist. O plano pra melhorar isso, em ordem de risco,
está em `docs/test-plan-android.md`. O número que importa acompanhar é o **da lógica
pura**: sempre que algo sai de dentro de uma tela, ele sobe. Foi o que
aconteceu na 1.3.0, quando ~310 linhas de leitura de resultado saíram de dois
arquivos a 0% para dois arquivos a 86–95%.

## O que este checklist NÃO cobre (e por quê)

| área | cobertura automatizada |
| --- | --- |
| Motor de regras | 181 testes — confie neles |
| Backend | 68 testes, **93% de linhas**, mais o smoke fim-a-fim |
| Formatação do resultado (Android) | 122 testes JVM |
| Sala (cliente, reducer, echo, hook) | 17 casos, 2 conferidos por mutação |

Do lado web, o que puxa os 72% pra baixo é o que exige WebGL de verdade:
`renderers/diceBox.ts` (492 linhas, 40%) e `cardScene3D.ts` (184 linhas, 0%).
Justamente o que a seção "Palco 3D" acima existe pra cobrir.

## Depois de aprovar

1. `npm run build:headless -w @rolai/web` e `build:stage` (de novo, se algo
   mudou durante o teste)
2. `apps/android/scripts/run-instrumented.sh` num aparelho — não roda no CI
3. Versão em: `package.json` (raiz, rules-engine, deck-engine, web),
   `versionCode`/`versionName` no `build.gradle.kts`
4. Notas de versão nas **duas** listas: `apps/web/src/changelog.ts` e
   `Changelog.kt` — elas aparecem na interface
5. `CHANGELOG.md`
