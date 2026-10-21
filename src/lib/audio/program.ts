// Programme: Meditations-Timer und Atemübungen als Folge eingeplanter Klänge. Ein Programm sagt
// nur, was wann erklingt (Sekunden ab Programmstart); die Engine legt den Start auf der Audio-Uhr
// fest, lässt `schedule` alles auf einmal einplanen und meldet am Ende das Sitzungsergebnis.
// So hängt nichts Hörbares an JS-Timern, die Android im Hintergrund drosselt.
import { breathPlan, patternById, type BreathPatternId } from '../breath/patterns'
import { timerPlan, type TimerSettings } from '../meditation/timer-plan'
import type { SoundId } from '../sounds/catalog'
import { scheduleCue } from './cue'
import { scheduleStrike } from './strike'

export interface ProgramAssets {
  strike: AudioBuffer | null // Klangschale; null, wenn sie nicht geladen werden konnte
}

export interface ProgramSpec {
  kind: 'timer' | 'breath'
  ref: string // 'timer' bzw. BreathPatternId
  title: string // Media-Session-Titel
  // Sekunden ab Programmstart: Vorlauf, gezählte Dauer danach, Ende nach dem Ausklingen.
  lead: number
  length: number
  finish: number
  background: SoundId | null
  // Plant alle Klänge ab t0 ein und liefert eine Funktion, die alles Eingeplante sofort stoppt.
  schedule(ctx: BaseAudioContext, destination: AudioNode, t0: number, assets: ProgramAssets): () => void
}

// Stoppt und trennt die Knoten sofort, auch solche, die erst später erklingen würden.
function stopper(nodes: AudioScheduledSourceNode[]): () => void {
  return () => {
    for (const node of nodes) {
      try {
        node.stop()
      } catch {
        // schon gestoppt
      }
      node.disconnect()
    }
  }
}

// Timer: Klangschalen nach dem Timer-Plan, darunter auf Wunsch ein Hintergrundklang. Ohne
// geladene Klangschale läuft er still bis zum Ende.
export function timerProgram(s: TimerSettings): ProgramSpec {
  const plan = timerPlan(s)
  return {
    kind: 'timer',
    ref: 'timer',
    title: `Meditation · ${s.minutes} Min`,
    lead: plan.lead,
    length: plan.length,
    finish: plan.finish,
    background: s.sound,
    schedule(ctx, destination, t0, { strike }) {
      if (!strike) return () => {}
      return stopper(plan.strikes.map((at) => scheduleStrike(ctx, destination, strike, t0 + at)))
    },
  }
}

// Atemübung: ein Hinweiston zu Beginn jeder Phase, ohne Vorlauf und Hintergrund. Nach dem letzten
// Zyklus bleibt 1 s, bevor das Programm endet.
export function breathProgram(id: BreathPatternId, minutes: number): ProgramSpec {
  const plan = breathPlan(id, minutes)
  return {
    kind: 'breath',
    ref: id,
    title: `Atmen · ${patternById(id).title}`,
    lead: 0,
    length: plan.length,
    finish: plan.length + 1,
    background: null,
    schedule(ctx, destination, t0) {
      return stopper(plan.cues.map((cue) => scheduleCue(ctx, destination, t0 + cue.at, cue.kind)))
    },
  }
}
