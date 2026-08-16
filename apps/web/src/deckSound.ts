// Som do baralho: assets de audio de cartolina gravada real (Kenney Casino Audio — CC0).
// Carrega os arquivos .ogg de public/sounds/cards/ e reproduz via Web Audio API com
// buffer em memoria e micro-variacao de pitch para cada carta soar viva e organica.
// jsdom (testes) nao implementa AudioContext/fetch de audio — vira no-op sem quebrar.

let sharedCtx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
const pendingFetches = new Map<string, Promise<AudioBuffer | null>>();

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    sharedCtx ??= new Ctor();
    if (sharedCtx.state === "suspended") void sharedCtx.resume();
    return sharedCtx;
  } catch {
    return null;
  }
}

function getBaseUrl(): string {
  if (typeof window === "undefined") return "./";
  const base = import.meta.env.BASE_URL || "./";
  return base.endsWith("/") ? base : `${base}/`;
}

async function loadBuffer(context: AudioContext, url: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(url);
  if (cached) return cached;

  const pending = pendingFetches.get(url);
  if (pending) return pending;

  const fetchPromise = (async () => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const arrayBuf = await resp.arrayBuffer();
      const decoded = await context.decodeAudioData(arrayBuf);
      bufferCache.set(url, decoded);
      return decoded;
    } catch {
      return null;
    } finally {
      pendingFetches.delete(url);
    }
  })();

  pendingFetches.set(url, fetchPromise);
  return fetchPromise;
}

function playBuffer(
  context: AudioContext,
  buffer: AudioBuffer,
  { volume = 0.8, pitchVariation = 0.08 }: { volume?: number; pitchVariation?: number } = {},
): void {
  try {
    const source = context.createBufferSource();
    source.buffer = buffer;

    // Micro-variacao de tom (± pitchVariation/2): cada saque de carta soa sutilmente unico
    if (pitchVariation > 0) {
      source.playbackRate.value = 1.0 + (Math.random() - 0.5) * pitchVariation;
    }

    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, context.currentTime);

    source.connect(gain);
    gain.connect(context.destination);

    source.start(context.currentTime);
  } catch {
    // Audio falhou — segue em silencio sem travar a interface
  }
}

export function playCardDraw(): void {
  const context = audioCtx();
  if (!context) return;

  const slideIdx = Math.floor(Math.random() * 8) + 1;
  const url = `${getBaseUrl()}sounds/cards/card-slide-${slideIdx}.ogg`;

  const cached = bufferCache.get(url);
  if (cached) {
    playBuffer(context, cached, { volume: 0.85, pitchVariation: 0.06 });
  } else {
    void loadBuffer(context, url).then((buf) => {
      if (buf) playBuffer(context, buf, { volume: 0.85, pitchVariation: 0.06 });
    });
  }
}

export function playCardShuffle(): void {
  const context = audioCtx();
  if (!context) return;

  const url = `${getBaseUrl()}sounds/cards/card-shuffle.ogg`;

  const cached = bufferCache.get(url);
  if (cached) {
    playBuffer(context, cached, { volume: 0.9, pitchVariation: 0.04 });
  } else {
    void loadBuffer(context, url).then((buf) => {
      if (buf) playBuffer(context, buf, { volume: 0.9, pitchVariation: 0.04 });
    });
  }
}


