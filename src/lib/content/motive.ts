// Katalog der 36 gemalten Motive (Spec M4 §3.2, dazu die Musik aus M5 und die Ruhe-Karte aus M6). Die Dateien liegen in public/images/motive/<id>.webp,
// ihre Herkunft (Prompts, Ausschnitt, Größe) steht in content/motive.json. Motive sind Schmuck:
// Wo sie erscheinen, bekommen sie `alt=""`; die Bedeutung trägt der Text daneben.
import { assetUrl, backgroundById } from '../sounds/catalog'
import type { BackgroundId, MusicId, SoundId } from '../sounds/catalog'
import type { BreathPatternId } from '../breath/patterns'
import type { Category } from './catalog'
import type { Tageszeit } from '../time/tageszeit'

const IDS = [
  // Symbole der Reiter und Aktivitäten
  'meditieren', 'atmen', 'klaenge', 'timer', 'ich', 'ruhe',
  // Vorschlag des Tages, je Tageszeit
  'vorschlag-morgen', 'vorschlag-tag', 'vorschlag-abend',
  // Themen der geführten Meditationen
  'thema-achtsamkeit', 'thema-stress', 'thema-fokus',
  // Atemübungen
  'atem-478', 'atem-box', 'atem-kohaerent', 'atem-langes-ausatmen', 'atem-seufzer', 'atem-wechselatmung',
  // Klänge
  'klang-regen', 'klang-meer', 'klang-wind', 'klang-braun', 'klang-wald', 'klang-kaminfeuer', 'klang-bach', 'klang-klangschalen',
  // Musik
  'musik-schwebend', 'musik-klavier', 'musik-obertoene', 'musik-bambusfloete',
  'musik-zwischen-zwei-atemzuegen', 'musik-salz-und-sternenlicht', 'musik-unter-der-oberflaeche',
  // Blütenblätter der Atem-Blüte: Einatmen, Halten, Ausatmen
  'blatt-ein', 'blatt-halten', 'blatt-aus',
] as const

export type MotivId = (typeof IDS)[number]

export const MOTIV_IDS: readonly MotivId[] = IDS

export function motivUrl(id: MotivId): string {
  return assetUrl('images/motive/' + id + '.webp')
}

// Die Rückgabetypen sind Vereinigungen von Literalen: Kommt ein Klang, eine Atemübung, ein Thema
// oder eine Tageszeit ohne Motiv hinzu, meldet `npm run check` es hier.
export function soundMotiv(id: SoundId): MotivId {
  return `klang-${id}`
}

export function musicMotiv(id: MusicId): MotivId {
  return `musik-${id}`
}

/** Motiv eines Hintergrunds, gleich ob Naturklang oder Musikstück. */
export function backgroundMotiv(id: BackgroundId): MotivId {
  const background = backgroundById(id)
  return background.kind === 'music' ? musicMotiv(background.id) : soundMotiv(background.id)
}

export function breathMotiv(id: BreathPatternId): MotivId {
  return `atem-${id}`
}

export function themaMotiv(c: Category): MotivId {
  return `thema-${c}`
}

export function vorschlagMotiv(t: Tageszeit): MotivId {
  return `vorschlag-${t}`
}
