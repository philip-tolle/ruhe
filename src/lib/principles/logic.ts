// Logik der Sammlung (Spec M12 §4.1, §4.7–§4.10): gleicher Text, Erkenntnis des Tages, Prinzip der Woche, Auswahl am
// Sonntag, Wachstumsfelder der Woche und Einfügen von Notizen. Reine Funktionen: `now` bzw. der Tag kommt als Eingabe,
// kein Zugriff auf Speicher oder Oberfläche.
import { eveningEntry, shiftDay, weekDays } from '../evening/logic'
import type { EveningEntry } from '../stats/schema'
import { dayKey } from '../stats/summary'
import { clipChars, clipText } from '../text'
import type { CollectionItem } from './collection'
import { INSIGHT_MAX, PASTE_MAX, textKey, type CollectionKind } from './words'

const DAY_MS = 86_400_000

/**
 * Wahr, wenn sich `textKey(text)` von dem des ursprünglichen Texts unterscheidet (bei Neuem `''`) und ein Eintrag
 * derselben Art denselben `textKey` hat. Nur die Schreibweise zu ändern oder unverändert zu speichern sperrt nie.
 */
export function sameText(items: readonly CollectionItem[], kind: CollectionKind, text: string, original: string): boolean {
  const key = textKey(text)
  if (key === textKey(original)) return false
  return items.some(i => i.kind === kind && textKey(i.text) === key)
}

/**
 * Die Erkenntnis des Kalendertags von `now` (Spec M12 §4.8): Rang nach Kennung (UTF-16 mit `<`), Stelle aus dem
 * Tagesindex der lokalen Datumsteile. In n Tagen kommt jede genau einmal, solange n gleich bleibt; ohne Erkenntnisse `null`.
 */
export function insightOfDay(collection: readonly CollectionItem[], now: Date): CollectionItem | null {
  const ranked = collection.filter(i => i.kind === 'erkenntnis').sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const n = ranked.length
  if (n === 0) return null
  const t = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS
  return ranked[((t % n) + n) % n]
}

/** Der Anker der laufenden Woche: ein Prinzip der Sammlung oder ein Wort (Spec M12 §4.7). */
export type WeekAnchor = { kind: 'prinzip'; item: CollectionItem } | { kind: 'wort'; text: string }

/**
 * Es gilt das jüngste Logbuch, dessen Tag 1 bis 7 Kalendertage vor `dayKey(now)` liegt und `weekPrinciple` oder
 * `weekFocus` trägt. Zeigt `weekPrinciple` auf kein Prinzip (gelöscht, falsche Art), ergibt es `null`, ohne Rückgriff
 * auf ein älteres Wort. Bei einem Wort dasselbe wie `morningReminder(…).weekFocus`.
 */
export function weekAnchor(evenings: readonly EveningEntry[], collection: readonly CollectionItem[], now: Date): WeekAnchor | null {
  const days = weekDays(shiftDay(dayKey(now), -1))
  for (let i = days.length - 1; i >= 0; i--) {
    const entry = eveningEntry(evenings, days[i])
    if (entry?.weekPrinciple) {
      const item = collection.find(c => c.id === entry.weekPrinciple && c.kind === 'prinzip')
      return item ? { kind: 'prinzip', item } : null
    }
    if (entry?.weekFocus) return { kind: 'wort', text: entry.weekFocus }
  }
  return null
}

/** Das am heutigen Kalendertag gewählte Prinzip für die neue Woche, bevor es gilt; sonst `null`. */
export function nextWeekPrinciple(evenings: readonly EveningEntry[], now: Date): string | null {
  return eveningEntry(evenings, dayKey(now))?.weekPrinciple ?? null
}

/** Vorschläge und eigene Wörter am Sonntag ohne die, deren `textKey` dem eines Leitsatzes gleicht. */
export function sundayChoices(suggestions: readonly string[], own: readonly string[], principles: readonly CollectionItem[]): { suggestions: string[]; own: string[] } {
  const leitsaetze = new Set(principles.filter(i => i.kind === 'prinzip').map(i => textKey(i.text)))
  const keep = (word: string) => !leitsaetze.has(textKey(word))
  return { suggestions: suggestions.filter(keep), own: own.filter(keep) }
}

/** Ein Wachstumsfeld in „Deine Woche“: an wie vielen Tagen vorgenommen und der jüngste Satz dazu. */
export interface GrowthRow {
  item: CollectionItem
  count: number
  last: string | null
}

/**
 * Je Wachstumsfeld in der Reihenfolge der Sammlung (Spec M12 §4.9): die Tage unter `day` und den 6 davor, deren
 * Logbuch das Feld trägt (je Tag eines, ein zweiter Durchgang ersetzt), und `better` des jüngsten dieser Tage.
 */
export function growthWeek(collection: readonly CollectionItem[], evenings: readonly EveningEntry[], day: string): GrowthRow[] {
  const entries = weekDays(day).flatMap(d => eveningEntry(evenings, d) ?? [])
  return collection
    .filter(i => i.kind === 'feld')
    .map(item => {
      const hits = entries.filter(e => e.growthField === item.id)
      return { item, count: hits.length, last: hits.at(-1)?.better ?? null }
    })
}

/** „Vorgenommen an 3 der letzten 7 Tage“ */
export function growthLine(n: number): string {
  return `Vorgenommen an ${n} der letzten 7 Tage`
}

/** Eine Zeile der Vorschau beim Einfügen; `clipped`, wenn sie auf `INSIGHT_MAX` gekürzt wurde. */
export interface PasteLine {
  text: string
  clipped: boolean
}

export interface PasteResult {
  lines: PasteLine[]
  /** Übersprungen: gleicher Text wie eine vorhandene Erkenntnis oder eine frühere Zeile. */
  duplicates: number
  /** Gekürzte Zeilen unter `lines`. */
  clipped: number
  /** Zeilen ohne Platz. */
  overflow: number
  /** Der Text war länger als `PASTE_MAX`; nur der Anfang zählt. */
  truncated: boolean
}

const LINE_BREAK = /\r\n|\r|\n|\u2028|\u2029/
const INVISIBLE = /[\ufeff\u200b\u2060]/g // vor dem Zusammenfassen des Leerraums entfernen
const LIST_MARK = /^(?:(?:[-–—*>]|\d{1,3}[.)])\s+|[•▪◦‣☐☑☒✓✔]\s*)?(?:\[[ xX]\](?:\s+|$))?/
const HAS_CONTENT = /[\p{L}\p{N}]/u
const NUMBER_ONLY = /^\d{1,3}[.)]$/

/**
 * Zerlegt eingefügte Notizen in Erkenntnisse (Spec M12 §4.10): kürzen auf `PASTE_MAX`, trennen, bereinigen,
 * Listenzeichen höchstens einmal entfernen, Leeres weg, auf `INSIGHT_MAX` kürzen, Doppelte überspringen (gegen die
 * vorhandenen Erkenntnisse und frühere Zeilen) und nur die ersten `room` Zeilen übernehmen.
 */
export function pasteLines(text: string, existing: readonly CollectionItem[], room: number): PasteResult {
  const head = clipChars(text, PASTE_MAX)
  const seen = new Set(existing.filter(i => i.kind === 'erkenntnis').map(i => textKey(i.text)))
  const result: PasteResult = { lines: [], duplicates: 0, clipped: 0, overflow: 0, truncated: head.length !== text.length }
  for (const raw of head.split(LINE_BREAK)) {
    const line = raw.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim().replace(LIST_MARK, '').trim()
    if (!HAS_CONTENT.test(line) || NUMBER_ONLY.test(line)) continue
    const insight = clipText(line, INSIGHT_MAX)
    const key = textKey(insight)
    if (seen.has(key)) {
      result.duplicates++
      continue
    }
    seen.add(key)
    if (result.lines.length >= room) {
      result.overflow++
      continue
    }
    const clipped = insight !== line
    result.lines.push({ text: insight, clipped })
    if (clipped) result.clipped++
  }
  return result
}
