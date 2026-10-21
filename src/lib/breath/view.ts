// Atemübung in der Oberfläche: Kreisgröße und Phasenwechsel aus dem Stand der Anzeige.
// Reine Funktionen, ohne Audio- und Speicherzugriff.
import type { BreathMoment } from './patterns'

const SMALLEST = 0.6 // Skalierung des Kreises bei Atemstand 0 (ausgeatmet)
const RANGE = 0.4 // bis zur vollen Größe bei Atemstand 1

/** Skalierung des Kreises: wächst beim Einatmen, ruht beim Halten, schrumpft beim Ausatmen. */
export function circleScale(level: number): number {
  return SMALLEST + RANGE * level
}

/**
 * Hat zwischen zwei Bildern eine neue Phase begonnen? Das erste Bild (`previous` ist `null`) ist
 * kein Wechsel. Zwei gleiche Phasen hintereinander erkennt man daran, dass die Phase wieder von
 * vorn zählt.
 */
export function phaseChanged(previous: BreathMoment | null, next: BreathMoment): boolean {
  if (!previous) return false
  return previous.kind !== next.kind || previous.label !== next.label || next.phaseElapsed < previous.phaseElapsed
}
