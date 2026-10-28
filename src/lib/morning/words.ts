// Morgen-Start (Spec M10 §3): Übungen zum Aktivieren, Wortlisten für Intention und Wert, Längengrenzen der Eingaben.
// Reine Daten ohne Zugriff auf Speicher oder Oberfläche; die Übungen selbst stehen als Hacks in content/hacks.json.
import type { EnergyArea } from '../energy/areas'

/** Die Übungen des Aktivierens in fester Reihenfolge; am Tag `t` ist es die Übung `t mod 3`, „Andere Übung“ nimmt die nächste. */
export const MORNING_EXERCISES = ['strecken', 'wasser-licht', 'wach-klopfen'] as const

export type MorningExerciseId = (typeof MORNING_EXERCISES)[number]

/** Sechs Vorschläge für die Intention („Heute will ich … sein.“), je nach schwächstem Bereich des Check-ins. */
export const INTENTIONS: Record<EnergyArea, readonly string[]> = {
  koerper: ['geerdet', 'kraftvoll', 'leicht', 'beweglich', 'sanft mit mir', 'achtsam'],
  gefuehl: ['gelassen', 'freundlich', 'zuversichtlich', 'verbunden', 'geduldig', 'heiter'],
  geist: ['klar', 'fokussiert', 'wach', 'neugierig', 'gesammelt', 'entschieden'],
  sinn: ['mutig', 'ausgerichtet', 'dankbar', 'großzügig', 'echt', 'entschlossen'],
}

/** Vorschläge, wenn es weder im Ablauf noch frisch einen Check-in gibt. */
export const INTENTIONS_DEFAULT: readonly string[] = ['klar', 'gelassen', 'mutig', 'freundlich', 'fokussiert', 'dankbar']

/** Werte zur Wahl im langen Morgen-Start („Welcher Wert trägt dich heute?“). */
export const VALUES: readonly string[] = [
  'Geduld', 'Mut', 'Klarheit', 'Freundlichkeit', 'Ehrlichkeit', 'Fokus',
  'Gelassenheit', 'Großzügigkeit', 'Neugier', 'Verlässlichkeit', 'Disziplin', 'Leichtigkeit',
]

/** Höchstlängen der Eingaben in Zeichen; zu Langes wird gekürzt. */
export const INTENTION_MAX = 40
export const GRATITUDE_MAX = 120
export const VALUE_MAX = 40
export const DOMINO_MAX = 80
