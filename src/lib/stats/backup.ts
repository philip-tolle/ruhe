// Backup: Export als JSON-Text, Import mit Zusammenführen. Reine Funktionen; Download und
// Dateiauswahl gehören zur Oberfläche.
import { parseData, type AppData, type Session } from './schema'
import { dayKey, MIN_SECONDS } from './summary'

const INVALID_BACKUP = 'Diese Datei ist kein gültiges Ruhe-Backup.'

/** `ruhe-backup-JJJJ-MM-TT.json` mit dem lokalen Datum. */
export function backupFileName(now: Date): string {
  return `ruhe-backup-${dayKey(now)}.json`
}

/** Sitzungen und Einstellungen; `lastUsed` gehört nicht ins Backup. */
export function serializeBackup(data: AppData): string {
  return JSON.stringify({ version: data.version, sessions: data.sessions, settings: data.settings }, null, 2)
}

/**
 * Führt den Inhalt einer Backup-Datei mit dem aktuellen Stand zusammen: neue Sitzungen kommen
 * dazu (vorhandene IDs entfallen, ebenso Sitzungen unter 60 s, die nie gezählt hätten),
 * Einstellungen stammen aus der Datei, `lastUsed` bleibt. Bei ungültiger Datei kommt nur ein
 * Fehlertext zurück; `current` wird nie verändert.
 */
export function mergeBackup(current: AppData, text: string): { data: AppData; added: number } | { error: string } {
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
  return { data, added: added.length }
}
