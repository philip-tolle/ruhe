import { tageszeit, type Tageszeit } from '../time/tageszeit'

// Die Stimmung der App (morgen/tag/abend) folgt der Uhr: `data-tageszeit` am <html> trägt die Farben
// (src/app.css), `tageszeitUi.current` die Bildschirme (Begrüßung, Vorschlag). Den ersten Wert setzt
// schon das Inline-Skript in index.html vor dem ersten Zeichnen; von hier an hält ihn `followTageszeit`.

const MOODS: readonly string[] = ['morgen', 'tag', 'abend'] satisfies Tageszeit[]

function initial(): Tageszeit {
  const preset = document.documentElement.dataset.tageszeit
  return preset && MOODS.includes(preset) ? (preset as Tageszeit) : tageszeit(new Date())
}

export const tageszeitUi: { current: Tageszeit } = $state({ current: initial() })

/**
 * Wert einer Stimmungsfarbe, bei dem `root` ankommt. Läuft die Überblendung (1,5 s, nur ohne
 * Bewegungswunsch), meldet der berechnete Stil noch ihren Anfang; dann zählt ihr Endwert.
 */
function settledValue(root: HTMLElement, name: string): string {
  const now = getComputedStyle(root).getPropertyValue(name).trim() // startet auch eine fällige Überblendung
  for (const animation of root.getAnimations()) {
    if (!(animation instanceof CSSTransition) || animation.transitionProperty !== name) continue
    const end = (animation.effect as KeyframeEffect | null)?.getKeyframes().at(-1)?.[name]
    if (typeof end === 'string' && end.trim() !== '') return end.trim()
  }
  return now
}

/**
 * Setzt die Stimmung sofort und hält sie danach aktuell: zu jeder vollen Minute und beim Zurückkehren
 * in die App (`visibilitychange`). Der Timer steuert nur die Anzeige, kein Audio. Gibt das Aufräumen zurück.
 */
export function followTageszeit(now: () => Date = () => new Date()): () => void {
  const root = document.documentElement
  let timer: ReturnType<typeof setTimeout> | undefined

  function apply() {
    // Stimmung und Attribut zuerst: Sie tragen die Oberfläche und dürfen an der Statusleiste nicht scheitern.
    const mood = tageszeit(now())
    tageszeitUi.current = mood
    if (root.dataset.tageszeit !== mood) root.dataset.tageszeit = mood
    // Die Statusleiste (Android) bekommt die Farbe oben am Himmel. Lässt sie sich nicht bestimmen, bleibt
    // theme-color, wie es war.
    try {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      if (meta) {
        const color = settledValue(root, '--sky-top')
        if (color !== '') meta.content = color
      }
    } catch {
      // Nur die Statusleiste bleibt in der alten Farbe; die Stimmung steht schon.
    }
  }

  // Nächste Prüfung zur nächsten vollen Minute; danach wieder.
  function schedule() {
    clearTimeout(timer)
    const t = now()
    const delay = 60_000 - (t.getSeconds() * 1000 + t.getMilliseconds())
    timer = setTimeout(() => {
      // Auch wenn apply scheitert, läuft der Takt weiter.
      try {
        apply()
      } finally {
        schedule()
      }
    }, delay)
  }

  // Zurück in der App (nach Stunden im Hintergrund, nach dem Entsperren): sofort, ohne auf den Takt
  // zu warten, und der Takt beginnt neu (gedrosselte Timer im Hintergrund kommen sonst zu spät).
  function onVisibilityChange() {
    if (document.visibilityState !== 'visible') return
    apply()
    schedule()
  }

  apply()
  schedule()
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
