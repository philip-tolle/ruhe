// Reaktive Sicht auf die Audio-Engine: Die Oberfläche liest nur `audio.snap` und ruft sonst
// direkt `engine.*` auf. Der Zustand wird bei jeder Änderung der Engine übernommen und
// zusätzlich jede Sekunde neu gelesen, damit die Restzeit weiterläuft. Der Sekundentakt ist
// reine Anzeige (Audio-Zeitsteuerung läuft nie über JS-Timer).
import { engine, type EngineSnapshot } from './engine'

export const audio: { snap: EngineSnapshot } = $state({ snap: engine.snapshot() })

let ticker: ReturnType<typeof setInterval> | null = null

// Der Takt läuft nur, solange etwas klingt oder pausiert ist und die Seite sichtbar ist.
function syncTicker(): void {
  const wanted = document.visibilityState === 'visible' && audio.snap.state !== 'idle'
  if (wanted && ticker === null) {
    ticker = setInterval(() => {
      audio.snap = engine.snapshot()
    }, 1000)
  } else if (!wanted && ticker !== null) {
    clearInterval(ticker)
    ticker = null
  }
}

// Die Engine ist ein Singleton für die ganze Lebensdauer der App: nie abmelden.
engine.subscribe((snap) => {
  audio.snap = snap
  syncTicker()
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') audio.snap = engine.snapshot()
  syncTicker()
})

/** Pause bzw. Weiter, je nach Zustand. Fehler von `play()` bleiben in der Engine. */
export function togglePause(): void {
  const done = audio.snap.state === 'playing' ? engine.pause() : engine.resume()
  done.catch(() => {})
}
