// Der einzige Audio-Ausgang der App: ein AudioContext, dessen Mischung direkt an den
// Lautsprecher (`ctx.destination`) geht. Daneben spielt ein lautloser Anker (siehe anchor.ts),
// damit Android die App als Medienwiedergabe behandelt (läuft bei gesperrtem Bildschirm,
// Steuerung im Sperrbildschirm). Nicht über einen MediaStream ausgeben: Dieser Umweg ruckelt
// auf Android dauerhaft (auf dem Gerät nachgewiesen, Diagnose Weg B).
import { createAnchorElement } from './anchor'

export interface Output {
  ctx: AudioContext
  // Summe aller Stimmen. Gain 0,8 als Reserve: `meer` erreicht bei 48 kHz Spitzen um 1,03.
  input: GainNode
  // Gesamtlautstärke für das Ausblenden des Sleep-Timers; Ruhewert 1.
  fade: GainNode
  // Der lautlose Anker; seine pause-Ereignisse zeigen Unterbrechungen durch das System an.
  element: HTMLAudioElement
  // Lässt die Audio-Uhr laufen und startet das Medien-Element.
  start(): Promise<void>
  // Hält Medien-Element und Audio-Uhr an; alle eingeplanten Ereignisse verschieben sich mit.
  suspend(): Promise<void>
}

const HEADROOM = 0.8

export function createOutput(): Output {
  const ctx = new AudioContext({ latencyHint: 'playback' })
  const input = ctx.createGain()
  input.gain.value = HEADROOM
  const fade = ctx.createGain()
  fade.gain.value = 1
  // Spitzenbegrenzer: Alle acht Klänge auf voller Lautstärke erreichen trotz Reserve Spitzen um
  // 1,39; ohne Begrenzer würde das übersteuern. Darunter bleibt die Mischung unverändert
  // (bis auf die feste Aufholverstärkung, die der Kompressor laut Web-Audio-Spec mitbringt).
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -2
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.003
  limiter.release.value = 0.25
  input.connect(fade).connect(limiter).connect(ctx.destination)

  const element = createAnchorElement()

  return {
    ctx,
    input,
    fade,
    element,
    async start() {
      // Beide Aufrufe sofort, damit play() noch innerhalb der Nutzergeste geschieht.
      // AbortError: Ein späteres eigenes pause() hat dieses play() abgelöst – kein Fehler.
      const playing = element.play().catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) throw error
      })
      await Promise.all([ctx.resume(), playing])
    },
    async suspend() {
      element.pause()
      await ctx.suspend()
    },
  }
}
