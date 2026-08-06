import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { StreamApp } from "./StreamApp";
import { parseStreamParams } from "./stream";
import "./styles.css";

// `?room=CODIGO&stream=1` e outra pagina: modo stream/OBS (so os dados,
// fundo alpha/chroma, cliente espectador). Qualquer outra URL e o app normal.
const stream = parseStreamParams(window.location.search);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {stream === null ? <App /> : <StreamApp options={stream} />}
  </React.StrictMode>
);
