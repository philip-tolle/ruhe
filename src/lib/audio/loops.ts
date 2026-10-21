// Datei-Klänge: Laden und Dekodieren von Loops sowie ihre Wiedergabe als Stimme.
import type { Voice } from './voice'

const buffers = new WeakMap<BaseAudioContext, Map<string, Promise<AudioBuffer>>>()

async function fetchAndDecode(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('HTTP ' + response.status)
  // Schlägt auch fehl, wenn der Server statt der Datei eine HTML-Ersatzseite mit Status 200 liefert.
  return ctx.decodeAudioData(await response.arrayBuffer())
}

// Lädt und dekodiert `url` mit der Abtastrate des Kontexts. Pro Kontext und URL wird nur
// einmal geladen; gleichzeitige Aufrufe teilen sich den Vorgang. Jeder Fehler (Netz, HTTP,
// Dekodierung) wird zu `Konnte nicht geladen werden: <url>` und nicht zwischengespeichert,
// damit der nächste Aufruf es erneut versucht.
export function loadBuffer(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  let perContext = buffers.get(ctx)
  if (!perContext) {
    perContext = new Map()
    buffers.set(ctx, perContext)
  }
  const cached = perContext.get(url)
  if (cached) return cached

  const known = perContext
  const pending = fetchAndDecode(ctx, url).catch((cause) => {
    known.delete(url)
    throw new Error('Konnte nicht geladen werden: ' + url, { cause })
  })
  known.set(url, pending)
  return pending
}

// Spielt `buffer` als Endlosschleife ab, sofort und an einem zufälligen Offset, damit
// Wiederholungen nach dem Start nicht immer gleich beginnen. `output` ist ein Gain mit 1.
export function createLoopVoice(ctx: BaseAudioContext, buffer: AudioBuffer): Voice {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const output = ctx.createGain()
  source.connect(output)
  source.start(ctx.currentTime, Math.random() * buffer.duration)
  return {
    output,
    stop(when = ctx.currentTime) {
      source.stop(when)
    },
  }
}
