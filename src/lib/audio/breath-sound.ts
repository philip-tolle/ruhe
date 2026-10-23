// Atemgeräusch der Atemübungen: zu Beginn jeder Ein- und Ausatemphase ein leiser menschlicher
// Atemzug (public/audio/breath), so lang wie die Phase. Die Aufnahme läuft dafür behutsam schneller
// oder langsamer (höchstens ±25 %); was dann noch übersteht, blendet bis zum Phasenende aus, und ist
// sie kürzer, endet sie früher. Halten bleibt still. Eingeplant auf der Audio-Uhr wie die Klangschale.
import type { PhaseKind } from '../breath/patterns'

export interface BreathBuffers {
  ein: AudioBuffer
  aus: AudioBuffer
}

// Pegel hinter dem Mischpult: Die Dateien haben −26 LUFS; mit der Reserve 0,8 ergibt das −40 LUFS
// wie die freigegebene Hörprobe. Das Ausatmen ist etwas leiser.
export const BREATH_GAIN = { ein: 0.25, aus: 0.21 } as const

const RATE_MIN = 0.75
const RATE_MAX = 1.25
const ATTACK = 0.35 // s Einblenden, bei kurzen Phasen höchstens 30 % der Phase
const RELEASE = 1.0 // s Ausblenden, bei kurzen Geräuschen höchstens 40 % davon

/** Abspielgeschwindigkeit, mit der eine Aufnahme von `duration` s eine Phase von `length` s füllt. */
export function breathRate(duration: number, length: number): number {
  return Math.min(RATE_MAX, Math.max(RATE_MIN, duration / length))
}

/**
 * Plant das Geräusch einer Phase ab `when` (Audio-Uhr) und liefert seine Quelle; beim Halten `null`.
 * Es steigt in `min(0,35 s, 0,3·Phase)` auf seinen Pegel und ist spätestens am Ende des Geräuschs
 * (Phasenende oder früher) wieder bei 0; dann endet auch die Quelle.
 */
export function scheduleBreath(
  ctx: BaseAudioContext,
  destination: AudioNode,
  when: number,
  kind: PhaseKind,
  length: number,
  buffers: BreathBuffers,
): AudioBufferSourceNode | null {
  if (kind === 'halten') return null
  const buffer = buffers[kind]
  const rate = breathRate(buffer.duration, length)
  const end = Math.min(length, buffer.duration / rate)
  const peak = BREATH_GAIN[kind]
  const rise = when + Math.min(ATTACK, 0.3 * length)
  const fall = Math.max(rise, when + end - Math.min(RELEASE, 0.4 * end))

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = rate
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.gain.setValueAtTime(0, when)
  gain.gain.linearRampToValueAtTime(peak, rise)
  gain.gain.setValueAtTime(peak, fall)
  gain.gain.linearRampToValueAtTime(0, when + end)
  source.connect(gain).connect(destination)
  source.onended = () => gain.disconnect()
  source.start(when)
  source.stop(when + end)
  return source
}
