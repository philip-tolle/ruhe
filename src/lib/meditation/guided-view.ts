// Geführte Meditationen in der Oberfläche: Einträge der Liste, Anzeige im Player und die Balance
// zwischen Stimme und Hintergrund. Reine Funktionen, ohne Audio- und Speicherzugriff.
import { audioUrl, durationMinutes, type Meditation } from '../content/catalog'

/** Sekunden je Tipp auf „15 Sekunden zurück“ bzw. „15 Sekunden vor“. */
export const SEEK_SECONDS = 15

// Abstand des Hintergrunds zur Stimme knapp über 0 (dB); bei voller Balance sind beide gleich laut.
const QUIETEST_DB = -30
// So viel leiser als die Stimme sind die Hintergrundklänge abgemischt (−26 zu −19 LUFS).
const MIX_GAP_DB = 7

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Name eines Eintrags für Screenreader, z. B. „Guten Morgen, 5 Minuten, offline verfügbar“. */
export function entryLabel(m: Pick<Meditation, 'title' | 'duration'>, saved: boolean): string {
  const n = durationMinutes(m)
  const minutes = n === 1 ? '1 Minute' : `${n} Minuten`
  return `${m.title}, ${minutes}${saved ? ', offline verfügbar' : ''}`
}

/**
 * Startbar ist ein Eintrag online immer, offline nur, wenn die Datei gespeichert ist. `saved` ist
 * `undefined`, solange der Cache noch nicht geprüft ist: Dann wird der Eintrag nicht gesperrt (er
 * könnte gespeichert sein), erst die Prüfung sperrt ihn.
 */
export function startable(saved: boolean | undefined, online: boolean): boolean {
  return online || saved !== false
}

/**
 * Adresse der Datei, absolut gegen `base` (die Adresse der Seite). Die Engine spielt sie, und der
 * Offline-Status ist unter ihr vermerkt; sie trägt die Version (`audioUrl`).
 */
export function absoluteAudioUrl(m: Meditation, base: string): string {
  return new URL(audioUrl(m), base).href
}

export interface GuidedLevels {
  voice: number // 0 … 1
  background: number // 0 … 1
}

/**
 * Lautstärken von Stimme und Hintergrund aus der Balance (0 … 1). Der Abstand des Hintergrunds zur
 * Stimme wächst gleichmäßig in dB, wie das Ohr Lautstärke hört: knapp über 0 liegt er 30 dB unter der
 * Stimme, je 10 % 3 dB näher, bei 1 ist er gleich laut (Standard 0,5: 15 dB darunter); 0 ist aus. Ab
 * etwa 77 % spielt der Hintergrund voll, darüber gibt die Stimme nach (bei 1 um 7 dB), statt ihn über 1
 * zu verstärken und den Begrenzer pumpen zu lassen. Ohne Hintergrund bleibt die Stimme voll.
 */
export function guidedLevels(balance: number, withBackground: boolean): GuidedLevels {
  const b = clamp01(balance)
  if (b === 0) return { voice: 1, background: 0 }
  const gain = 10 ** ((QUIETEST_DB * (1 - b) + MIX_GAP_DB) / 20) // Hintergrund gegen die volle Stimme
  return { voice: withBackground ? Math.min(1, 1 / gain) : 1, background: Math.min(1, gain) }
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
