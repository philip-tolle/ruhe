// Die vier Energie-Bereiche nach Loehr/Schwartz und die fünf Stufen des Check-ins (Spec M9 §2).
// Reihenfolge überall: Körper, Gefühl, Geist, Sinn. Die Farbe ist nie allein Bedeutungsträger, der Name steht immer dabei.

export type EnergyArea = 'koerper' | 'gefuehl' | 'geist' | 'sinn'
export type EnergyLevel = 1 | 2 | 3 | 4 | 5

export const AREAS: readonly EnergyArea[] = ['koerper', 'gefuehl', 'geist', 'sinn']

/** Name, Bereichsfarbe und Leitfrage im Check-in. */
export const AREA_INFO: Record<EnergyArea, { title: string; color: string; question: string }> = {
  koerper: { title: 'Körper', color: '#F0A58C', question: 'wach, kräftig, ausgeruht?' },
  gefuehl: { title: 'Gefühl', color: '#F3B6C8', question: 'ruhig, zuversichtlich, verbunden?' },
  geist: { title: 'Geist', color: '#9FE0CF', question: 'klar, fokussiert, aufnahmefähig?' },
  sinn: { title: 'Sinn', color: '#C7B8F5', question: 'ausgerichtet, motiviert, im Einklang?' },
}

export const LEVELS: readonly EnergyLevel[] = [1, 2, 3, 4, 5]

/** Wort zur Stufe, z. B. „Geist: 2 von 5, schwach“. */
export const LEVEL_WORD: Record<EnergyLevel, string> = { 1: 'leer', 2: 'schwach', 3: 'mittel', 4: 'gut', 5: 'voll' }

export function isEnergyArea(v: unknown): v is EnergyArea {
  return typeof v === 'string' && (AREAS as readonly string[]).includes(v)
}

export function isEnergyLevel(v: unknown): v is EnergyLevel {
  return typeof v === 'number' && (LEVELS as readonly number[]).includes(v)
}
