// Instala o bundle headless (dist-headless/rolai-headless.js) nos assets
// do app Android e gera, ao lado, dois artefatos derivados da MESMA fonte:
//
//  - systems.json: os sistemas (id, rotulo, inputs) — a tela de
//    configuracoes nativa monta o seletor a partir dele, sem WebView;
//  - OutcomeCatalog.kt: rotulos de outcome/pool, tom de cada outcome e as
//    familias de profile (apps/web/src/catalog.ts). Antes essas tabelas
//    eram copiadas na mao em OutcomeLabels.kt / OutcomeTone.kt /
//    ProfileFamilies.kt, e esquecer o lado Kotlin nao quebrava nada — so
//    fazia o overlay mostrar "desgraca_x1" em vez de "1 desgraça".
//
// Fonte unica de verdade: o proprio bundle recem-buildado (executado em
// Node; o entry registra `rolai` em globalThis).
// Uso: npm run build:headless (ja roda este script no final).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const bundle = path.join(webRoot, "dist-headless", "rolai-headless.js");
const assetsDir = path.resolve(
  webRoot,
  "..",
  "android",
  "app",
  "src",
  "main",
  "assets",
  "headless",
);

if (!fs.existsSync(bundle)) {
  console.error(`bundle nao encontrado: ${bundle} — rode vite build antes`);
  process.exit(1);
}

// A WebView headless nao tem `process` nem DOM: qualquer import que arraste
// React (ou outra lib que leia process.env.NODE_ENV) faz o bundle INTEIRO
// morrer no load com "Uncaught ReferenceError: process is not defined", e o
// efeito no aparelho e a rolagem simplesmente nao acontecer, sem erro.
//
// Aconteceu de verdade: `catalog.ts` importava `format.ts`, que importa
// `cardFormat` -> @letele/playing-cards -> React. Em Node passa (process
// existe), nos testes JVM passa (nao tocam a WebView) — so o aparelho
// reclama. Por isso a checagem e aqui, no gerador.
const codigo = fs.readFileSync(bundle, "utf8");
const proibidos = [
  [/\bprocess\.env\b/, "process.env — alguma dependencia so roda em Node/bundler"],
  [/reactjs\.org\/link/, "React entrou no bundle (import indireto de componente?)"],
];
for (const [padrao, motivo] of proibidos) {
  if (padrao.test(codigo)) {
    console.error(`bundle headless invalido: ${motivo}`);
    console.error("A WebView do Android nao carrega isso — a rolagem para de acontecer,");
    console.error("sem erro visivel. Ache o import novo e corte a dependencia.");
    process.exit(1);
  }
}

// Executa o IIFE em Node pra extrair systems() da fonte de verdade.
// O rules-engine so precisa de globalThis.crypto (Node 18+).
await import(pathToFileURL(bundle).href);
const rolai = globalThis.rolai;
if (!rolai || typeof rolai.systems !== "function") {
  console.error("o bundle nao registrou globalThis.rolai — entry quebrado?");
  process.exit(1);
}
const systems = rolai.systems();
JSON.parse(systems); // valida que e JSON parseavel

fs.mkdirSync(assetsDir, { recursive: true });
fs.copyFileSync(bundle, path.join(assetsDir, "rolai-headless.js"));
fs.writeFileSync(path.join(assetsDir, "systems.json"), systems);
console.log(`instalado em ${assetsDir}: rolai-headless.js, systems.json`);

if (typeof rolai.catalog !== "function") {
  console.error("o bundle nao expoe rolai.catalog() — headless.ts desatualizado?");
  process.exit(1);
}
const catalogPath = path.resolve(
  webRoot,
  "..",
  "android",
  "app",
  "src",
  "main",
  "java",
  "app",
  "meioorc",
  "rolai",
  "OutcomeCatalog.kt",
);
fs.writeFileSync(catalogPath, renderCatalogKotlin(JSON.parse(rolai.catalog())));
console.log(`gerado ${catalogPath}`);

/** Escapa uma string pra literal Kotlin (aspas, barra e cifrao de template). */
function kt(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$")}"`;
}

function renderMap(entries, indent = "        ") {
  return entries.map(([k, v]) => `${indent}${kt(k)} to ${kt(v)},`).join("\n");
}

function renderCatalogKotlin(catalog) {
  const tones = { failure: [], partial: [], success: [] };
  for (const [id, tone] of Object.entries(catalog.outcomeTones)) {
    if (tones[tone]) tones[tone].push(id);
  }
  const renderSet = (ids) => ids.map((id) => `        ${kt(id)},`).join("\n");

  const families = catalog.families
    .map(
      (f) => `        Family(
            key = ${kt(f.key)},
            label = ${kt(f.label)},
            shortLabel = ${kt(f.shortLabel)},
            members = listOf(
${f.members.map((m) => `                Member(${kt(m.system)}, ${kt(m.subLabel)}),`).join("\n")}
            ),
        ),`,
    )
    .join("\n");

  return `package app.meioorc.rolai

// GERADO por apps/web/scripts/install-headless.mjs — NAO EDITE NA MAO.
// Fonte: apps/web/src/catalog.ts (que le format.ts e profileFamilies.ts).
// Regenerar: npm run build:headless -w @rolai/web
//
// Isto e APRESENTACAO, nunca regra: quem decide o outcome sao as
// outcome_rules dos YAMLs, calculadas pela WebView headless (AGENTS.md).
// Id que nao estiver aqui cai no proprio id (rotulo) e em NEUTRAL (tom) —
// nunca uma falha pintada de verde.

internal object OutcomeCatalog {

    val LABELS: Map<String, String> = mapOf(
${renderMap(Object.entries(catalog.outcomeLabels))}
    )

    val GROUP_LABELS: Map<String, String> = mapOf(
${renderMap(Object.entries(catalog.groupLabels))}
    )

    val FAILURE: Set<String> = setOf(
${renderSet(tones.failure)}
    )

    val PARTIAL: Set<String> = setOf(
${renderSet(tones.partial)}
    )

    val SUCCESS: Set<String> = setOf(
${renderSet(tones.success)}
    )

    data class Member(val system: String, val subLabel: String)

    data class Family(
        val key: String,
        val label: String,
        val shortLabel: String,
        val members: List<Member>,
    )

    val FAMILIES: List<Family> = listOf(
${families}
    )
}
`;
}
