// Morgen-Start (Spec M10 §4.3): welche Karte wann, Übung des Tages, Wortvorschläge, eigene Wörter und Werte,
// offener Big Domino von gestern, Zählung der letzten 7 Tage. Reine Funktionen: `now` kommt als Eingabe,
// kein Zugriff auf Speicher oder Oberfläche.
import type { EnergyArea } from '../energy/areas'
import type { MorningEntry } from '../stats/schema'
import { dayKey } from '../stats/summary'
import { INTENTIONS, INTENTIONS_DEFAULT, MORNING_EXERCISES, VALUES, type MorningExerciseId } from './words'

/** Die Karte „Guten Morgen“ steht von dieser Stunde an (Ortszeit) … */
export const MORNING_FROM = 4
/** … bis vor dieser Stunde, also bis 10:59. */
export const MORNING_UNTIL = 11

/** So viele Kalendertage darf der Big Domino zurückliegen, damit „Von gestern offen“ ihn noch anbietet. */
const DOMINO_DAYS = 3
/** Die Zählung „an {n} der letzten 7 Tage“ umfasst heute und die 6 Tage davor. */
const COUNT_DAYS = 7
/** So viele eigene Wörter bzw. Werte zeigt „Deine Wörter“ / „Deine Werte“ höchstens. */
const OWN_MAX = 3
const DAY_MS = 86_400_000

// ── Kalendertage ─────────────────────────────────────────────────────────────────────────────────

/** `dayKey` des Tages `back` Kalendertage vor `now`; der Kalender rechnet, damit 23- und 25-Stunden-Tage nicht stören. */
function dayKeyBack(now: Date, back: number): string {
  return dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back))
}

/** Absteigend nach Tag, bei gleichem Tag nach `at` (Zeitpunkt); ein unlesbares `at` gilt als das älteste. */
function newerFirst(a: MorningEntry, b: MorningEntry): number {
  if (a.day !== b.day) return a.day < b.day ? 1 : -1
  const atA = Date.parse(a.at)
  const atB = Date.parse(b.at)
  return (Number.isNaN(atB) ? -Infinity : atB) - (Number.isNaN(atA) ? -Infinity : atA) || 0
}

/** Die Einträge, der jüngste zuerst. Umgekehrt vorsortiert, damit bei völligem Gleichstand der spätere der Liste gilt. */
function sortedNewestFirst(entries: readonly MorningEntry[]): MorningEntry[] {
  return [...entries].reverse().sort(newerFirst)
}

// ── Welche Karte ─────────────────────────────────────────────────────────────────────────────────

/** Der Eintrag von heute (Ortszeit); bei zwei Einträgen am Tag der mit dem späteren `at`; `null` ohne Eintrag. */
export function todayEntry(entries: readonly MorningEntry[], now: Date): MorningEntry | null {
  const today = dayKey(now)
  return sortedNewestFirst(entries).find((e) => e.day === today) ?? null
}

/**
 * „Dein Tag“, sobald es einen Eintrag von heute gibt (bis Mitternacht, zu jeder Stunde); sonst „Guten Morgen“ von
 * 4:00 bis 10:59; sonst keine Karte.
 */
export function morningCard(entries: readonly MorningEntry[], now: Date): 'guten-morgen' | 'dein-tag' | null {
  if (todayEntry(entries, now)) return 'dein-tag'
  const h = now.getHours()
  return h >= MORNING_FROM && h < MORNING_UNTIL ? 'guten-morgen' : null
}

// ── Übung des Tages ──────────────────────────────────────────────────────────────────────────────

/**
 * Die Übung des Tages: Tage seit 1.1.1970 nach Ortszeit, davon der Rest durch 3. Der Tag kommt aus `Date.UTC` der
 * lokalen Kalenderdaten, nicht aus der Zeitstempel-Differenz; so ist jeder Tag genau eine Zahl, auch an Tagen mit
 * 23 oder 25 Stunden, und 23:59 sowie 0:00 desselben Kalendertags ergeben dieselbe Übung.
 */
export function exerciseOfDay(now: Date): MorningExerciseId {
  const dayNumber = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS
  // Zweimal Rest, damit Tage vor 1970 (negative Zahlen) nicht negativ indizieren.
  const index = ((dayNumber % MORNING_EXERCISES.length) + MORNING_EXERCISES.length) % MORNING_EXERCISES.length
  return MORNING_EXERCISES[index]
}

/** „Andere Übung“: die nächste der Reihenfolge, nach der letzten wieder die erste. */
export function nextExercise(id: MorningExerciseId): MorningExerciseId {
  return MORNING_EXERCISES[(MORNING_EXERCISES.indexOf(id) + 1) % MORNING_EXERCISES.length]
}

// ── Wörter und Werte ─────────────────────────────────────────────────────────────────────────────

/** Die sechs Vorschläge für den schwächsten Bereich; ohne Bereich (kein Check-in) die Standardliste. */
export function suggestions(area: EnergyArea | null): readonly string[] {
  return area === null ? INTENTIONS_DEFAULT : INTENTIONS[area]
}

/** Schreibweise-unabhängiger Schlüssel: ohne Leerraum am Rand, klein geschrieben. */
function wordKey(word: string): string {
  return word.trim().toLowerCase()
}

/**
 * Bis zu drei eigene Wörter aus den Einträgen, die jüngsten zuerst: nur solche, die in `known` nicht vorkommen
 * (Groß- und Kleinschreibung egal), ohne Doppelte; von Doppelten bleibt die Schreibweise des jüngsten Eintrags.
 */
function ownWordsOf(
  entries: readonly MorningEntry[],
  pick: (e: MorningEntry) => string | undefined,
  known: ReadonlySet<string>,
): string[] {
  const seen = new Set(known)
  const words: string[] = []
  for (const e of sortedNewestFirst(entries)) {
    const word = pick(e)?.trim()
    if (!word) continue
    const key = wordKey(word)
    if (seen.has(key)) continue
    seen.add(key)
    words.push(word)
    if (words.length === OWN_MAX) break
  }
  return words
}

/** Alle Wörter, die der Ablauf als Vorschlag anbietet (jeder Bereich und die Standardliste), klein geschrieben. */
const SUGGESTION_KEYS: ReadonlySet<string> = new Set(
  [...Object.values(INTENTIONS).flat(), ...INTENTIONS_DEFAULT].map(wordKey),
)
const VALUE_KEYS: ReadonlySet<string> = new Set(VALUES.map(wordKey))

/** „Deine Wörter“: die bis zu drei jüngsten eigenen Intentionen, die in keiner Vorschlagsliste stehen. */
export function ownWords(entries: readonly MorningEntry[]): string[] {
  return ownWordsOf(entries, (e) => e.intention, SUGGESTION_KEYS)
}

/** „Deine Werte“: die bis zu drei jüngsten eigenen Werte, die nicht in `VALUES` stehen. */
export function ownValues(entries: readonly MorningEntry[]): string[] {
  return ownWordsOf(entries, (e) => e.value, VALUE_KEYS)
}

// ── Big Domino und Zählung ───────────────────────────────────────────────────────────────────────

/**
 * Der Big Domino des jüngsten Eintrags vor heute, wenn dieser höchstens drei Kalendertage zurückliegt, einen Big
 * Domino hat und nicht erledigt ist; sonst `null`. Nur dieser eine Eintrag zählt: Hat er keinen Big Domino oder ist
 * er erledigt, wird nicht auf ältere zurückgegriffen. Einträge von heute oder später (Uhr verstellt) bleiben außen vor.
 */
export function openDomino(entries: readonly MorningEntry[], now: Date): string | null {
  const today = dayKey(now)
  const last = sortedNewestFirst(entries).find((e) => e.day < today)
  if (!last || last.day < dayKeyBack(now, DOMINO_DAYS)) return null
  return last.domino && !last.dominoDone ? last.domino : null
}

/** Zahl der Tage mit Eintrag unter heute und den sechs Kalendertagen davor (mehrere Einträge am Tag zählen einmal). */
export function morningCount(entries: readonly MorningEntry[], now: Date): number {
  const days = new Set(entries.map((e) => e.day))
  let count = 0
  for (let back = 0; back < COUNT_DAYS; back++) if (days.has(dayKeyBack(now, back))) count++
  return count
}

/** „Morgen-Start an 4 der letzten 7 Tage“. */
export function morningCountLine(n: number): string {
  return `Morgen-Start an ${n} der letzten ${COUNT_DAYS} Tage`
}
