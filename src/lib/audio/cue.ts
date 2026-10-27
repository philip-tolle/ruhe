// Hinweiston der Brain Hacks: ein kurzer, leiser Sinuston, der einen Schrittwechsel anzeigt, ohne die
// Klangschale zu verbrauchen, die dem Ende vorbehalten ist. Eingeplant auf der Audio-Uhr wie die
// Klangschale, damit er auch bei gesperrtem Bildschirm pünktlich erklingt.

const FREQUENCY = 660 // Hz
const LENGTH = 0.25 // s bis zum Verklingen; dann endet auch die Quelle
const PEAK = 0.08 // Pegel hinter dem Mischpult: deutlich leiser als die Klangschale
const ATTACK = 0.02 // s Anstieg bis zur Spitze, damit es nicht knackt
const FLOOR = 0.0001 // Zielwert des exponentiellen Abklingens (−80 dB, nicht hörbar)

/** Plant einen Hinweiston ab `when` (Audio-Uhr) und liefert seine Quelle, die sich stoppen lässt. */
export function scheduleCue(ctx: BaseAudioContext, destination: AudioNode, when: number): OscillatorNode {
  const source = ctx.createOscillator()
  source.type = 'sine'
  source.frequency.value = FREQUENCY
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.gain.setValueAtTime(0, when)
  gain.gain.linearRampToValueAtTime(PEAK, when + ATTACK)
  gain.gain.exponentialRampToValueAtTime(FLOOR, when + LENGTH)
  source.connect(gain).connect(destination)
  source.onended = () => gain.disconnect()
  source.start(when)
  source.stop(when + LENGTH)
  return source
}
