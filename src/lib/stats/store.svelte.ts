// Reaktive Hülle um die Persistenz: Die Oberfläche liest `stats` und ändert nur über die
// Funktionen hier. Jede Änderung ersetzt `stats.data` durch ein neues Objekt und speichert
// sofort; die Logik steckt in persist.ts und backup.ts.
import { mergeBackup } from './backup'
import { loadData, saveData, withCalm, withSession, type StorageLike } from './persist'
import type { AppData, CalmLevel, LastUsed, SessionResult, Settings } from './schema'

/** `window.localStorage`, oder `null`, wenn der Zugriff wirft (z. B. SecurityError) oder fehlt. */
export function safeLocalStorage(): StorageLike | null {
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

const storage = safeLocalStorage()

export const stats: { data: AppData; saveFailed: boolean } = $state({ data: loadData(storage), saveFailed: false })

// `saveFailed` zeigt immer das Ergebnis des letzten Speicherns; der Stand bleibt auch dann im Speicher.
function commit(data: AppData): void {
  stats.data = data
  stats.saveFailed = !saveData(storage, data)
}

/**
 * Die ID der neuen Sitzung, wenn sie zählt (ab 60 s) – auch dann, wenn das Speichern scheitert
 * (sie steht im Speicher der App); sonst `null`.
 */
export function recordSession(result: SessionResult): string | null {
  const id = crypto.randomUUID()
  const next = withSession(stats.data, result, id)
  if (!next) return null
  commit(next)
  return id
}

/** Ruhe-Check-in vom Abschluss: setzt oder entfernt (`null`) einen Wert; eine unbekannte ID ändert nichts. */
export function setCalm(sessionId: string, which: 'before' | 'after', level: CalmLevel | null): void {
  const next = withCalm(stats.data, sessionId, which, level)
  if (next) commit(next)
}

export function setLastUsed(last: LastUsed): void {
  commit({ ...stats.data, lastUsed: last })
}

/** Flaches Zusammenführen; `timer` wird als Ganzes ersetzt. */
export function updateSettings(patch: Partial<Settings>): void {
  commit({ ...stats.data, settings: { ...stats.data.settings, ...patch } })
}

/** Bei einem Fehler bleibt alles unverändert und nichts wird gespeichert. */
export function importBackup(text: string): { added: number } | { error: string } {
  const merged = mergeBackup(stats.data, text)
  if ('error' in merged) return merged
  commit(merged.data)
  return { added: merged.added }
}
