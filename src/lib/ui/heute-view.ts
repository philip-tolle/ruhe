// Reiter „Heute“: Serien-Zeile und „Zuletzt genutzt“. Reine Funktionen, ohne Speicher- und DOM-Zugriff.
import { breathProgram, timerProgram, type BreathOptions, type ProgramSpec } from '../audio/program'
import { patternById } from '../breath/patterns'
import { durationLabel, FALLBACK_ID, meditationById, type Meditation } from '../content/catalog'
import { clampMinutes } from '../meditation/timer-plan'
import type { LastUsed } from '../stats/schema'
import { streakLabel } from './ich-view'

/** „3 Tage in Folge“ / „1 Tag in Folge“; ohne Serie eine Einladung statt einer Null. */
export function streakLine(days: number): string {
  return days === 0 ? 'Heute ist ein guter Tag zum Anfangen.' : `${streakLabel(days)} in Folge`
}

/** Was „Zuletzt genutzt“ startet: ein Programm (Timer, Atemübung) oder eine geführte Meditation. */
export type LastUsedStart = { kind: 'program'; spec: ProgramSpec } | { kind: 'guided'; meditation: Meditation }

/** Timer-Minuten laufen wie jede Eingabe über `clampMinutes`; Text und Start nehmen denselben Wert. */
function timerMinutes(last: Extract<LastUsed, { kind: 'timer' }>): number {
  return clampMinutes(last.minutes)
}

/** Die gemerkte Meditation; kennt der Katalog die `id` nicht (mehr), „Ankommen im Atem“. */
function guidedMeditation(id: string): Meditation {
  const m = meditationById(id) ?? meditationById(FALLBACK_ID)
  if (!m) throw new Error(`Ersatz-Meditation ${FALLBACK_ID} fehlt im Katalog`)
  return m
}

/** „Timer · 20 Min“, „4-7-8 · 1 Min“ bzw. „Ankommen im Atem · 5 Min“. */
export function lastUsedSummary(last: LastUsed): string {
  if (last.kind === 'timer') return `Timer · ${timerMinutes(last)} Min`
  if (last.kind === 'guided') {
    const m = guidedMeditation(last.id)
    return `${m.title} · ${durationLabel(m)}`
  }
  return `${patternById(last.pattern).title} · ${last.minutes} Min`
}

/**
 * Was „Erneut starten“ startet: genau die gemerkte Sitzung; eine Atemübung so, wie Atemübungen
 * gerade eingestellt sind (Atemgeräusch, Hintergrund).
 */
export function lastUsedStart(last: LastUsed, breath: BreathOptions): LastUsedStart {
  if (last.kind === 'guided') return { kind: 'guided', meditation: guidedMeditation(last.id) }
  if (last.kind === 'timer') {
    const spec = timerProgram({ minutes: timerMinutes(last), intervalMin: last.intervalMin, sound: last.sound, lead: last.lead })
    return { kind: 'program', spec }
  }
  return { kind: 'program', spec: breathProgram(last.pattern, last.minutes, breath) }
}

/**
 * Die Karte „Zuletzt genutzt“. Ohne Gemerktes (oder mit einer Meditation, die der Katalog nicht
 * kennt) bietet sie „Ankommen im Atem“ an; da es nichts zu wiederholen gibt, heißt der Knopf dann
 * „Jetzt starten“.
 */
export function lastUsedCard(last: LastUsed | undefined): { last: LastUsed; summary: string; action: string } {
  if (last && !(last.kind === 'guided' && meditationById(last.id) === null)) {
    return { last, summary: lastUsedSummary(last), action: 'Erneut starten' }
  }
  const fallback: LastUsed = { kind: 'guided', id: FALLBACK_ID }
  return { last: fallback, summary: lastUsedSummary(fallback), action: 'Jetzt starten' }
}
