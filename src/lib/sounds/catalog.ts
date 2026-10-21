// Katalog aller Klänge: vier live synthetisierte und vier Datei-Loops, dazu der
// Einzelanschlag der Klangschale. Die Daten stehen in content/sounds.json.
import catalog from '../../../content/sounds.json'

export type SoundId = 'regen' | 'meer' | 'wind' | 'braun' | 'wald' | 'kaminfeuer' | 'bach' | 'klangschalen'

export interface SoundDef {
  id: SoundId
  title: string
  kind: 'live' | 'loop'
  // Pfad relativ zu BASE_URL; nur bei kind 'loop'.
  file?: string
  // Englischer ElevenLabs-Prompt für die echten Aufnahmen (Meilenstein 4); nur bei kind 'loop'.
  prompt?: string
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

// Macht aus einem Katalogpfad (z. B. 'audio/sounds/wald.ogg') eine URL, die auch
// unter dem Unterpfad der Veröffentlichung (Vite `base`) funktioniert.
export function assetUrl(file: string): string {
  return import.meta.env.BASE_URL + file
}
