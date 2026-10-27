// Backup: Export als JSON-Text, Import mit Zusammenführen. Reine Funktionen; Download und
// Dateiauswahl gehören zur Oberfläche.
import { parseData, type AppData, type Session } from './schema'
import { dayKey, MIN_SECONDS } from './summary'

const INVALID_BACKUP = 'Diese Datei ist kein gültiges Ruhe-Backup.'

/** `ruhe-backup-JJJJ-MM-TT.json` mit dem lokalen Datum. */
export function backupFileName(now: Date): string {
  return `ruhe-backup-${dayKey(now)}.json`
}

/**
 * Sitzungen, Einstellungen, eigene Atemmuster und Energie-Daten (Check-ins, Hack-Läufe, Sprints; jeweils falls
 * vorhanden); `lastUsed` gehört nicht ins Backup.
 */
export function serializeBackup(data: AppData): string {
  const { version, sessions, settings, breathPatterns, energyCheckins, hackRuns, focusSprints } = data
  const optional = { ...(breathPatterns && { breathPatterns }), ...(energyCheckins && { energyCheckins }), ...(hackRuns && { hackRuns }), ...(focusSprints && { focusSprints }) }
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
 * Führt den Inhalt einer Backup-Datei mit dem aktuellen Stand zusammen: neue Sitzungen kommen
 * dazu (vorhandene IDs entfallen, ebenso Sitzungen unter 60 s, die nie gezählt hätten),
 * Einstellungen stammen aus der Datei, `lastUsed` bleibt. Eigene Atemmuster kommen dazu, wenn ihre
 * Kennung neu ist; ein Muster des Geräts bleibt, wie es ist. Ebenso Check-ins, Hack-Läufe und Sprints:
 * nur unbekannte Kennungen kommen dazu (`addedEnergy` zählt sie), und ein Backup ohne Energie-Felder lässt die
 * des Geräts unverändert. Bei ungültiger Datei kommt nur ein Fehlertext zurück; `current` wird nie verändert.
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
  if (checkins.list.length > 0) data.energyCheckins = checkins.list
  if (runs.list.length > 0) data.hackRuns = runs.list
  if (sprints.list.length > 0) data.focusSprints = sprints.list
  return { data, added: added.length, addedEnergy: checkins.added + runs.added + sprints.added }
}
