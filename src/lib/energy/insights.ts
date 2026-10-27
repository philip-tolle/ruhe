// Auswertung der Energie-Daten (Spec M9 §6). Reine Funktionen ohne Speicherzugriff.
import type { EnergyArea, EnergyLevel } from './areas'
import type { EnergyCheckin } from '../stats/schema'

/** So viele Stunden vor dem Start gilt ein Check-in noch als „Vorher“ eines Hacks (Spec M9 §6.2). */
export const BEFORE_HOURS = 2

/**
 * Stufe des Bereichs aus dem jüngsten Check-in vor oder bei `start`, der höchstens `BEFORE_HOURS`
 * Stunden davor liegt; sonst `null`. Die Reihenfolge der Liste spielt keine Rolle.
 */
export function beforeLevel(c: readonly EnergyCheckin[], area: EnergyArea, start: Date): EnergyLevel | null {
  const end = start.getTime()
  if (Number.isNaN(end)) return null
  const from = end - BEFORE_HOURS * 3_600_000
  let found: EnergyCheckin | null = null
  let foundAt = -Infinity
  for (const checkin of c) {
    const at = Date.parse(checkin.at)
    // Bei gleichem Zeitpunkt gilt der spätere Eintrag der Liste.
    if (at >= from && at <= end && at >= foundAt) {
      found = checkin
      foundAt = at
    }
  }
  return found ? found.levels[area] : null
}
