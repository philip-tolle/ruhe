// Die Klangschale im Abschluss des Morgen-Starts (Spec M10 §2.3): ein einzelner Anschlag, ohne Hintergrund. „Feuer
// und vergiss“: `playChime` kehrt sofort zurück und schluckt jeden Fehler; ist die Aufnahme nicht zu laden (offline,
// nicht gespeichert), bleibt es still und der Abschluss ist deshalb nicht schlechter.
//
// Ein eigener, kleiner Audio-Kontext statt der Engine: Zum Abschluss läuft kein Programm, und die Engine bleibt
// unberührt (sie kennt Sitzungen, Pausen und das Ergebnis; ein Anschlag nebenher gehörte da nicht hinein). Der
// Kontext entsteht beim ersten Aufruf, der im Tipp auf „Weiter“ geschieht, und bleibt danach bestehen: Die
// Autoplay-Regel lässt ihn nur in einer Geste anlaufen, und jeder weitere Kontext wäre ein Gerät mehr.
import { assetUrl, EFFECTS } from '../sounds/catalog'

/** Lautstärke des Anschlags: etwas unter voll, damit er den ruhigen Abschluss nicht übertönt. */
const VOLUME = 0.8

let context: AudioContext | null = null
// Die dekodierte Aufnahme, einmal je Seite. Ein gescheitertes Laden wird nicht gemerkt, damit der nächste Aufruf
// (etwa wieder mit Netz) es erneut versucht.
let buffer: Promise<AudioBuffer> | null = null

async function load(ctx: AudioContext): Promise<AudioBuffer> {
  const response = await fetch(assetUrl(EFFECTS[0].file))
  if (!response.ok) throw new Error('HTTP ' + response.status)
  return ctx.decodeAudioData(await response.arrayBuffer())
}

async function play(makeContext: () => AudioContext): Promise<void> {
  // Vor dem ersten `await`: Der Kontext entsteht noch im Tipp.
  const ctx = (context ??= makeContext())
  // Ein Kontext, den das System angehalten hat (Sperrbildschirm, Anruf), läuft in einem Tipp wieder an.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const loading = (buffer ??= load(ctx))
  let decoded: AudioBuffer
  try {
    decoded = await loading
  } catch (cause) {
    if (buffer === loading) buffer = null
    throw cause
  }
  const source = ctx.createBufferSource()
  source.buffer = decoded
  const gain = ctx.createGain()
  gain.gain.value = VOLUME
  source.connect(gain)
  gain.connect(ctx.destination)
  source.start()
}

/**
 * Spielt einen Anschlag der Klangschale. Gehört in den Tipp, der den Abschluss auslöst (Autoplay-Regel). `makeContext`
 * ist für Tests: Sie reichen einen Ersatz ein; im Betrieb entsteht der Kontext beim ersten Aufruf selbst.
 */
export function playChime(makeContext: () => AudioContext = () => new AudioContext()): void {
  play(makeContext).catch(() => {})
}

/** Nur für Tests: vergisst Kontext und Aufnahme, damit jeder Test mit seinem eigenen Ersatz beginnt. */
export function resetChimeForTests(): void {
  context = null
  buffer = null
}
