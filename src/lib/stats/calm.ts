// Ruhe-Check-in (Spec M6): die fünf Stufen und die Auswertung für „Ich“. Reine Berechnung.
// Zeiträume rechnen in lokalen Kalendertagen ab heute (wie `dayKey`), maßgeblich ist der Start der
// Sitzung; Sitzungen mit einem Datum nach heute zählen nirgends.
import type { CalmLevel, Session } from './schema'

/** Die Skala: Wort und Farbe je Stufe; die Bedeutung trägt immer das Wort. */
export const CALM_LEVELS: readonly { level: CalmLevel; word: string; color: string }[] = [
  { level: 1, word: 'sehr unruhig', color: '#E7A29A' },
  { level: 2, word: 'etwas unruhig', color: '#E9B894' },
  { level: 3, word: 'teils, teils', color: '#E6CF9A' },
  { level: 4, word: 'ruhig', color: '#B9D3C0' },
  { level: 5, word: 'ganz ruhig', color: '#8FD0D6' },
]

/** Länge eines Zeitraums in Kalendertagen. */
export const CALM_DAYS = 30
/** So viele Werte braucht ein Mittelwert, bevor er etwas aussagt. */
export const CALM_MIN = 3
/** Ein kleinerer Unterschied (Betrag) gilt als „etwa gleich“. */
export const CALM_THRESHOLD = 0.3

/** Mittel von „Jetzt − Vorher“ der letzten 30 Tage; je Art `null` unter `CALM_MIN` Paaren. */
export interface CalmEffect {
  mean: number
  count: number
  breath: number | null
  meditation: number | null
}

/** Mittel der Vorher-Werte: letzte 30 Tage und die 30 Tage davor. */
export interface CalmTrend {
  recent: number
  previous: number
}

// Kalendertage von `start` bis `now`, über die lokalen Datumsangaben: Tage mit 23 oder 25 Stunden
// (Zeitumstellung) zählen wie alle anderen.
function daysBack(start: Date, now: Date): number {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((day(now) - day(start)) / 86_400_000)
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length
const meanOrNull = (values: number[]) => (values.length >= CALM_MIN ? mean(values) : null)

function inWindow(s: Session, now: Date, from: number): boolean {
  const back = daysBack(new Date(s.start), now)
  return back >= from && back < from + CALM_DAYS
}

export function calmEffect(sessions: readonly Session[], now: Date): CalmEffect | null {
  const pairs = sessions.filter((s) => s.calm?.before !== undefined && s.calm.after !== undefined && inWindow(s, now, 0))
  if (pairs.length < CALM_MIN) return null
  const change = (s: Session) => s.calm!.after! - s.calm!.before!
  return {
    mean: mean(pairs.map(change)),
    count: pairs.length,
    breath: meanOrNull(pairs.filter((s) => s.kind === 'breath').map(change)),
    meditation: meanOrNull(pairs.filter((s) => s.kind !== 'breath').map(change)),
  }
}

export function calmTrend(sessions: readonly Session[], now: Date): CalmTrend | null {
  const before = (from: number) =>
    sessions.filter((s) => s.calm?.before !== undefined && inWindow(s, now, from)).map((s) => s.calm!.before!)
  const recent = meanOrNull(before(0))
  const previous = meanOrNull(before(CALM_DAYS))
  return recent === null || previous === null ? null : { recent, previous }
}
