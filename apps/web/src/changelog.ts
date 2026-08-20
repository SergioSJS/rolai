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
    version: "1.3.0",
    date: "2026-08-20",
    notes: [
      "Som de carta no Android: puxar carta no aparelho — ou receber a de outro jogador na sala — agora faz barulho. Antes era mudo nos dois sentidos.",
      "Som no modo stream/OBS: o palco subia sem áudio quando a aba não estava em primeiro plano (o caso de toda Browser Source) e nunca mais tentava. Agora liga sozinho assim que a aba aparece, e a carta também toca.",
      "Corrigido: arrastar o seletor de cor do dado dentro de uma sala derrubava quem mexeu para fora dela — cada movimento reabria a conexão e estourava o limite do servidor.",
      "Corrigido: trocar a cor dos dados em sala anunciava só o slot 1, e a mesa continuava vendo os dados 2 e 3 na cor antiga até a próxima entrada.",
      "Android: o campo Servidor (avançado) passa a aceitar um backend na rede local, não só via cabo USB.",
      "Android: quando a sala cai, o motivo aparece no log em vez de só 'reconectando…'.",
      "App mais leve para abrir: a cena 3D do baralho saiu do carregamento inicial (-30% no pacote de entrada).",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-08-20",
    notes: [
      "Vampiro / WoD v5: contagem automática de sucessos (≥6), bônus de par de 10s (+2 cada par) e destaque visual de dados (borda verde ≥6, dourada 10, vermelha 1 na Fome).",
      "Layout hierárquico no resultado do overlay Android: headline grande colorida pelo desfecho + detalhe menor com pools nomeados.",
      "Corrigido: dados 3D perdiam cores de slot na segunda rolagem ao trocar de modo (ex.: Vampiro → livre → Vampiro).",
      "Corrigido: compositor apagava notação de slot ao clicar botão de dado (1[d20]).",
      "Corrigido: rolagem multi-grupo (1[1d6] + 2[2d6]) sem grand total.",
    ],
  },
  {
    version: "1.1.1",
    date: "2026-08-19",
    notes: [
      "Personalização independente dos 3 Slots de Cores de Dados (Primário, Secundário e Terciário) nas preferências e sincronização em sala.",
      "Suporte completo a dados 3D multi-cores por grupo e sistema (cada pool de dados cai com a sua respectiva cor e material na mesa).",
      "Adicionados perfis oficiais para Trophy Dark e Trophy Gold com mecânica de Forçar (Push), dados claros e escuros/ruína.",
      "Suporte completo a Year Zero Engine e Forbidden Lands com pools independentes de Base, Perícia e Equipamento e dano por 1s.",
      "Formatação visual rica no histórico e logs do overlay, com nomes destacados, cores por slot e desfechos semânticos.",
      "Seletores e menus de sistemas organizados em ordem alfabética.",
    ],
  },
  {
    version: "1.0.1",
    date: "2026-08-16",
    notes: [
      "Histórico do overlay com ordenação correta (mais recentes no topo) e tags de jogadores destacadas.",
      "Formatação rica de rolagens com múltiplos grupos e cartas (Firelights e Ironsworn) no overlay.",
      "Correção na exibição e ciclo de fade do palco de cartas do overlay.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-08-16",
    notes: [
      "Motor de baralho de cartas com embaralhamento determinístico, saques, modos de descarte e sincronização em sala.",
      "Palco de cartas 3D (Three.js) com física e modo 2D leve com efeito flip de cartas.",
      "Efeitos sonoros reais gravados de manuseio e embaralhamento de cartas (Kenney Casino Audio — CC0).",
      "Suporte ao sistema Firelights ({2d6+mod} vs {2c}) e rolagens com termos de cartas (notação livre).",
      "Teclado de dados com d2 (moedinha 3D), d3, d66 e cartas; nova aba dedicada de Baralho no painel flutuante.",
      "Seção independente de Desempenho e Qualidade Gráfica nas configurações.",
    ],
  },
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
