// Katalog der drei gemalten Waschungen (Spec M4.1). Die Dateien liegen in public/images/waschungen/<farbe>.webp,
// ihre Herkunft (Prompt, Freistellen, Größe) steht in content/waschungen.json. Eine Waschung ist Schmuck in der
// textfreien Ecke einer Karte (Baustein Waschung.svelte); die Bedeutung trägt der Text der Karte.
import { assetUrl } from '../sounds/catalog'
import type { BreathPatternId } from '../breath/patterns'
import type { LastUsed } from '../stats/schema'
import type { Tageszeit } from '../time/tageszeit'
import { meditationById } from './catalog'
import type { Category } from './catalog'

const FARBEN = ['lavendel', 'pfirsich', 'blaugruen'] as const

export type WaschFarbe = (typeof FARBEN)[number]

export const WASCH_FARBEN: readonly WaschFarbe[] = FARBEN

// Lage des Bildes in der Ecke: 0 wie gemalt, 1 gespiegelt und um 6° gedreht, 2 um −12° gedreht.
export type WaschLage = 0 | 1 | 2

export function waschUrl(farbe: WaschFarbe): string {
  return assetUrl('images/waschungen/' + farbe + '.webp')
}

// Die Zuordnungen sind `Record`s über die vollständigen Schlüsseltypen: Kommt ein Thema, eine Tageszeit oder
// eine Atemübung ohne Farbe hinzu, meldet `npm run check` es hier.
const THEMA: Record<Category, WaschFarbe> = {
  achtsamkeit: 'lavendel',
  stress: 'blaugruen',
  fokus: 'pfirsich',
}

const TAGESZEIT: Record<Tageszeit, WaschFarbe> = {
  morgen: 'pfirsich',
  tag: 'blaugruen',
  abend: 'lavendel',
}

const ATEMUEBUNG: Record<BreathPatternId, WaschFarbe> = {
  '478': 'lavendel',
  box: 'pfirsich',
  kohaerent: 'blaugruen',
  'langes-ausatmen': 'lavendel',
  seufzer: 'blaugruen',
  wechselatmung: 'pfirsich',
}

export function themaWaschung(c: Category): WaschFarbe {
  return THEMA[c]
}

export function tageszeitWaschung(t: Tageszeit): WaschFarbe {
  return TAGESZEIT[t]
}

export function atemWaschung(id: BreathPatternId): WaschFarbe {
  return ATEMUEBUNG[id]
}

// „Zuletzt genutzt“: Eine geführte Meditation trägt die Farbe ihres Themas, eine Atemübung die ihrer Übung,
// der Timer die der Tageszeit. Ist die gespeicherte Meditation nicht mehr im Katalog, gilt ebenfalls die Tageszeit.
export function zuletztWaschung(last: LastUsed, now: Tageszeit): WaschFarbe {
  if (last.kind === 'guided') {
    const meditation = meditationById(last.id)
    return meditation ? themaWaschung(meditation.category) : tageszeitWaschung(now)
  }
  if (last.kind === 'breath') return atemWaschung(last.pattern)
  return tageszeitWaschung(now)
}

// In Listen wechselt die Lage reihum, damit nebeneinanderstehende Karten nicht gleich aussehen.
export function waschLage(index: number): WaschLage {
  return (((index % 3) + 3) % 3) as WaschLage
}
