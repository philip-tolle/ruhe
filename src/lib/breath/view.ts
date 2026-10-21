// Atemübung in der Oberfläche: Kreisgröße, Phasenring, Farbe, Leuchten, Vibration und Phasenwechsel
// aus dem Stand der Anzeige. Reine Funktionen, ohne Audio- und Speicherzugriff.
import type { BreathMoment, PhaseKind } from './patterns'

const SMALLEST = 0.45 // Skalierung des Kreises bei Atemstand 0 (ausgeatmet)
const RANGE = 0.55 // bis zur vollen Größe bei Atemstand 1

/** Skalierung des Kreises: wächst beim Einatmen, ruht beim Halten, schrumpft beim Ausatmen. */
export function circleScale(level: number): number {
  return SMALLEST + RANGE * level
}

/** Anteil der laufenden Phase, 0 … 1: Daran füllt sich der Phasenring. */
export function phaseProgress(m: BreathMoment): number {
  return Math.min(1, Math.max(0, m.phaseElapsed / m.phaseLength))
}

/**
 * Atemstand mit sanftem Ein- und Ausschwingen in jeder Phase (Sinus statt linear): Der Kreis
 * beginnt und endet eine Phase langsam und ist auf halber Strecke am schnellsten.
 */
export function easedLevel(m: BreathMoment): number {
  return m.startLevel + (m.endLevel - m.startLevel) * (1 - Math.cos(Math.PI * phaseProgress(m))) / 2
}

const PULSE_SECONDS = 3.5 // ungefähre Länge einer Welle des Leuchtens beim Halten

/**
 * Sanftes Pulsieren des Leuchtens beim Halten, 0 … 1; in den anderen Phasen 0. Ganze Wellen von
 * etwa 3,5 s, damit es am Beginn und am Ende des Haltens ruht und ohne Sprung in die nächste Phase geht.
 */
export function holdPulse(m: BreathMoment): number {
  if (m.kind !== 'halten') return 0
  const waves = Math.max(1, Math.round(m.phaseLength / PULSE_SECONDS))
  return (1 - Math.cos(2 * Math.PI * waves * phaseProgress(m))) / 2
}

const PHASE_COLOR: Record<PhaseKind, string> = {
  ein: '#F2C98A', // warmes Gold
  halten: '#C9B8F0', // helles, ruhiges Lila
  aus: '#8FB8E8', // kühles Blau
}

/** Farbe von Kreis, Leuchten und Phasenring. */
export function phaseColor(kind: PhaseKind): string {
  return PHASE_COLOR[kind]
}

const VIBRATION: Record<PhaseKind, readonly number[]> = {
  ein: [200], // ein langer Puls
  halten: [60], // kurzes Antippen
  aus: [150, 120, 150], // zwei Pulse
}

/** Vibrationsmuster für `navigator.vibrate` zu Beginn einer Phase (Millisekunden, an/aus im Wechsel). */
export function vibrationPattern(kind: PhaseKind): number[] {
  return [...VIBRATION[kind]]
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
