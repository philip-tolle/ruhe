// Timer-Plan: reine Berechnung, ohne Audio-Zugriff.
// Zeiten sind Sekunden ab Programmstart; die Audio-Engine plant damit auf der AudioContext-Uhr.
import type { SoundId } from '../sounds/catalog'

/** Auswahl im Timer in Minuten. */
export const TIMER_PRESETS: readonly number[] = [5, 10, 15, 20, 30]

/** Abstand der Zwischenschalen in Minuten; `null` bedeutet keine Zwischenschalen. */
export const INTERVAL_OPTIONS: readonly (number | null)[] = [null, 1, 2, 5, 10]

/** Vorlauf in Sekunden vor der Startschale. */
export const LEAD_SECONDS = 10

/** Schläge der Endschalen in Sekunden nach Ende der gezählten Dauer. */
export const END_STRIKES: readonly number[] = [0, 3, 6]

/** Ausklingzeit in Sekunden nach dem Ende, bis das Programm beendet ist: Die letzte Endschale klingt 9 s aus. */
export const TIMER_TAIL = 15

export interface TimerSettings {
  minutes: number
  intervalMin: number | null
  sound: SoundId | null
  lead: boolean
}

export interface TimerPlan {
  /** Sekunde der Startschale: der Vorlauf, sonst 0. */
  lead: number
  /** Gezählte Dauer in Sekunden, ohne Vorlauf. */
  length: number
  /** Alle Schalen in Sekunden, aufsteigend. */
  strikes: number[]
  /** Sekunde, zu der das Programm nach dem Ausklingen endet. */
  finish: number
}

/**
 * Plan für einen Timer. Zwischenschalen klingen nur innerhalb der Dauer; eine, die genau
 * auf das Ende fällt, entfällt zugunsten der Endschalen.
 */
export function timerPlan(s: Pick<TimerSettings, 'minutes' | 'intervalMin' | 'lead'>): TimerPlan {
  const lead = s.lead ? LEAD_SECONDS : 0
  const length = s.minutes * 60
  const end = lead + length
  const strikes = [lead]
  // Ein Intervall von 0 oder darunter (z. B. aus beschädigten Daten) würde endlos schleifen.
  if (s.intervalMin !== null && s.intervalMin > 0) {
    const step = s.intervalMin * 60
    for (let t = lead + step; t < end; t += step) strikes.push(t)
  }
  for (const offset of END_STRIKES) strikes.push(end + offset)
  return { lead, length, strikes, finish: end + TIMER_TAIL }
}

/** Minuten auf ganze Zahlen von 1 bis 120 begrenzt; `NaN` ergibt 10. */
export function clampMinutes(n: number): number {
  if (Number.isNaN(n)) return 10
  return Math.min(120, Math.max(1, Math.round(n)))
}
