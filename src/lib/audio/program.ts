// Programme: Meditations-Timer und Atemübungen als Folge eingeplanter Klänge. Ein Programm sagt
// nur, was wann erklingt (Sekunden ab Programmstart); die Engine legt den Start auf der Audio-Uhr
// fest, lässt `schedule` alles auf einmal einplanen und meldet am Ende das Sitzungsergebnis.
// So hängt nichts Hörbares an JS-Timern, die Android im Hintergrund drosselt.
import { breathPlan, patternById, type BreathPatternId } from '../breath/patterns'
import { timerPlan, type TimerSettings } from '../meditation/timer-plan'
import type { BackgroundId } from '../sounds/catalog'
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
  background: BackgroundId | null
  // Plant alle Klänge ab t0 ein und liefert eine Funktion, die alles Eingeplante stoppt: Was schon
  // klingt, endet bei `when` (Audio-Uhr, Standard: sofort), was noch nicht eingesetzt hat, sofort.
  schedule(ctx: BaseAudioContext, destination: AudioNode, t0: number, assets: ProgramAssets): (when?: number) => void
}

interface Scheduled {
  node: AudioScheduledSourceNode
  at: number // Einsatz auf der Audio-Uhr
}

// Was bis jetzt nicht eingesetzt hat, stoppt sofort: Unter dem Ausblenden des Programms begänne
// sonst noch eine Schale oder ein Hinweiston. Ein gerade klingender Hinweiston läuft dabei bis
// `when` auf seinem unhörbaren Rest weiter (der letzte Stopp gilt). Abgebaut wird mit dem Gain
// des Programms.
function stopper(ctx: BaseAudioContext, scheduled: Scheduled[]): (when?: number) => void {
  return (when) => {
    const now = ctx.currentTime
    for (const { node, at } of scheduled) {
      try {
        node.stop(at > now ? undefined : when)
      } catch {
        // schon gestoppt
      }
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
      const scheduled = plan.strikes.map((offset) => {
        const at = t0 + offset
        return { node: scheduleStrike(ctx, destination, strike, at), at }
      })
      return stopper(ctx, scheduled)
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
      const scheduled = plan.cues.map((cue) => {
        const at = t0 + cue.at
        return { node: scheduleCue(ctx, destination, at, cue.kind), at }
      })
      return stopper(ctx, scheduled)
    },
  }
}
