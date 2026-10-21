// Laden und Speichern unter einem einzigen localStorage-Schlüssel. Der Speicher wird
// hineingereicht (testbar); jeder Zugriff steht in try/catch, Fehler gelangen nie nach oben.
import { emptyData, parseData, type AppData, type SessionResult } from './schema'
import { MIN_SECONDS } from './summary'

export const STORAGE_KEY = 'ruhe.v1'
export const CORRUPT_KEY = 'ruhe.v1.corrupt'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Fehlt der Eintrag, startet die App leer. Ist er unlesbar oder ungültig, wird der Rohtext
 * nach `CORRUPT_KEY` gesichert und leer gestartet. Wirft nie.
 */
export function loadData(storage: StorageLike | null): AppData {
  if (!storage) return emptyData()
  let text: string | null
  try {
    text = storage.getItem(STORAGE_KEY)
  } catch {
    return emptyData()
  }
  if (text === null) return emptyData()
  let data: AppData | null = null
  try {
    data = parseData(JSON.parse(text))
  } catch {
    // kein gültiges JSON
  }
  if (data) return data
  try {
    storage.setItem(CORRUPT_KEY, text)
  } catch {
    // Die Sicherung ist nur ein Bonus; auch sie darf nichts auslösen.
  }
  return emptyData()
}

/** `false`, wenn nicht gespeichert werden konnte (voll, gesperrt, kein Speicher). Wirft nie. */
export function saveData(storage: StorageLike | null, data: AppData): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

/**
 * Hängt eine Sitzung an einen neuen Stand an (`data` bleibt unverändert). Die einzige Stelle
 * der 60-Sekunden-Regel: kürzere Sitzungen ergeben `null`.
 */
export function withSession(data: AppData, result: SessionResult, id: string): AppData | null {
  if (result.seconds < MIN_SECONDS) return null
  const session = { id, start: result.start.toISOString(), kind: result.kind, ref: result.ref, seconds: Math.floor(result.seconds) }
  return { ...data, sessions: [...data.sessions, session] }
}
