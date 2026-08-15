// Notas de versão mostradas em Sobre. Web e Android saem juntos por versão
// (ver AGENTS.md), então uma lista só descreve os dois — mas não há camada
// compartilhada de texto estático (só o rules-engine é), então esta lista é
// mantida a mão em espelho de apps/android/.../Changelog.kt. Atualizar as
// duas no mesmo commit que muda `versionName` em build.gradle.kts.

export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.13.8",
    date: "2026-08-15",
    notes: [
      "Vantagem e desvantagem também no PbtA (2d6 e o 2d10 do Kult) e no Roll Under, quando a rolagem é um dado só (ex.: 1d20).",
      "O resultado agora mostra contra o que foi medido (CD, perícia, valor testado...), não só sucesso/falha.",
      "No overlay do Android, segurar um dado tira ele do pool — antes só dava pra limpar tudo.",
      "Corrige cartões do overlay (compor, histórico, sala) cortados em paisagem — agora rolam e reposicionam pra caber na tela.",
    ],
  },
  {
    version: "0.13.7",
    date: "2026-08-14",
    notes: [
      'Corrige o menu "Sim/Não" (ex.: Vantagem do Fractal) ilegível no overlay do Android em alguns aparelhos.',
    ],
  },
  {
    version: "0.13.6",
    date: "2026-08-14",
    notes: ["Contato (site e e-mail) em Sobre, na web e no Android."],
  },
  {
    version: "0.13.5",
    date: "2026-08-10",
    notes: [
      "Aviso de versão nova aparece assim que a tela de configurações do Android abre, sem precisar fechar e reabrir o app.",
    ],
  },
  {
    version: "0.13.4",
    date: "2026-08-10",
    notes: ['Campo "Endereço do app" nas configurações avançadas do Android, pra quem usa build de teste.'],
  },
  {
    version: "0.13.3",
    date: "2026-08-07",
    notes: [
      "Corrige cor de dado escolhida na mão sendo apagada pelo preset toda vez que a tela de configurações do Android abria.",
    ],
  },
  {
    version: "0.13.2",
    date: "2026-08-07",
    notes: [
      "Corrige botão flutuante do Android virando um cartão vazio ao ligar/desligar.",
      "Aviso de versão nova, que ficava escondido no fim da tela, sobe pro topo.",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-08-07",
    notes: [
      "Formulário de verdade pros campos de sistema (CD, bônus, vantagem/desvantagem) — antes era preciso digitar JSON na mão no Android.",
      "Número da versão instalada visível nas configurações do Android, com aviso quando sai uma nova.",
      "Falha (miss/fail) também aparece em vermelho no overlay do Android, igual na web.",
    ],
  },
];
