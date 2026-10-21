// Geführte Meditationen in der Oberfläche: Einträge der Liste, Anzeige im Player und die Balance
// zwischen Stimme und Hintergrund. Reine Funktionen, ohne Audio- und Speicherzugriff.
import { audioUrl, durationMinutes, type Meditation } from '../content/catalog'

/** Sekunden je Tipp auf „15 Sekunden zurück“ bzw. „15 Sekunden vor“. */
export const SEEK_SECONDS = 15

// Lautstärke des Hintergrunds bei voller Balance; so laut wie ein Klang im Klänge-Reiter.
const MAX_BACKGROUND = 0.7

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Name eines Eintrags für Screenreader, z. B. „Guten Morgen, 5 Minuten, offline verfügbar“. */
export function entryLabel(m: Pick<Meditation, 'title' | 'duration'>, saved: boolean): string {
  const n = durationMinutes(m)
  const minutes = n === 1 ? '1 Minute' : `${n} Minuten`
  return `${m.title}, ${minutes}${saved ? ', offline verfügbar' : ''}`
}

/** Startbar ist ein Eintrag online immer, offline nur, wenn die Datei gespeichert ist. */
export function startable(saved: boolean, online: boolean): boolean {
  return online || saved
}

/**
 * Adresse der Datei, absolut gegen `base` (die Adresse der Seite). Die Engine spielt sie, und der
 * Offline-Status ist unter ihr vermerkt; sie trägt die Version (`audioUrl`).
 */
export function absoluteAudioUrl(m: Meditation, base: string): string {
  return new URL(audioUrl(m), base).href
}

/** Lautstärke des Hintergrunds aus der Balance (0 … 1): 0,7 × Balance, Standard 0,5 → 0,35. */
export function backgroundVolume(balance: number): number {
  return MAX_BACKGROUND * clamp01(balance)
}

/** Balance als ganze Prozent für den Regler. */
export function balancePercent(balance: number): number {
  return Math.round(clamp01(balance) * 100)
}

/** Reglerwert in Prozent als Balance 0 … 1. */
export function balanceFromPercent(percent: number): number {
  return clamp01(Math.round(percent) / 100)
}

export interface GuidedDisplay {
  /** Restzeit in Sekunden, nie unter 0. */
  remaining: number
  /** Anteil des Gehörten für den Fortschrittsring, 0 … 1. */
  progress: number
}

/**
 * Anzeige an der Position `elapsed` (s in der Datei). Bis die Länge der Datei bekannt ist
 * (`length` 0), gilt die Länge laut Katalog (`fallback`), und der Ring bleibt leer.
 */
export function guidedDisplay(length: number, fallback: number, elapsed: number): GuidedDisplay {
  const total = length > 0 ? length : fallback
  return {
    remaining: Math.max(0, total - elapsed),
    progress: length > 0 ? clamp01(elapsed / length) : 0,
  }
}

/** Spulen geht, sobald die Länge bekannt ist, und nicht, solange die Datei nicht lädt. */
export function canSeek(p: { length: number; error: boolean }): boolean {
  return p.length > 0 && !p.error
}
