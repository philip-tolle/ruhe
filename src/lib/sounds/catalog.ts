// Katalog aller Klänge: acht echte Aufnahmen (ElevenLabs, nahtlose 30-s-Schleifen), dazu der
// Einzelanschlag der Klangschale. Die Daten stehen in content/sounds.json.
import catalog from '../../../content/sounds.json'

export type SoundId = 'regen' | 'meer' | 'wind' | 'braun' | 'wald' | 'kaminfeuer' | 'bach' | 'klangschalen'

export interface SoundDef {
  id: SoundId
  title: string
  // Pfad der Aufnahme relativ zu BASE_URL.
  file: string
  // Englischer ElevenLabs-Prompt, mit dem die Aufnahme erzeugt wurde.
  prompt: string
}

export interface EffectDef {
  id: 'klangschale'
  title: string
  file: string
  prompt: string
}

export const SOUNDS: readonly SoundDef[] = catalog.sounds as SoundDef[]
export const EFFECTS: readonly EffectDef[] = catalog.effects as EffectDef[]

export function soundById(id: SoundId): SoundDef {
  const sound = SOUNDS.find((s) => s.id === id)
  if (!sound) throw new Error('Unbekannter Klang: ' + id)
  return sound
}

// Weiche Trennstellen (U+00AD) an den Fugen der langen Zusammensetzungen in den Titeln.
const TITLE_BREAKS: Record<string, string> = {
  Meeresrauschen: 'Meeres\u00ADrauschen',
  Klangschalen: 'Klang\u00ADschalen',
  Kaminfeuer: 'Kamin\u00ADfeuer',
}

/**
 * Titel für die Kachel: lange Zusammensetzungen mit weichen Trennstellen, damit sie auf schmalen Bildschirmen und bei
 * großer Schrift an der Fuge umbrechen (mit Trennstrich) statt mitten im Wort. Nur zur Anzeige:
 * Der Name des Knopfes bleibt der Titel selbst. Wörter außerhalb der Liste bleiben, wie sie sind.
 */
export function soundTileTitle(title: string): string {
  return title.replace(/\p{L}+/gu, (word) => TITLE_BREAKS[word] ?? word)
}

// Macht aus einem Katalogpfad (z. B. 'audio/sounds/wald.ogg') eine URL, die auch
// unter dem Unterpfad der Veröffentlichung (Vite `base`) funktioniert.
export function assetUrl(file: string): string {
  return import.meta.env.BASE_URL + file
}
