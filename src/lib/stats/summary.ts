// Statistik: Serie, Gesamtminuten und Kalendertage. Reine Berechnung.
// Tage sind lokale Kalendertage (Mitternacht lokaler Zeit); maßgeblich ist der Start der Sitzung.
import type { Session } from './schema'

/** Eine Sitzung zählt ab dieser Dauer in Sekunden. */
export const MIN_SECONDS = 60

/** Lokaler Kalendertag als `JJJJ-MM-TT`. */
export function dayKey(d: Date): string {
  const p = (n: number, width = 2) => String(n).padStart(width, '0')
  return `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Ob ein Kalendertag `JJJJ-MM-TT` ein Sonntag ist (lokal gerechnet, wie `dayKey`). */
export function isSunday(day: string): boolean {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() === 0
}

/**
 * Tage in Folge mit mindestens einer Sitzung. Gezählt wird ab heute rückwärts, hat heute noch
 * keine Sitzung, ab gestern. Die Tage rechnet der Kalender (kein 24-Stunden-Schritt), damit
 * Tage mit 23 oder 25 Stunden bei der Zeitumstellung nicht zählen.
 */
export function streak(sessions: Session[], now: Date): number {
  const days = new Set(sessions.map(s => dayKey(new Date(s.start))))
  const [y, m, d] = [now.getFullYear(), now.getMonth(), now.getDate()]
  const daysBack = (back: number) => dayKey(new Date(y, m, d - back))
  const first = days.has(daysBack(0)) ? 0 : 1
  let count = 0
  while (days.has(daysBack(first + count))) count++
  return count
}

/** Summe aller Sekunden in ganzen Minuten, abgerundet. */
export function totalMinutes(sessions: Session[]): number {
  return Math.floor(sessions.reduce((sum, s) => sum + s.seconds, 0) / 60)
}

/** Tage (1–31) des Monats `month0` (0 = Januar) mit mindestens einer Sitzung. */
export function daysInMonth(sessions: Session[], year: number, month0: number): Set<number> {
  const days = new Set<number>()
  for (const s of sessions) {
    const start = new Date(s.start)
    if (start.getFullYear() === year && start.getMonth() === month0) days.add(start.getDate())
  }
  return days
}
