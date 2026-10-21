// Sleep-Timer-Plan: reine Berechnung, ohne Audio-Zugriff.
// Zeiten sind Sekunden ab Planbeginn; die Audio-Engine plant damit auf der AudioContext-Uhr.

/** Auswahl im Sleep-Timer in Minuten; `null` bedeutet endlos. */
export const SLEEP_OPTIONS: readonly (number | null)[] = [15, 30, 45, 60, 90, null]

/** Dauer des Ausblendens in Sekunden vor Ende. */
export const FADE_SECONDS = 60

export interface SleepPlan {
  /** Sekunde, ab der ausgeblendet wird. */
  fadeStart: number
  /** Sekunde, zu der die Wiedergabe endet. */
  end: number
}

/**
 * Plan für eine Sleep-Dauer. Kürzer als 60 s: das Ausblenden beginnt sofort.
 * Bruchteile von Minuten sind erlaubt (für Tests).
 */
export function sleepPlan(minutes: number | null): SleepPlan | null {
  if (minutes === null) return null
  const end = minutes * 60
  return { fadeStart: Math.max(0, end - FADE_SECONDS), end }
}
