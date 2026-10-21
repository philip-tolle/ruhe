// Reaktive Hülle um die Persistenz: Die Oberfläche liest `stats` und ändert nur über die
// Funktionen hier. Jede Änderung ersetzt `stats.data` durch ein neues Objekt und speichert
// sofort; die Logik steckt in persist.ts und backup.ts.
import { mergeBackup } from './backup'
import { loadData, saveData, withSession, type StorageLike } from './persist'
import type { AppData, LastUsed, SessionResult, Settings } from './schema'

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

/** `true`, wenn die Sitzung zählt (ab 60 s) – auch dann, wenn das Speichern scheitert. */
export function recordSession(result: SessionResult): boolean {
  const next = withSession(stats.data, result, crypto.randomUUID())
  if (!next) return false
  commit(next)
  return true
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
