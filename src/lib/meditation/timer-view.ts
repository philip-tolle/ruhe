// Timer in der Oberfläche: gemerkte Einstellungen lesen, beschreiben und die laufende Zeit
// anzeigen. Reine Funktionen, ohne Audio- und Speicherzugriff.
import { backgroundById } from '../sounds/catalog'
import type { Settings } from '../stats/schema'
import { clampMinutes, type TimerSettings } from './timer-plan'

/** Die gemerkten Timer-Einstellungen; die Minuten laufen wie jede Eingabe über `clampMinutes`. */
export function savedTimer(s: Settings): TimerSettings {
  return { minutes: clampMinutes(s.timer.minutes), intervalMin: s.timer.intervalMin, sound: s.timerSound, lead: s.timerLead }
}

/** Beschriftung einer Intervall-Auswahl im Sheet. */
export function intervalLabel(intervalMin: number | null): string {
  if (intervalMin === null) return 'Aus'
  if (intervalMin === 1) return 'Jede Minute'
  return `Alle ${intervalMin} Min`
}

/** Zusammenfassung auf der Karte, z. B. „20 Min · Klangschale alle 5 Min · Regen“. */
export function timerSummary(t: Pick<TimerSettings, 'minutes' | 'intervalMin' | 'sound'>): string {
  const interval =
    t.intervalMin === null
      ? 'ohne Zwischenschale'
      : t.intervalMin === 1
        ? 'Klangschale jede Minute'
        : `Klangschale alle ${t.intervalMin} Min`
  const parts = [`${t.minutes} Min`, interval]
  if (t.sound !== null) parts.push(backgroundById(t.sound).title)
  return parts.join(' · ')
}

export interface TimerDisplay {
  /** Restsekunden des Vorlaufs (10 … 1), danach `null`. */
  arriving: number | null
  /** Restzeit der gezählten Dauer in Sekunden; im Vorlauf die ganze Dauer, am Ende auch unter 0. */
  remaining: number
  /** Anteil der gezählten Dauer für den Fortschrittsring, 0 … 1. */
  progress: number
}

/** Anzeige zum Zeitpunkt `elapsed` (s seit Programmstart, Pausen zählen nicht). */
export function timerDisplay(p: { lead: number; length: number }, elapsed: number): TimerDisplay {
  const counted = elapsed - p.lead
  return {
    arriving: counted < 0 ? Math.ceil(-counted) : null,
    remaining: Math.min(p.length, p.length - counted),
    progress: p.length > 0 ? Math.min(1, Math.max(0, counted / p.length)) : 1,
  }
}
