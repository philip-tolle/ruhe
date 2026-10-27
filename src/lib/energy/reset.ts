// Jetzt-Reset und Pausen-Vorschlag (Spec M9 §6.7): welche Hacks in welcher Reihenfolge vorgeschlagen werden.
// Reine Funktionen; die Oberfläche zeigt bei „Anderer“ den nächsten Eintrag der Folge.
import { AREAS, type EnergyArea, type EnergyLevel } from './areas'
import { HACKS, hackById, hacksIn, inWindow, type Hack } from './hacks'
import { freshCheckin, hackStats, type HackStat } from './insights'
import type { EnergyCheckin, FocusMinutes, HackRun } from '../stats/schema'

/** Gruppe in der Reihenfolge: 1 bewährt, 2 noch nicht genug bewertet, 3 ohne Wirkung. */
function group(stat: HackStat | undefined): 1 | 2 | 3 {
  if (!stat || stat.rated < 2 || stat.mean === null) return 2
  return stat.mean > 0 ? 1 : 3
}

/** Zeitpunkt des letzten Laufs in ms; ein nie gelaufener Hack zählt als am längsten her. */
function lastRun(stat: HackStat | undefined): number {
  const ms = stat?.lastAt ? Date.parse(stat.lastAt) : NaN
  return Number.isNaN(ms) ? -Infinity : ms
}

/**
 * Die Hacks eines Bereichs, die jetzt (Zeitfenster) in Frage kommen, in Reset-Reihenfolge:
 * 1. mindestens 2 bewertete Läufe und Schnitt über 0, absteigend nach Schnitt,
 * 2. weniger als 2 bewertete Läufe,
 * 3. Schnitt höchstens 0, absteigend nach Schnitt.
 * Gleichstand: der am längsten nicht gelaufene zuerst (nie gelaufen vor allen), dann die Katalog-Reihenfolge.
 */
export function resetOrder(area: EnergyArea, runs: readonly HackRun[], now: Date): Hack[] {
  const stats = hackStats(runs)
  return hacksIn(area)
    .filter((h) => inWindow(h, now))
    .map((hack, index) => {
      const stat = stats.get(hack.id)
      // Nur in den Gruppen 1 und 3 ordnet der Schnitt; in Gruppe 2 gibt es keinen verlässlichen.
      const g = group(stat)
      return { hack, index, g, mean: g === 2 ? 0 : (stat?.mean ?? 0), last: lastRun(stat) }
    })
    .sort((a, b) => a.g - b.g || b.mean - a.mean || (a.last < b.last ? -1 : a.last > b.last ? 1 : 0) || a.index - b.index)
    .map((e) => e.hack)
}

/**
 * Die Folge der Reset-Vorschläge. Mit Stufen (frischer Check-in) sind die Bereiche aufsteigend nach Stufe geordnet,
 * bei Gleichstand nach fester Reihenfolge, und `start` gilt nicht. Ohne Stufen gilt die feste Reihenfolge ab `start`.
 * Die Oberfläche zeigt den Eintrag `skip % length`.
 */
export function resetSequence(
  levels: Record<EnergyArea, EnergyLevel> | null,
  start: EnergyArea,
  runs: readonly HackRun[],
  now: Date,
): { area: EnergyArea; hack: Hack }[] {
  const areas = levels
    ? [...AREAS].sort((a, b) => levels[a] - levels[b] || AREAS.indexOf(a) - AREAS.indexOf(b))
    : [...AREAS.slice(AREAS.indexOf(start)), ...AREAS.slice(0, AREAS.indexOf(start))]
  return areas.flatMap((area) => resetOrder(area, runs, now).map((hack) => ({ area, hack })))
}

/** Pausen-Vorschlag ohne frischen Check-in: Bereich und Hack nach der Länge des Sprints. */
const PAUSE_WITHOUT_CHECKIN: Record<FocusMinutes, { id: string; area: EnergyArea }> = {
  25: { id: 'augen-pause', area: 'geist' },
  50: { id: 'bewegungs-snack', area: 'koerper' },
  90: { id: 'bewegungs-snack', area: 'koerper' },
}

/** Der erste Hack der Reset-Reihenfolge des Bereichs; ist sie leer (alles außerhalb des Fensters), der erste des Katalogs. */
function firstOf(area: EnergyArea, runs: readonly HackRun[], now: Date): Hack {
  return resetOrder(area, runs, now)[0] ?? hacksIn(area)[0] ?? HACKS[0]
}

/**
 * Hack für die Pause nach einem Sprint. Mit frischem Check-in der erste der Reset-Reihenfolge im niedrigeren der
 * Bereiche Körper und Geist (Gleichstand: Körper). Ohne: nach 25 Min die Augen-Pause, nach 50 und 90 Min der
 * Bewegungs-Snack; liegt der nicht im Zeitfenster, der erste der Reihenfolge seines Bereichs.
 */
export function pauseSuggestion(planned: FocusMinutes, checkins: readonly EnergyCheckin[], runs: readonly HackRun[], now: Date): Hack {
  const fresh = freshCheckin(checkins, now)
  if (fresh) return firstOf(fresh.levels.koerper <= fresh.levels.geist ? 'koerper' : 'geist', runs, now)
  const { id, area } = PAUSE_WITHOUT_CHECKIN[planned]
  const hack = hackById(id)
  return hack && inWindow(hack, now) ? hack : firstOf(area, runs, now)
}
