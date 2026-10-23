// Katalog aller Klänge: acht echte Aufnahmen der Natur (ElevenLabs, nahtlose 30-s-Schleifen), sieben
// Musikstücke (gestreamt, Schleife mit Überblendung), dazu der Einzelanschlag der Klangschale und die
// beiden Atemgeräusche. Die Daten stehen in content/sounds.json. Ein Hintergrund (Klänge, Timer,
// geführte Meditation) ist entweder ein Naturklang oder ein Musikstück.
import catalog from '../../../content/sounds.json'
import { softBreaks } from '../text'

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

export type MusicId =
  | 'schwebend'
  | 'klavier'
  | 'obertoene'
  | 'bambusfloete'
  | 'zwischen-zwei-atemzuegen'
  | 'salz-und-sternenlicht'
  | 'unter-der-oberflaeche'

// Herkunft eines Stücks: erzeugt mit ElevenLabs Music oder vom Nutzer mit Gemini erstellt.
export type MusicSource =
  | { kind: 'elevenlabs'; prompt: string; flow: string; generation: string }
  | { kind: 'gemini'; title: string }

export interface MusicDef {
  id: MusicId
  title: string
  // Pfad der Datei (Opus) relativ zu BASE_URL.
  file: string
  // Anfang des SHA-256 der Datei; steht in der Adresse, damit eine neue Aufnahme neu geladen wird.
  version: string
  seconds: number
  bytes: number
  source: MusicSource
}

// Die Atemgeräusche der Atemübungen (Ein- und Ausatmen) mit ihrer Herkunft.
export interface BreathDef {
  id: 'ein' | 'aus'
  file: string
  prompt: string
  flow: string
  generation: string
}

export type BackgroundId = SoundId | MusicId

export type Background = ({ kind: 'nature' } & SoundDef) | ({ kind: 'music' } & MusicDef)

export const SOUNDS: readonly SoundDef[] = catalog.sounds as SoundDef[]
export const EFFECTS: readonly EffectDef[] = catalog.effects as EffectDef[]
export const MUSIC: readonly MusicDef[] = catalog.music as MusicDef[]
export const BREATH: readonly BreathDef[] = catalog.breath as BreathDef[]

export function soundById(id: SoundId): SoundDef {
  const sound = SOUNDS.find((s) => s.id === id)
  if (!sound) throw new Error('Unbekannter Klang: ' + id)
  return sound
}

export function backgroundById(id: BackgroundId): Background {
  const music = MUSIC.find((m) => m.id === id)
  if (music) return { kind: 'music', ...music }
  const sound = SOUNDS.find((s) => s.id === id)
  if (sound) return { kind: 'nature', ...sound }
  throw new Error('Unbekannter Klang: ' + id)
}

export function isBackgroundId(v: unknown): v is BackgroundId {
  return typeof v === 'string' && (SOUNDS.some((s) => s.id === v) || MUSIC.some((m) => m.id === v))
}

/** Adresse eines Musikstücks samt Version, relativ zur Seite; so spielt es die Engine. */
export function musicUrl(m: MusicDef): string {
  return `${assetUrl(m.file)}?v=${m.version}`
}

// Weiche Trennstellen (U+00AD) an den Fugen der langen Zusammensetzungen in den Titeln.
const TITLE_BREAKS: Record<string, string> = {
  Meeresrauschen: 'Meeres\u00ADrauschen',
  Klangschalen: 'Klang\u00ADschalen',
  Kaminfeuer: 'Kamin\u00ADfeuer',
}

/** Titel für die Kachel mit weichen Trennstellen in den langen Zusammensetzungen. Nur zur Anzeige: Der Name des Knopfes bleibt der Titel selbst. */
export function soundTileTitle(title: string): string {
  return softBreaks(title, TITLE_BREAKS)
}

// Macht aus einem Katalogpfad (z. B. 'audio/sounds/wald.ogg') eine URL, die auch
// unter dem Unterpfad der Veröffentlichung (Vite `base`) funktioniert.
export function assetUrl(file: string): string {
  return import.meta.env.BASE_URL + file
}
