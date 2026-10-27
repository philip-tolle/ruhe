// Beschriftungen der Hack-Oberfläche (Spec M9 §3.2, §3.4, §3.5): Reset-Karte, Kachel, Hack-Karte und Player nennen
// dieselben Zeilen. Reine Funktionen, damit sich die Texte ohne Oberfläche prüfen lassen.
import { patternById } from '../breath/patterns'
import { formatRemaining } from '../time/format'
import { AREA_INFO } from './areas'
import { hackLength, type Hack } from './hacks'

/** „Geist · 3 Min“: Bereich des Hacks und seine Nenndauer. */
export function areaLine(h: Hack): string {
  return `${AREA_INFO[h.area].title} · ${h.minutes} Min`
}

/** „Starten · 1:04“: die Laufzeit (bei Takt-Hacks ganze Zyklen), wie der Player sie zählt. */
export function startLabel(h: Hack): string {
  return `Starten · ${formatRemaining(hackLength(h))}`
}

/** Titel der festen Atemübung, auf die „Passt dazu“ verweist; `null` ohne Verweis. */
export function linkTitle(h: Hack): string | null {
  return h.link ? patternById(h.link.id).title : null
}

/** „Schritt 2 von 4“ für den Schritt mit dem Index `index` (ab 0). */
export function stepLabel(index: number, count: number): string {
  return `Schritt ${index + 1} von ${count}`
}

/** „Runde 4 von 8“; bei einer einzigen Runde (etwa der Wach-Atmung) gibt es nichts zu zählen: `null`. */
export function roundLabel(round: number, rounds: number): string | null {
  return rounds > 1 ? `Runde ${round} von ${rounds}` : null
}

/**
 * Der Vorschlag des Jetzt-Resets nach `skip` Tipps auf „Anderer“: der Eintrag `skip % Länge`, am Ende der Folge wieder
 * der erste. Die Folge kann leer sein (alle Hacks außerhalb ihres Zeitfensters): dann `null` statt einer Teilung durch 0.
 */
export function resetPick<T>(sequence: readonly T[], skip: number): T | null {
  return sequence.length === 0 ? null : sequence[skip % sequence.length]
}
