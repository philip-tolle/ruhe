// Katalog der geführten Meditationen (Spec 3.1, 3.2): Gruppierung nach Thema, Vorschlag des Tages,
// Dauer-Beschriftung und Audio-Adresse. Die Daten erzeugt `npm run meditations manifest`
// (src/content/meditations.json); dieses Modul ist rein und hat keine Seiteneffekte.
import data from '../../content/meditations.json'
import { assetUrl } from '../sounds/catalog'

export type Category = 'achtsamkeit' | 'stress' | 'fokus'

export const CATEGORY_TITLE: Record<Category, string> = {
  achtsamkeit: 'Einsteiger & Achtsamkeit',
  stress: 'Stress & Ruhe',
  fokus: 'Fokus & Energie',
}

// Reihenfolge der Themen in der Liste (Spec 3.2).
const CATEGORY_ORDER: readonly Category[] = ['achtsamkeit', 'stress', 'fokus']

export interface Meditation {
  id: string
  title: string
  category: Category
  description: string
  // Ziel-Länge laut Text; die tatsächliche Länge der Datei steht in `duration`.
  minutes: number
  // Pfad der MP3 relativ zu BASE_URL.
  file: string
  // Länge der Datei in Sekunden.
  duration: number
  bytes: number
  // Erste 10 Hex-Zeichen des SHA-256 der MP3. Eine neu aufgenommene Datei bekommt so eine neue
  // Adresse (siehe `audioUrl`), und Geräte laden sie neu, statt die alte aus dem Cache zu spielen.
  version: string
  // Die Datei ist noch ein Platzhalter (leise Töne statt gesprochenem Text).
  placeholder: boolean
}

export const MEDITATIONS: readonly Meditation[] = data.meditations as Meditation[]

// Ersatz für „Zuletzt genutzt“, solange noch nichts genutzt wurde (Spec 3.1).
export const FALLBACK_ID = 'ankommen-im-atem'

export function meditationById(id: string): Meditation | null {
  return MEDITATIONS.find((m) => m.id === id) ?? null
}

export function byCategory(): { category: Category; title: string; items: Meditation[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    title: CATEGORY_TITLE[category],
    items: MEDITATIONS.filter((m) => m.category === category),
  }))
}

// Thema nach lokaler Tageszeit, dieselben Grenzen wie die Begrüßung: morgens 5–11, tagsüber 11–17.
function categoryAt(now: Date): Category {
  const hour = now.getHours()
  if (hour >= 5 && hour < 11) return 'fokus'
  if (hour >= 11 && hour < 17) return 'stress'
  return 'achtsamkeit'
}

// Tag des Jahres im lokalen Kalender, der 1. Januar ist 0. Gerechnet wird mit den lokalen
// Datumsteilen als UTC, damit die Sommerzeit-Umstellung (23 oder 25 Stunden) nichts verschiebt.
function dayOfYear(now: Date): number {
  const year = now.getFullYear()
  return (Date.UTC(year, now.getMonth(), now.getDate()) - Date.UTC(year, 0, 1)) / 86_400_000
}

/**
 * Vorschlag des Tages (Spec 3.1): ein Thema nach Tageszeit, darin täglich die nächste Meditation.
 * Der Index hängt nur vom Kalendertag ab, der Vorschlag bleibt also den ganzen Tag derselbe.
 * Hat die Liste zum Thema nichts, rotiert der Vorschlag über die ganze Liste; eine leere Liste
 * ist ein Fehler.
 */
export function suggestionFor(now: Date, list: readonly Meditation[] = MEDITATIONS): Meditation {
  const inCategory = list.filter((m) => m.category === categoryAt(now))
  const pool = inCategory.length > 0 ? inCategory : list
  if (pool.length === 0) throw new Error('Keine Meditationen für den Vorschlag des Tages')
  return pool[dayOfYear(now) % pool.length]
}

// „5 Min“, aus der Länge der Datei, auf ganze Minuten gerundet, mindestens 1.
export function durationLabel(m: Meditation): string {
  return `${Math.max(1, Math.round(m.duration / 60))} Min`
}

// Adresse der MP3 mit Version. Player, Offline-Speicher und Tests nehmen immer diese Adresse,
// damit der Cache-Schlüssel genau zur aktuellen Aufnahme gehört.
export function audioUrl(m: Meditation): string {
  return `${assetUrl(m.file)}?v=${m.version}`
}
