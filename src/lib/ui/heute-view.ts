// Reiter „Heute“: Serien-Zeile und „Zuletzt genutzt“. Reine Funktionen, ohne Speicher- und DOM-Zugriff.
import { breathProgram, timerProgram, type BreathOptions, type ProgramSpec } from '../audio/program'
import { resolvePattern, type CustomBreathPattern } from '../breath/custom'
import type { BreathPattern } from '../breath/patterns'
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

/** Das Muster einer gemerkten Atemübung; ein gelöschtes eigenes Muster ergibt `null`. */
function breathPatternOf(last: Extract<LastUsed, { kind: 'breath' }>, custom: readonly CustomBreathPattern[]): BreathPattern | null {
  return resolvePattern(last.pattern, custom)
}

function guidedSummary(m: Meditation): string {
  return `${m.title} · ${durationLabel(m)}`
}

/**
 * „Timer · 20 Min“, „4-7-8 · 1 Min“, „Abendruhe · 3 Min“ bzw. „Ankommen im Atem · 5 Min“. `custom` sind die
 * eigenen Atemmuster; ein gelöschtes zeigt wie eine unbekannte Meditation den Ersatz.
 */
export function lastUsedSummary(last: LastUsed, custom: readonly CustomBreathPattern[] = []): string {
  if (last.kind === 'timer') return `Timer · ${timerMinutes(last)} Min`
  if (last.kind === 'guided') return guidedSummary(guidedMeditation(last.id))
  const pattern = breathPatternOf(last, custom)
  return pattern ? `${pattern.title} · ${last.minutes} Min` : guidedSummary(guidedMeditation(FALLBACK_ID))
}

/**
 * Was „Erneut starten“ startet: genau die gemerkte Sitzung; eine Atemübung so, wie Atemübungen
 * gerade eingestellt sind (Atemgeräusch, Hintergrund).
 */
export function lastUsedStart(last: LastUsed, breath: BreathOptions, custom: readonly CustomBreathPattern[] = []): LastUsedStart {
  if (last.kind === 'guided') return { kind: 'guided', meditation: guidedMeditation(last.id) }
  if (last.kind === 'timer') {
    const spec = timerProgram({ minutes: timerMinutes(last), intervalMin: last.intervalMin, sound: last.sound, lead: last.lead })
    return { kind: 'program', spec }
  }
  const pattern = breathPatternOf(last, custom)
  if (!pattern) return { kind: 'guided', meditation: guidedMeditation(FALLBACK_ID) }
  return { kind: 'program', spec: breathProgram(pattern, last.minutes, breath) }
}

/** Gibt es das Gemerkte noch (Meditation im Katalog, Atemmuster fest oder unter den eigenen)? */
function stillThere(last: LastUsed, custom: readonly CustomBreathPattern[]): boolean {
  if (last.kind === 'guided') return meditationById(last.id) !== null
  if (last.kind === 'breath') return breathPatternOf(last, custom) !== null
  return true
}

/**
 * Die Karte „Zuletzt genutzt“. Ohne Gemerktes (oder mit einer Meditation, die der Katalog nicht
 * kennt, bzw. einem gelöschten eigenen Atemmuster) bietet sie „Ankommen im Atem“ an; da es nichts zu
 * wiederholen gibt, heißt der Knopf dann „Jetzt starten“.
 */
export function lastUsedCard(
  last: LastUsed | undefined,
  custom: readonly CustomBreathPattern[] = [],
): { last: LastUsed; summary: string; action: string } {
  if (last && stillThere(last, custom)) {
    return { last, summary: lastUsedSummary(last, custom), action: 'Erneut starten' }
  }
  const fallback: LastUsed = { kind: 'guided', id: FALLBACK_ID }
  return { last: fallback, summary: lastUsedSummary(fallback), action: 'Jetzt starten' }
}
