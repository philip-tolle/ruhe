// Zustand der Energie-Oberfläche, der über Reiter hinweg gilt: das Check-in-Blatt (auch von „Heute“ aus
// zu öffnen) und die Hack-Karte. `resetSkip` und `resetStart` gehören dem Jetzt-Reset: wie viele Vorschläge
// „Anderer“ schon übersprungen hat und welchen Bereich die Person ohne frischen Check-in gewählt hat. `resetBasis` ist die
// Grundlage, auf der sie beide gelten: die Kennung des frischen Check-ins, ohne einen `null`.
import type { EnergyArea } from '../energy/areas'

export const energyUi: {
  checkInOpen: boolean
  /** Kennung des Hacks, dessen Karte offen ist; `null`, solange keine offen ist. */
  hackCard: string | null
  resetSkip: number
  resetStart: EnergyArea | null
  resetBasis: string | null
} = $state({ checkInOpen: false, hackCard: null, resetSkip: 0, resetStart: null, resetBasis: null })

export function openCheckIn(): void {
  energyUi.checkInOpen = true
}

export function closeCheckIn(): void {
  energyUi.checkInOpen = false
}

export function openHackCard(id: string): void {
  energyUi.hackCard = id
}

export function closeHackCard(): void {
  energyUi.hackCard = null
}
