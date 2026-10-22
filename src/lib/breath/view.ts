// Atemübung in der Oberfläche: Kreisgröße, Phasenring, Farbe, Leuchten, Vibration und Phasenwechsel
// aus dem Stand der Anzeige. Reine Funktionen, ohne Audio- und Speicherzugriff.
import { softBreaks } from '../text'
import type { BreathMoment, BreathPattern, PhaseKind } from './patterns'

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

const PHASE_COLOR: Record<PhaseKind, string> = {
  ein: '#B7A8F0', // Lavendel
  halten: '#F2C98A', // warmes Gold
  aus: '#8FD0D6', // Türkis
}

/** Farbe von Blüte, Leuchten und Phasenring. */
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

/** Sekunden als Zahl mit deutschem Dezimalkomma, ohne überflüssige Nullen: 5,5 → „5,5“, 4 → „4“. */
function secondsText(seconds: number): string {
  return String(seconds).replace('.', ',')
}

/**
 * Rhythmus für die Kachel: die Sekunden jeder Phase hintereinander. Aufeinanderfolgende Phasen
 * gleicher Art (Einatmen und Nachatmen) stehen mit „+“, alle anderen mit „-“: 4-7-8, 5,5-5,5, 3+1-6.
 */
export function rhythmLabel(pattern: BreathPattern): string {
  return pattern.phases
    .map((phase, i) => {
      const previous = pattern.phases[i - 1]
      const separator = i === 0 ? '' : previous.kind === phase.kind ? '+' : '-'
      return separator + secondsText(phase.seconds)
    })
    .join('')
}

// Weiche Trennstellen (U+00AD) an den Silbengrenzen der langen Wörter in den Titeln.
const TITLE_BREAKS: Record<string, string> = {
  Physiologischer: 'Physio\u00ADlogischer',
  Wechselatmung: 'Wechsel\u00ADatmung',
  Kohärentes: 'Kohä\u00ADrentes',
  Ausatmen: 'Aus\u00ADatmen',
}

/** Titel für die Kachel mit weichen Trennstellen in den langen Wörtern. Nur zur Anzeige: Der Name des Knopfes bleibt der Titel selbst. */
export function tileTitle(title: string): string {
  return softBreaks(title, TITLE_BREAKS)
}

const PETAL_REST = 0.04 // Blattversatz bei Atemstand 0: knapp nach innen
const PETAL_SPREAD = 0.17 // Weg nach außen bis zum Atemstand 1

/** Versatz der Blütenblätter als Anteil der Blattlänge: positiv nach innen, negativ nach außen. */
export function petalOffset(level: number): number {
  return PETAL_REST - PETAL_SPREAD * level
}
