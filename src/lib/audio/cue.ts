// Atem-Hinweis: ein kurzer, leiser Sinuston zu Beginn jeder Phase, auf der Audio-Uhr eingeplant.
// Die Tonhöhe sagt die Phase an, auch ohne Blick auf den Bildschirm: hoch beim Einatmen, mittel
// beim Halten, tief beim Ausatmen.
import type { PhaseKind } from '../breath/patterns'

const FREQUENCY: Record<PhaseKind, number> = { ein: 528, halten: 440, aus: 396 }
const PEAK = 0.15
const ATTACK = 0.06 // s bis zur Spitze; weich genug, dass der Einsatz nicht klickt
const LENGTH = 0.6 // s, danach endet der Ton
// Eine exponentielle Rampe kann nicht auf 0 enden; 0,0001 (−80 dBFS) ist unhörbar.
const FLOOR = 0.0001

// Sinus → eigener Gain mit Hüllkurve → `destination`. Gibt den Oszillator zurück, damit ein
// Programm ihn vorzeitig stoppen kann.
export function scheduleCue(ctx: BaseAudioContext, destination: AudioNode, when: number, kind: PhaseKind): OscillatorNode {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = FREQUENCY[kind]
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.gain.setValueAtTime(0, when)
  gain.gain.linearRampToValueAtTime(PEAK, when + ATTACK)
  gain.gain.exponentialRampToValueAtTime(FLOOR, when + LENGTH)
  osc.connect(gain).connect(destination)
  // Nach dem Ende (geplant oder vorzeitig) hängt nichts Totes mehr im Graphen.
  osc.onended = () => gain.disconnect()
  osc.start(when)
  osc.stop(when + LENGTH)
  return osc
}
