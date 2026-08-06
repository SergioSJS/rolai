// Estado de conectividade do navegador. A rolagem e 100% local
// (rules-engine no bundle), entao "offline" so significa "sem salas" —
// ver docs/architecture.md ("Sem sala e o modo padrao").
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
