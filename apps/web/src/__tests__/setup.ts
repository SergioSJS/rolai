import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

afterEach(cleanup);

// O jsdom e compartilhado pelo arquivo de teste inteiro: sem limpar, uma
// preferencia salva num teste (tema, sistema, estilo do dado) vaza pro
// proximo e o App comeca em outro estado.
beforeEach(() => {
  window.localStorage.clear();
});
