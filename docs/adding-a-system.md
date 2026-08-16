# Adicionando um sistema de rolagem novo

Checklist nascido de uma sessão (2026-08-13) que levou vários rounds de "já
corrigi" seguidos de "ainda tá quebrado" — cada camada (motor, web, Android)
foi tratada como pronta sem checar as outras, e o mesmo bug de fundo voltou
disfarçado de bug novo umas quatro vezes. Leia isto ANTES de abrir um profile
YAML novo, e de novo antes de dizer que terminou.

## A regra de fundo

Todo bug caro desta sessão teve a mesma forma do "Armadilha recorrente" do
`AGENTS.md`: **algo que existe sendo tratado como algo que funciona**.

- o bundle `assets/headless`/`assets/stage` existe no APK → não quer dizer
  que é a build de hoje;
- `format.ts` ter o label do outcome → não quer dizer que
  `OutcomeLabels.kt` também tem (são dois arquivos, cópia manual, o motor
  não gera nenhum dos dois);
- `lastRollAction` estar setado → não quer dizer que reflete o que tá nos
  campos AGORA (é uma closure de valores capturados na última rolagem de
  verdade, não uma leitura fresca de `RolaiSettings`);
- o painel do overlay estar "fechado" → pode ser `Mode.COLLAPSED` (o "—" do
  cabeçalho) ou o botão "fechar" (desliga o botão flutuante inteiro,
  outra coisa completamente diferente).

Sempre que alguma coisa "simplesmente não aparece" ou "volta pro valor
antigo" sem erro nenhum, suspeite de uma dessas quatro antes de procurar em
outro lugar.

## A mecânica encaixa nos `roll_type` que já existem?

Pare aqui antes do checklist. `simple`/`comparison`/`multi`/`overlay`
(`docs/system-profiles.md` tem o schema completo de cada um) cobrem "um
campo", "dois campos competindo", "N campos independentes" e "regra sobre
o que o compositor rolar", respectivamente. A maioria dos sistemas novos
cabe em algum desses sem tocar em código de motor — só escrever o YAML.

Mas `multi` e `overlay` NÃO existiam até uma sessão anterior desta mesma
funcionalidade: foram criados porque Infaernum-ideias/wod5 (dois campos
que NÃO competem) e roll_under (regra sobre notação livre, sem dado
próprio) não cabiam em `simple`/`comparison`. Se o sistema que você está
adicionando tem uma mecânica que genuinamente não cabe em nenhum dos
quatro, você vai precisar de um `roll_type` novo (ou uma propriedade nova
em `ProfileField`/`ProfileInput`, tipo `success_rule` foi) — e isso NÃO é
"só YAML", toca em toda a cadeia:

1. `packages/rules-engine/src/parser.ts` — se a mecânica precisa de uma
   notação que a gramática atual não representa (`{a} vs {b}` e
   `{a} + {b} + ...` são os dois padrões de grupo que existem hoje).
2. `packages/rules-engine/src/profile.ts` — `SystemProfile.rollType`,
   `validateFields`, `parseProfile`, e o branch correspondente em
   `rollWithProfile`/`rollOverlay`.
3. `services/backend/app/schemas.py` — o `Literal` de `roll_type` e os
   campos de `ProfileField`/`ProfileInput` (validação de profile custom
   vindo da API).
4. `apps/web/src/headless.ts` — a bridge `RolaiHeadlessApi`/
   `RolaiSystemInfo` que a WebView headless do Android consome.
5. `apps/android/.../ProfileForm.kt` — `SystemInfo`/`ProfileInput` e o
   parser de `systems.json` (`parseSystems`/`parseInputs`) precisam
   entender a propriedade nova, senão ela chega no Kotlin e é
   silenciosamente ignorada — sem erro, o campo simplesmente não aparece
   no formulário do overlay nem da `SettingsActivity`.
6. `docs/system-profiles.md` — documentar o `roll_type`/propriedade novo
   pra próxima sessão não repetir esta investigação do zero.

Só DEPOIS de ampliar isso tudo (ou confirmar que não precisa) é que faz
sentido seguir pro checklist normal abaixo.

Existe uma terceira categoria, mais sutil que "precisa de `roll_type`
novo": a mecânica cabe num `roll_type` existente, mas um dos seus números
não é NENHUM input isolado — é dois inputs visíveis combinados (ex.:
Fractal — tamanho da pool = Fatos aplicáveis capado em 3, +1 se teve
Vantagem). `field.dice`/`field.modifier` só substituem `{input.id}`
literalmente, sem aritmética — isso não cabe no YAML sozinho. Ver
`docs/system-profiles.md#input-derivado-combina-dois-inputs-num-valor-que-só-o-motor-usa`
pra a solução (input "fantasma" preenchido por uma função só, chamada por
`roll.ts` E `headless.ts`) antes de tentar inventar uma sintaxe nova pro
YAML.

## Checklist, nesta ordem

1. **Motor** (`packages/rules-engine/profiles/*.yaml`) — o profile, com
   teste em `packages/rules-engine/test/profiles/`. O schema completo
   (roll_type, fields, inputs, outcome_rules, gramática da notação) está
   em `docs/system-profiles.md` — leia antes de escrever o YAML do zero, e
   copie a estrutura de um profile parecido já existente (`d20.yaml` pra
   "rolar vs dificuldade", `pool_d6.yaml` pra "contar sucessos num pool",
   `wod5.yaml` pra "campos independentes"). Input que não deveria ser
   obrigatório (dificuldade, CD opcional) leva `required: false` — o
   mecanismo de pular `outcome_rules` que referenciam input ausente já
   existe (`evaluateOutcomeRules`/`referencesAny`), não precisa de
   tratamento especial por profile. Campo com dado zero-válido (pool que
   pode chegar a `0d6`) leva `zero_dice_fallback`.
2. **Web** — registrar o YAML em `apps/web/src/profiles.ts`; todo
   `outcome`/`outcome_flags` novo precisa de entrada em
   `OUTCOME_LABELS` **e** `OUTCOME_TONES` (`apps/web/src/format.ts`) — sem
   isso a UI mostra o id cru (`FACANHA_X3`) em vez do texto. Se o sistema
   tem sub-modos (tipo Infaernum), registrar a família em
   `apps/web/src/profileFamilies.ts`. Testar no navegador ponta a ponta
   ANTES de tocar no Android — é onde o risco técnico é mais barato de
   validar (mesma lógica do `AGENTS.md` sobre a ordem rules-engine → web →
   Android). Detalhes que passam batido dentro desse passo:
   - **Id de outcome é compartilhado entre profiles.** `strong_hit` é
     PbtA E Ironsworn ao mesmo tempo — mudar o label de um muda o do
     outro. Antes de renomear, `grep` o id em todos os `profiles/*.yaml`;
     se só UM profile deveria mudar, ele precisa de um id próprio (ex.
     `pbta_strong_hit`), não reusar o de outro sistema.
   - **Resultado com formato incomum** (par verbo/substantivo, contagem
     quantizada tipo "2 milagres") não cai bonito no
     headline+flags padrão do `ResultDisplay.tsx`. Se o outcome novo é
     assim, precisa de um branch dedicado ali (`result.profile === "..."`)
     — ver como `infaernum`/`infaernum_ideias` fizeram com
     `.result-tally`/`.result-tally-row`, senão o outcome aparece como
     headline gigante fora de contexto.
   - **Testes com lista de sistemas fixa quebram.** `headless.test.ts` (e
     qualquer teste parecido) pode ter um array hardcoded com os ids de
     todos os sistemas — adicionar um profile novo estoura esse array e o
     teste falha por contagem, não por lógica. Atualize a lista junto.
   - **Dois campos com o mesmo label colidem em teste/leitor de tela.** Se
     o profile novo tem um input chamado "Modificador" e o compositor
     livre também tem um estepper "Modificador", `getByLabelText`
     encontra dois e o teste (ou o leitor de tela) fica ambíguo — dê
     `aria-label` distinto pros dois quando coexistirem na mesma tela
     (`RollPanel.tsx`/`ComposerBar.tsx` já fazem isso pra outros campos,
     copie o padrão).
   - **Mudou o schema, não só o profile?** Ver a seção "A mecânica encaixa
     nos `roll_type` que já existem?" no topo deste documento — schema
     novo toca motor, backend, as DUAS bridges (web `headless.ts` e
     Android `ProfileForm.kt`) e a doc de referência, não só o backend.
3. **Regenerar os bundles do Android — sempre, mesmo que "só mudou o
   web"**:
   ```bash
   npm run build:headless -w @rolai/web
   npm run build:stage    -w @rolai/web
   ```
   O primeiro é o motor de cálculo que a `HeadlessRoller` usa; o segundo é
   o palco 3D + `ResultDisplay`/`format.ts` que a `DiceStageWindow` mostra
   por cima do overlay. São dois builds INDEPENDENTES — regenerar um e
   esquecer o outro é como não regenerar nenhum: metade da tela fica
   velha sem erro nenhum. Confirme com `stat` nos dois lados se tiver
   dúvida (`apps/android/app/src/main/assets/stage/index.html` mais novo
   que o `ResultDisplay.tsx` que você acabou de editar).
4. **Android nativo** — isto NÃO vem de bundle, é código Kotlin duplicado à
   mão e por isso esquecido com facilidade:
   - `OutcomeLabels.kt` and `OutcomeTone.kt` — mesmos ids que você acabou de
     adicionar em `format.ts`, cópia manual dos dois mapas (label E tom).
   - `ProfileFamilies.kt` — mesma família que você registrou em
     `profileFamilies.ts` do lado web. Web e Android têm **dois arquivos
     separados** para a mesma família; um sem o outro deixa metade da UI
     sem os modos.
   - Família ou sistema com input precisa aparecer no **overlay flutuante**
     (`OverlayView`/`OverlayService` — a caixa de rolar de dentro de outro
     app), não só na `SettingsActivity`. O layout do overlay usa 3 abas
     principais (`[ SISTEMA ] [ DADOS ] [ BARALHO ]`), onde a primeira aba
     leva o nome enxuto do sistema via `systemShortLabel` (ex: "Firelights",
     "Ironsworn", "WoD v5"), sem descrições longas.
   - O botão "ROLAR" do sistema dentro do overlay leva o formato
     `ROLAR ${systemShortLabel.uppercase()}` (ex: `ROLAR FIRELIGHTS`), com o
     mesmo estilo chamativo de destaque do botão do compositor livre.
5. **Testar no aparelho físico com o fluxo completo**, não só abrir e
   olhar: configurar valores → rolar pelo botão do sistema → minimizar com
   o "—" (não o "fechar") → reabrir → tocar na mini-bolha "rolar" do fan →
   confirmar que repete a MESMA rolagem, com os MESMOS valores. Depois:
   editar um campo SEM rolar → minimizar → mini-bolha de novo → confirmar
   que reabre o formulário com o valor novo em vez de rolar em silêncio o
   valor antigo. Os dois fluxos têm que passar — só testar um dos dois foi
   exatamente como o bug desta sessão sobreviveu disfarçado de corrigido.

## `lastRollAction`, especificamente

Qualquer caminho novo que rola dado no overlay tem que setar
`lastRollAction` (`OverlayService.kt`) do jeito que `rollWithInputs`,
`rollOverlayNow` e `rollNotation` já fazem — é uma closure sobre os valores
usados NAQUELA rolagem, não uma referência viva a `RolaiSettings`.

Fechar o painel (`Mode.PANEL` → `Mode.COLLAPSED`, via `persistSystemInputs`
em `OverlayService.kt`) só deve invalidar esse valor quando o campo (ou,
pra sistema `overlay` como o roll_under, a notação do compositor) MUDOU
desde o que foi de fato rolado — nem sempre (fechar depois de rolar
normalmente tem que preservar o `lastRollAction` certo que a própria
rolagem acabou de setar) nem nunca (editar e minimizar sem rolar tem que
invalidar, senão o próximo toque replica o valor velho em silêncio). As
duas pontas dessa comparação já existem: `settings.inputsJson` (salvo na
última rolagem real) contra `currentInputsJson()` (o que tá na tela agora).

## Gotchas de teste no aparelho

Três coisas que custaram tempo real numa sessão de teste via `adb` neste
overlay especificamente:

- **"fechar" desliga o overlay inteiro** (`RolaiSettings.setOverlayEnabled(false)`
  + para o `OverlayService`) — NÃO é "minimizar". Collapse de verdade é o
  "—" no cabeçalho do painel. Se a bolha desaparecer depois de um toque e
  não houver crash/exception no `logcat`, confira se o toque caiu em
  "fechar" em vez do "—" antes de suspeitar de bug.
- **`adb shell am force-stop <pkg>` quebra o toggle "Ativar botão
  flutuante"** neste device/OS — ele volta pra "desligado" e
  `start-foreground-service` direto do shell NÃO reativa (falta permissão
  WIU de foreground; `dumpsys activity services` mostra `app=null`). Pra
  religar, abra a `SettingsActivity` e toque o switch de dentro do
  processo do próprio app — depois disso `dumpsys activity services`
  mostra `app=ProcessRecord{...}` e `isForeground=true`. Evite
  `force-stop` no meio de um teste do overlay; se já rodou, é assim que
  se recupera.
- **`uiautomator dump` só enxerga o overlay num `Mode` focável**
  (`PANEL`/`HISTORY`/`ROOM`) — `COLLAPSED`/`FAN` são janelas
  `FLAG_NOT_FOCUSABLE` (clique atravessa) e nunca aparecem na árvore de
  acessibilidade (dump vem com zero nós `meioorc`). Pra bolha/fan, é
  matemática de pixel em cima do screenshot mesmo (lembrar do fator 1.2x
  entre a imagem exibida pela ferramenta e a resolução real do
  aparelho). Assim que algo focável abrir (o painel), trocar pra
  `uiautomator dump` + regex em `bounds="[...]"` — muito mais confiável
  que recalcular offset de pixel a cada rolagem que engorda o histórico
  na tela.

## Antes de dizer que terminou

```bash
cd packages/rules-engine && npm test
cd apps/web && npm test && npx tsc --noEmit
cd services/backend && uv run pytest && uv run ruff check . && uv run mypy .
cd apps/android && ./gradlew testDebugUnitTest assembleDebug
```
Os quatro verdes não substituem o teste manual no aparelho do passo 5 — eles
provam que o código compila e a lógica isolada bate, não que o botão certo
rola o dado certo depois de minimizar.
