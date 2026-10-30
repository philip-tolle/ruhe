// Die Klangschale im Abschluss des Morgen-Starts (Spec M10 §2.3): ein einzelner Anschlag, ohne Hintergrund. „Feuer
// und vergiss“: `playChime` kehrt sofort zurück und schluckt jeden Fehler; ist die Aufnahme nicht zu laden (offline,
// nicht gespeichert), bleibt es still und der Abschluss ist deshalb nicht schlechter.
//
// Ein eigener, kleiner Audio-Kontext statt der Engine: Zum Abschluss läuft kein Programm, und die Engine bleibt
// unberührt (sie kennt Sitzungen, Pausen und das Ergebnis; ein Anschlag nebenher gehörte da nicht hinein). Der
// Kontext entsteht beim ersten Aufruf, der im Tipp auf „Weiter“ geschieht, und bleibt danach bestehen: Die
// Autoplay-Regel lässt ihn nur in einer Geste anlaufen, und jeder weitere Kontext wäre ein Gerät mehr.
//
// Er ruht, wenn nichts klingt: Nach dem Anschlag (`onended`) und wenn das Laden scheitert, hält er sich mit `suspend()`
// an. Die Engine hält ihre Ausgabe im Leerlauf ebenfalls an (Akku), und ein zweiter Kontext, der ewig weiterläuft, hielte
// das Gerät wach. Der nächste Anschlag setzt ihn im Tipp wieder fort.
import { assetUrl, EFFECTS } from '../sounds/catalog'

/** Lautstärke des Anschlags: etwas unter voll, damit er den ruhigen Abschluss nicht übertönt. */
const VOLUME = 0.8
/** Der Anschlag im Abschluss des Abend-Logbuchs (Spec M11 §2.3): halb so laut wie am Morgen. */
export const CHIME_EVENING = 0.4

let context: AudioContext | null = null
// Die dekodierte Aufnahme, einmal je Seite. Ein gescheitertes Laden wird nicht gemerkt, damit der nächste Aufruf
// (etwa wieder mit Netz) es erneut versucht.
let buffer: Promise<AudioBuffer> | null = null
// Wie viele Anschläge gerade klingen: Nur wenn keiner mehr klingt, ruht der Kontext (zwei dicht aufeinander folgende
// Aufrufe schnitten sich sonst gegenseitig ab).
let sounding = 0
// Hat dieses Modul den Kontext angehalten? Dann setzt der nächste Aufruf ihn fort, auch wenn `state` noch nicht
// „suspended“ meldet (das Anhalten ist ein Versprechen und kann noch laufen).
let parked = false

async function load(ctx: AudioContext): Promise<AudioBuffer> {
  const response = await fetch(assetUrl(EFFECTS[0].file))
  if (!response.ok) throw new Error('HTTP ' + response.status)
  return ctx.decodeAudioData(await response.arrayBuffer())
}

/** Hält den Kontext an, wenn nichts mehr klingt. Ein Fehler dabei (etwa ein geschlossener Kontext) bleibt still. */
function park(ctx: AudioContext): void {
  if (sounding > 0) return
  parked = true
  try {
    ctx.suspend().catch(() => {})
  } catch {
    // Nichts zu tun: Ein Kontext, der sich nicht anhalten lässt, läuft eben weiter.
  }
}

async function play(makeContext: () => AudioContext, volume: number): Promise<void> {
  // Vor dem ersten `await`: Der Kontext entsteht noch im Tipp.
  const ctx = (context ??= makeContext())
  // Ein Kontext, den wir selbst nach dem letzten Anschlag angehalten haben oder den das System angehalten hat
  // (Sperrbildschirm, Anruf), läuft in einem Tipp wieder an.
  if (parked || ctx.state === 'suspended') {
    parked = false
    ctx.resume().catch(() => {})
  }
  const loading = (buffer ??= load(ctx))
  let decoded: AudioBuffer
  try {
    decoded = await loading
  } catch (cause) {
    if (buffer === loading) buffer = null
    park(ctx)
    throw cause
  }
  const source = ctx.createBufferSource()
  source.buffer = decoded
  const gain = ctx.createGain()
  gain.gain.value = volume
  source.connect(gain)
  gain.connect(ctx.destination)
  source.onended = () => {
    sounding--
    park(ctx)
  }
  source.start()
  sounding++
}

/**
 * Spielt einen Anschlag der Klangschale. Gehört in den Tipp, der den Abschluss auslöst (Autoplay-Regel). `makeContext`
 * ist für Tests: Sie reichen einen Ersatz ein; im Betrieb entsteht der Kontext beim ersten Aufruf selbst. `volume` ist die
 * Lautstärke: 0,8 am Morgen, `CHIME_EVENING` im Abend-Logbuch.
 */
export function playChime(makeContext: () => AudioContext = () => new AudioContext(), volume = VOLUME): void {
  play(makeContext, volume).catch(() => {})
}

/** Nur für Tests: vergisst Kontext und Aufnahme, damit jeder Test mit seinem eigenen Ersatz beginnt. */
export function resetChimeForTests(): void {
  context = null
  buffer = null
  sounding = 0
  parked = false
}
