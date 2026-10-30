// Abend-Logbuch (Spec M11 §4.3): Logbuch-Tag, welche Karte wann, Rückblick, eigene Stichworte und Fokus-Wörter,
// Wochenauswertung, Erinnerung für den Morgen-Start und Zählung der letzten 7 Tage. Reine Funktionen: `now` bzw. der
// Tag kommt als Eingabe, kein Zugriff auf Speicher oder Oberfläche.
import { MORNING_FROM, MORNING_UNTIL } from '../morning/logic'
import type { EveningEntry, MorningEntry } from '../stats/schema'
import { dayKey } from '../stats/summary'
import { FOCUS_SUGGESTIONS, tagsOf, type TagSide } from './words'

/** Die Karte „Tag abschließen“ steht von dieser Stunde an (Ortszeit) bis zur Tagesgrenze. */
export const EVENING_FROM = 18
/** Vor dieser Stunde gehört das Logbuch noch zum Vortag; dieselbe Grenze, an der der Morgen beginnt. */
const DAY_START = MORNING_FROM
/** Die Wochenauswertung und die Zählung umfassen den Logbuch-Tag und die 6 Tage davor. */
const WEEK_DAYS = 7
/** So viele eigene Stichworte bzw. Fokus-Wörter stehen höchstens vorn. */
const OWN_TAGS_MAX = 8
const OWN_FOCUS_MAX = 3
/** Die Wochenauswertung zeigt je Seite die stärksten drei Stichworte. */
const TOP = 3

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

// ── Kalendertage ─────────────────────────────────────────────────────────────────────────────────

/** Der Kalendertag `delta` Tage nach `day` (negativ: davor); der Kalender rechnet, nicht die Millisekunden. */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + delta))
}

/** Der Logbuch-Tag von `now`: der Kalendertag, vor 4:00 der Vortag. */
export function logbookDay(now: Date): string {
  const today = dayKey(now)
  return now.getHours() < DAY_START ? shiftDay(today, -1) : today
}

/** Die sieben Tage bis einschließlich `day`, der älteste zuerst. */
function weekDays(day: string): string[] {
  const from = shiftDay(day, -(WEEK_DAYS - 1))
  return Array.from({ length: WEEK_DAYS }, (_, i) => shiftDay(from, i))
}

/** Der Eintrag eines Tages; bei zwei der mit dem späteren `at` (bei gleichem Zeitpunkt der erste). */
function latestOf<T extends { day: string; at: string }>(list: readonly T[], day: string): T | null {
  let best: T | null = null
  for (const entry of list) {
    if (entry.day === day && (!best || Date.parse(entry.at) > Date.parse(best.at))) best = entry
  }
  return best
}

/** Absteigend nach Tag, bei gleichem Tag nach `at`. */
function newestFirst<T extends { day: string; at: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (a.day !== b.day ? (a.day < b.day ? 1 : -1) : Date.parse(b.at) - Date.parse(a.at) || 0))
}

// ── Welche Karte ─────────────────────────────────────────────────────────────────────────────────

/** Das Logbuch eines Logbuch-Tages oder `null`. */
export function eveningEntry(evenings: readonly EveningEntry[], day: string): EveningEntry | null {
  return latestOf(evenings, day)
}

/**
 * Im Morgen-Fenster (4:00–10:59) keine Abend-Karte; sonst „Dein Abend“, sobald es ein Logbuch für den Logbuch-Tag gibt;
 * sonst „Tag abschließen“ von 18:00 bis 3:59; sonst keine Karte.
 */
export function eveningCard(evenings: readonly EveningEntry[], now: Date): 'tag-abschliessen' | 'dein-abend' | null {
  const h = now.getHours()
  if (h >= MORNING_FROM && h < MORNING_UNTIL) return null
  if (eveningEntry(evenings, logbookDay(now))) return 'dein-abend'
  return h >= EVENING_FROM || h < DAY_START ? 'tag-abschliessen' : null
}

/** Der Morgen-Eintrag eines Tages (für Rückblick und „Dein Abend“) oder `null`. */
export function morningEntry(mornings: readonly MorningEntry[], day: string): MorningEntry | null {
  return latestOf(mornings, day)
}

/** Ob der Morgen-Eintrag von `day` etwas zum Zurückblicken hat: einen Big Domino oder eine Intention. */
export function hasReview(mornings: readonly MorningEntry[], day: string): boolean {
  const entry = morningEntry(mornings, day)
  return Boolean(entry && (entry.domino || entry.intention))
}

// ── Eigene Stichworte und Fokus-Wörter ───────────────────────────────────────────────────────────

/** Die jüngsten Wörter aus `pick`, die nicht in `suggested` stehen, ohne Doppelte (Groß- und Kleinschreibung egal). */
function ownOf(evenings: readonly EveningEntry[], pick: (e: EveningEntry) => readonly string[], suggested: readonly string[], max: number): string[] {
  const skip = new Set(suggested.map((w) => w.toLowerCase()))
  const own: string[] = []
  for (const entry of newestFirst(evenings)) {
    for (const word of pick(entry)) {
      const key = word.toLowerCase()
      if (skip.has(key)) continue
      skip.add(key)
      own.push(word)
      if (own.length >= max) return own
    }
  }
  return own
}

/** „Deine Stichworte“ einer Seite: bis zu 8 eigene, die jüngsten zuerst, in der Schreibweise des jüngsten Vorkommens. */
export function ownTags(evenings: readonly EveningEntry[], side: TagSide): string[] {
  return ownOf(evenings, (e) => e[side] ?? [], tagsOf(side), OWN_TAGS_MAX)
}

/** „Deine Wörter“ beim Wochenfokus: bis zu 3 eigene, die jüngsten zuerst. */
export function ownFocus(evenings: readonly EveningEntry[]): string[] {
  return ownOf(evenings, (e) => (e.weekFocus ? [e.weekFocus] : []), FOCUS_SUGGESTIONS, OWN_FOCUS_MAX)
}

// ── Wochenauswertung ─────────────────────────────────────────────────────────────────────────────

export interface TagCount {
  tag: string
  count: number
}

export type DominoDay = 'geschafft' | 'offen' | 'keiner'

export interface WeekReview {
  /** Erster und letzter Tag `JJJJ-MM-TT`; `to` ist der Logbuch-Tag. */
  from: string
  to: string
  /** Tage mit Logbuch (der Entwurf zählt mit). */
  days: number
  gave: TagCount[]
  cost: TagCount[]
  /** Big Domino je Tag, der älteste zuerst (7 Einträge). */
  dominos: DominoDay[]
  dominoDone: number
  dominoSet: number
  /** Alle „Gelernt“-Sätze der Woche, der jüngste zuerst. */
  learned: string[]
}

/** Zählt je Stichwort die Tage, an denen es gewählt war; Rangfolge Zahl → jüngster Tag → alphabetisch, die ersten drei. */
function topTags(days: readonly string[], byDay: ReadonlyMap<string, EveningEntry>, side: TagSide): TagCount[] {
  const counts = new Map<string, { tag: string; count: number; last: string }>()
  for (const day of days) {
    const seen = new Set<string>()
    for (const tag of byDay.get(day)?.[side] ?? []) {
      const key = tag.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const known = counts.get(key)
      counts.set(key, { tag, count: (known?.count ?? 0) + 1, last: day })
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || (a.last !== b.last ? (a.last < b.last ? 1 : -1) : a.tag.localeCompare(b.tag, 'de')))
    .slice(0, TOP)
    .map(({ tag, count }) => ({ tag, count }))
}

/**
 * Die Woche bis einschließlich `day` (Logbuch-Tag und die 6 Tage davor). `draft` steht für den noch nicht gespeicherten
 * Durchgang von `day` und ersetzt dessen gespeicherten Eintrag.
 */
export function weekReview(evenings: readonly EveningEntry[], mornings: readonly MorningEntry[], day: string, draft?: EveningEntry): WeekReview {
  const days = weekDays(day)
  const byDay = new Map<string, EveningEntry>()
  for (const d of days) {
    const entry = d === day && draft ? draft : eveningEntry(evenings, d)
    if (entry) byDay.set(d, entry)
  }
  const dominos = days.map((d): DominoDay => {
    const m = latestOf(mornings, d)
    return !m?.domino ? 'keiner' : m.dominoDone ? 'geschafft' : 'offen'
  })
  return {
    from: days[0],
    to: day,
    days: byDay.size,
    gave: topTags(days, byDay, 'gave'),
    cost: topTags(days, byDay, 'cost'),
    dominos,
    dominoDone: dominos.filter((d) => d === 'geschafft').length,
    dominoSet: dominos.filter((d) => d !== 'keiner').length,
    learned: [...days].reverse().flatMap((d) => byDay.get(d)?.learned ?? []),
  }
}

/** „29. Oktober“ */
function dateLabel(day: string): string {
  const [, m, d] = day.split('-').map(Number)
  return `${d}. ${MONTHS[m - 1]}`
}

/** „23. Oktober bis 29. Oktober · Logbuch an 5 Tagen“ */
export function weekRangeLine(review: WeekReview): string {
  return `${dateLabel(review.from)} bis ${dateLabel(review.to)} · Logbuch an ${review.days} ${review.days === 1 ? 'Tag' : 'Tagen'}`
}

/** „Bewegung · 4×“ */
export function tagCountLine(t: TagCount): string {
  return `${t.tag} · ${t.count}×`
}

/** „4 von 6 geschafft“; ohne Big Domino in der Woche `null` (die Ansicht sagt dann „Diese Woche ohne Big Domino.“). */
export function dominoLine(review: WeekReview): string | null {
  return review.dominoSet === 0 ? null : `${review.dominoDone} von ${review.dominoSet} geschafft`
}

// ── Erinnerung im Morgen-Start und Zählung ───────────────────────────────────────────────────────

/**
 * Was der Morgen-Start an `now` (Kalendertag) aus dem Logbuch aufgreift: den 1-%-Satz aus dem Logbuch des Vortags und
 * den jüngsten Wochenfokus, dessen Tag 1 bis 7 Tage zurückliegt. Ein am Sonntag gesetzter Fokus gilt also von Montag bis
 * einschließlich zum nächsten Sonntag.
 */
export function morningReminder(evenings: readonly EveningEntry[], now: Date): { better: string | null; weekFocus: string | null } {
  const today = dayKey(now)
  const yesterday = shiftDay(today, -1)
  const oldest = shiftDay(today, -WEEK_DAYS)
  const focus = newestFirst(evenings).find((e) => e.weekFocus && e.day >= oldest && e.day <= yesterday)
  return { better: eveningEntry(evenings, yesterday)?.better ?? null, weekFocus: focus?.weekFocus ?? null }
}

/** Zahl der Tage mit Logbuch unter dem Logbuch-Tag und den 6 Kalendertagen davor. */
export function eveningCount(evenings: readonly EveningEntry[], now: Date): number {
  const days = new Set(evenings.map((e) => e.day))
  return weekDays(logbookDay(now)).filter((d) => days.has(d)).length
}

/** „Logbuch an 5 der letzten 7 Tage“ */
export function eveningCountLine(n: number): string {
  return `Logbuch an ${n} der letzten ${WEEK_DAYS} Tage`
}

/** Die Zeile über „Weiter“ bei Geber und Räuber. */
export function chosenLine(n: number): string {
  return n === 0 ? 'Nichts gewählt' : `${n} gewählt`
}
