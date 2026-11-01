// Backup: Export als JSON-Text, Import mit Zusammenführen. Reine Funktionen; Download und
// Dateiauswahl gehören zur Oberfläche.
import { parseData, sortByDay, type AppData, type Session } from './schema'
import { dayKey, MIN_SECONDS } from './summary'
import type { CollectionItem } from '../principles/collection'
import { KIND_LOAD_MAX, textKey, type CollectionKind } from '../principles/words'

const INVALID_BACKUP = 'Diese Datei ist kein gültiges Ruhe-Backup.'

/** `ruhe-backup-JJJJ-MM-TT.json` mit dem lokalen Datum. */
export function backupFileName(now: Date): string {
  return `ruhe-backup-${dayKey(now)}.json`
}

/**
 * Sitzungen, Einstellungen, eigene Atemmuster, Energie-Daten (Check-ins, Hack-Läufe, Sprints), Morgen-Starts,
 * Abend-Logbücher und die Sammlung (jeweils falls vorhanden); `lastUsed` gehört nicht ins Backup.
 */
export function serializeBackup(data: AppData): string {
  const { version, sessions, settings, breathPatterns, energyCheckins, hackRuns, focusSprints, mornings, evenings, collection } = data
  const optional = { ...(breathPatterns && { breathPatterns }), ...(energyCheckins && { energyCheckins }), ...(hackRuns && { hackRuns }), ...(focusSprints && { focusSprints }), ...(mornings && { mornings }), ...(evenings && { evenings }), ...(collection && { collection }) }
  return JSON.stringify({ version, sessions, settings, ...optional }, null, 2)
}

/**
 * Das Gerät behält seine Einträge; dazu kommen die der Datei mit unbekannter Kennung (auch eine doppelte in der Datei
 * zählt nur einmal), nach Zeit sortiert. Kommt nichts dazu, bleibt die Liste des Geräts, wie sie ist.
 */
function mergeEntries<T extends { id: string; at: string }>(own: readonly T[] | undefined, incoming: readonly T[] | undefined): { list: T[]; added: number } {
  const list = own ?? []
  const known = new Set(list.map(e => e.id))
  const fresh: T[] = []
  for (const entry of incoming ?? []) {
    if (known.has(entry.id)) continue
    known.add(entry.id)
    fresh.push(entry)
  }
  if (fresh.length === 0) return { list: [...list], added: 0 }
  return { list: [...list, ...fresh].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)), added: fresh.length }
}

/**
 * Morgen-Starts und Abend-Logbücher gehen nach Tag, nicht nach Kennung (sie haben keine): Der Eintrag mit dem späteren
 * `at` gilt, ein gleicher Zeitpunkt zählt als derselbe Eintrag (nichts ändert sich), und nur Neues und Ersetztes wird
 * gezählt. Kommt nichts dazu, bleibt die Liste des Geräts, wie sie ist.
 */
function mergeByDay<T extends { day: string; at: string }>(own: readonly T[] | undefined, incoming: readonly T[] | undefined): { list: T[]; added: number } {
  const list = [...(own ?? [])]
  let added = 0
  for (const entry of incoming ?? []) {
    const index = list.findIndex(e => e.day === entry.day)
    if (index === -1) {
      list.push(entry)
      added++
    } else if (Date.parse(entry.at) > Date.parse(list[index].at)) {
      list[index] = entry
      added++
    }
  }
  return { list: added === 0 ? list : sortByDay(list), added }
}

/**
 * Sammlung zusammenführen (Spec M12 §4.11): Die Liste des Geräts bleibt, wie sie ist. Einträge der Datei kommen in
 * ihrer Reihenfolge hinten dazu, wenn ihre Kennung neu ist (sonst gewinnt das Gerät), eine Erkenntnis zudem nur mit
 * neuem Text (`textKey`, verglichen mit denen des Geräts und den eben übernommenen), und nur, solange ihre Art unter
 * `KIND_LOAD_MAX` liegt; so verschwindet beim Neuladen nichts still.
 */
function mergeCollection(own: readonly CollectionItem[] | undefined, incoming: readonly CollectionItem[] | undefined): CollectionItem[] {
  const list = [...(own ?? [])]
  const ids = new Set(list.map(i => i.id))
  const insightKeys = new Set(list.filter(i => i.kind === 'erkenntnis').map(i => textKey(i.text)))
  const count: Record<CollectionKind, number> = { prinzip: 0, feld: 0, erkenntnis: 0 }
  for (const item of list) count[item.kind]++
  for (const item of incoming ?? []) {
    if (ids.has(item.id)) continue
    const key = item.kind === 'erkenntnis' ? textKey(item.text) : null
    if (key !== null && insightKeys.has(key)) continue
    if (count[item.kind] >= KIND_LOAD_MAX[item.kind]) continue
    ids.add(item.id)
    if (key !== null) insightKeys.add(key)
    count[item.kind]++
    list.push(item)
  }
  return list
}

/**
 * Führt den Inhalt einer Backup-Datei mit dem aktuellen Stand zusammen: neue Sitzungen kommen
 * dazu (vorhandene IDs entfallen, ebenso Sitzungen unter 60 s, die nie gezählt hätten),
 * Einstellungen stammen aus der Datei, `lastUsed` bleibt. Eigene Atemmuster kommen dazu, wenn ihre
 * Kennung neu ist; ein Muster des Geräts bleibt, wie es ist. Ebenso Check-ins, Hack-Läufe und Sprints:
 * nur unbekannte Kennungen kommen dazu (`addedEnergy` zählt sie), und ein Backup ohne Energie-Felder lässt die
 * des Geräts unverändert. Morgen-Starts und Abend-Logbücher kommen je Tag zusammen (`mergeByDay`) und zählen ebenfalls in `addedEnergy`,
 * damit die Meldung nach dem Import dieselbe bleibt. Die Sammlung kommt nach `mergeCollection` dazu und zählt nirgends;
 * ein Backup ohne Sammlung lässt die des Geräts unverändert. Bei ungültiger Datei kommt nur ein Fehlertext zurück;
 * `current` wird nie verändert.
 */
export function mergeBackup(current: AppData, text: string): { data: AppData; added: number; addedEnergy: number } | { error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { error: INVALID_BACKUP }
  }
  const incoming = parseData(raw)
  if (!incoming) return { error: INVALID_BACKUP }
  const known = new Set(current.sessions.map(s => s.id))
  const added: Session[] = []
  for (const session of incoming.sessions) {
    if (session.seconds < MIN_SECONDS || known.has(session.id)) continue
    known.add(session.id)
    added.push(session)
  }
  const sessions = [...current.sessions, ...added].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const data: AppData = { version: 1, sessions, settings: incoming.settings }
  if (current.lastUsed) data.lastUsed = current.lastUsed
  const own = current.breathPatterns ?? []
  const breathPatterns = [...own, ...(incoming.breathPatterns ?? []).filter(p => !own.some(o => o.id === p.id))]
  if (breathPatterns.length > 0) data.breathPatterns = breathPatterns
  const checkins = mergeEntries(current.energyCheckins, incoming.energyCheckins)
  const runs = mergeEntries(current.hackRuns, incoming.hackRuns)
  const sprints = mergeEntries(current.focusSprints, incoming.focusSprints)
  const mornings = mergeByDay(current.mornings, incoming.mornings)
  const evenings = mergeByDay(current.evenings, incoming.evenings)
  if (checkins.list.length > 0) data.energyCheckins = checkins.list
  if (runs.list.length > 0) data.hackRuns = runs.list
  if (sprints.list.length > 0) data.focusSprints = sprints.list
  if (mornings.list.length > 0) data.mornings = mornings.list
  if (evenings.list.length > 0) data.evenings = evenings.list
  const collection = mergeCollection(current.collection, incoming.collection)
  if (collection.length > 0) data.collection = collection
  return { data, added: added.length, addedEnergy: checkins.added + runs.added + sprints.added + mornings.added + evenings.added }
}
