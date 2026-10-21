// Anzeigezeit eines laufenden Programms: pro Bild von der Audio-Uhr gelesen (Pausen zählen nicht).
// Nur Anzeige; alles Hörbare ist auf der Audio-Uhr eingeplant. In einer verborgenen Seite ruht
// requestAnimationFrame, beim Zurückkehren stimmt das nächste Bild sofort wieder.
import { engine } from '../audio/engine'
import { audio } from '../audio/engine-store.svelte'

/**
 * Sekunden seit Programmstart, solange `active()` gilt. Die Schleife läuft nur, solange die Engine
 * spielt. Bei Pause und Fortsetzen wird neu gezeichnet: Beim Pausieren steht die Audio-Uhr erst
 * einen Moment später, darum läuft die Schleife noch bis zwei Bilder denselben Stand zeigen.
 * Gehört in die Initialisierung einer Komponente (legt einen Effekt an).
 */
export function programClock(active: () => boolean): { readonly elapsed: number } {
  let elapsed = $state(engine.programElapsed() ?? 0)
  // Beide als abgeleitete Werte: Sie melden nur ihren Wechsel, nicht jede neue Momentaufnahme der
  // Engine. Der Sekundentakt ersetzt `audio.snap` auch in der Pause; läse der Effekt `active()` oder
  // den Zustand direkt, finge er dabei jedes Mal die Schleife neu an, gleich was der Aufrufer übergibt.
  const isActive = $derived(active())
  const playing = $derived(audio.snap.state === 'playing')

  $effect(() => {
    if (!isActive) return
    const running = playing
    let previous: number | null = null
    let frame = requestAnimationFrame(function tick() {
      const now = engine.programElapsed()
      if (now !== null) elapsed = now
      if (running || now !== previous) {
        previous = now
        frame = requestAnimationFrame(tick)
      }
    })
    return () => cancelAnimationFrame(frame)
  })

  return {
    get elapsed() {
      return elapsed
    },
  }
}
