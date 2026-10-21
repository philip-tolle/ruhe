// Reiter „Heute“: Serien-Zeile und „Zuletzt genutzt“. Reine Funktionen, ohne Speicher- und DOM-Zugriff.
import { breathProgram, timerProgram, type ProgramSpec } from '../audio/program'
import { patternById } from '../breath/patterns'
import { clampMinutes } from '../meditation/timer-plan'
import type { LastUsed } from '../stats/schema'
import { streakLabel } from './ich-view'

/** „3 Tage in Folge“ / „1 Tag in Folge“; ohne Serie eine Einladung statt einer Null. */
export function streakLine(days: number): string {
  return days === 0 ? 'Heute ist ein guter Tag zum Anfangen.' : `${streakLabel(days)} in Folge`
}

/** Zuletzt genutzt, das als Programm startet (Timer, Atemübung). */
export type ProgramLastUsed = Exclude<LastUsed, { kind: 'guided' }>

/** Timer-Minuten laufen wie jede Eingabe über `clampMinutes`; Text und Start nehmen denselben Wert. */
function timerMinutes(last: Extract<LastUsed, { kind: 'timer' }>): number {
  return clampMinutes(last.minutes)
}

/** „Timer · 20 Min“ bzw. „4-7-8 · 1 Min“. */
export function lastUsedSummary(last: ProgramLastUsed): string {
  if (last.kind === 'timer') return `Timer · ${timerMinutes(last)} Min`
  return `${patternById(last.pattern).title} · ${last.minutes} Min`
}

/** Das Programm, das „Erneut starten“ startet: genau die gemerkte Sitzung. */
export function lastUsedProgram(last: ProgramLastUsed): ProgramSpec {
  if (last.kind === 'timer') {
    return timerProgram({ minutes: timerMinutes(last), intervalMin: last.intervalMin, sound: last.sound, lead: last.lead })
  }
  return breathProgram(last.pattern, last.minutes)
}
