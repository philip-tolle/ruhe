// Abläufe auf der AudioContext-Uhr statt mit JS-Timern: Rampen und Zeitmarken laufen auch
// dann pünktlich weiter, wenn Android die Timer einer Seite im Hintergrund drosselt.
// Hält die Audio-Uhr an (`ctx.suspend()`), verschiebt sich alles Eingeplante mit.
import type { SleepPlan } from './sleep-timer'

// Kappt alle ab `when` geplanten Änderungen und hält den aktuellen Wert fest,
// damit die nächste Rampe ohne Sprung von dort aus beginnt.
export function holdParam(param: AudioParam, when: number): void {
  const value = param.value
  param.cancelScheduledValues(when)
  param.setValueAtTime(value, when)
}

// Plant die Gesamtlautstärke des Sleep-Timers ab `t0` (Sekunden auf der Audio-Uhr):
// - mit Plan: in höchstens 1 s zurück auf 1, ab `fadeStart` linear bis `end` auf 0;
//   ist `fadeStart` 0, geht es vom aktuellen Wert direkt linear bis `end` auf 0;
// - ohne Plan (endlos): vom aktuellen Wert in 1 s linear zurück auf 1.
export function scheduleSleepFade(param: AudioParam, t0: number, plan: SleepPlan | null): void {
  holdParam(param, t0)
  if (!plan) {
    param.linearRampToValueAtTime(1, t0 + 1)
    return
  }
  if (plan.fadeStart > 0) {
    param.linearRampToValueAtTime(1, t0 + Math.min(1, plan.fadeStart))
    // Anker: Die Rampe auf 0 beginnt erst bei fadeStart, nicht am Ende der Rückführung.
    param.setValueAtTime(1, t0 + plan.fadeStart)
  }
  param.linearRampToValueAtTime(0, t0 + plan.end)
}

// Zeitmarke: Eine ConstantSourceNode läuft von `start` bis `end`; ihr `onended` ruft
// `onEnded`. Sie hängt über einen stummen Gain an `sink`, damit der Graph sie verarbeitet.
// Gibt eine Funktion zum Abbrechen zurück (danach wird `onEnded` nicht mehr gerufen).
export function scheduleMarker(
  ctx: BaseAudioContext,
  sink: AudioNode,
  start: number,
  end: number,
  onEnded: () => void,
): () => void {
  const source = ctx.createConstantSource()
  const mute = ctx.createGain()
  mute.gain.value = 0
  source.connect(mute).connect(sink)

  let done = false
  const release = () => {
    done = true
    source.onended = null
    source.disconnect()
    mute.disconnect()
  }
  source.onended = () => {
    release()
    onEnded()
  }
  source.start(start)
  source.stop(end)

  return () => {
    if (done) return
    release()
    source.stop() // sofort beenden, damit der Knoten freigegeben wird
  }
}
