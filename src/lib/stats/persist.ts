// Laden und Speichern unter einem einzigen localStorage-Schlüssel. Der Speicher wird
// hineingereicht (testbar); jeder Zugriff steht in try/catch, Fehler gelangen nie nach oben.
import type { CustomBreathPattern } from '../breath/custom'
import type { EnergyLevel } from '../energy/areas'
import {
  emptyData,
  isSessionKind,
  parseData,
  type AppData,
  type Calm,
  type CalmLevel,
  type EnergyCheckin,
  type FocusSprint,
  type HackRun,
  type SessionResult,
} from './schema'
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
 * Hängt eine Sitzung an einen neuen Stand an (`data` bleibt unverändert). Hier gilt die
 * 60-Sekunden-Regel für neue Sitzungen (beim Import prüft `mergeBackup` dasselbe): kürzere ergeben
 * `null`. Ebenso eine Dauer, die keine endliche Zahl ist, oder ein ungültiger Beginn: Gespeichert
 * machte eine solche Sitzung beim nächsten Laden den ganzen Stand ungültig. Hack-Läufe und Sprints
 * sind keine Sitzungen und ergeben `null` (sie gehen über `withHackRun` / `withFocusSprint`). Wirft nie.
 */
export function withSession(data: AppData, result: SessionResult, id: string): AppData | null {
  if (!isSessionKind(result.kind)) return null
  if (!(Number.isFinite(result.seconds) && result.seconds >= MIN_SECONDS)) return null
  if (Number.isNaN(result.start.getTime())) return null
  const session = { id, start: result.start.toISOString(), kind: result.kind, ref: result.ref, seconds: Math.floor(result.seconds) }
  return { ...data, sessions: [...data.sessions, session] }
}

/**
 * Setzt oder entfernt (`null`) einen Ruhe-Wert einer Sitzung in einem neuen Stand (`data` bleibt
 * unverändert). Fehlen danach beide Werte, entfällt `calm`. Eine unbekannte ID ergibt `null`.
 */
export function withCalm(data: AppData, sessionId: string, which: 'before' | 'after', level: CalmLevel | null): AppData | null {
  const index = data.sessions.findIndex(s => s.id === sessionId)
  if (index === -1) return null
  const { calm: old, ...session } = data.sessions[index]
  const calm: Calm = { ...old }
  if (level === null) delete calm[which]
  else calm[which] = level
  const next = calm.before === undefined && calm.after === undefined ? session : { ...session, calm }
  return { ...data, sessions: data.sessions.map((s, i) => (i === index ? next : s)) }
}

/** Speichert ein eigenes Atemmuster in einem neuen Stand: ersetzt es nach Kennung oder hängt es an. */
export function withBreathPattern(data: AppData, pattern: CustomBreathPattern): AppData {
  const list = data.breathPatterns ?? []
  const breathPatterns = list.some(p => p.id === pattern.id) ? list.map(p => (p.id === pattern.id ? pattern : p)) : [...list, pattern]
  return { ...data, breathPatterns }
}

/** Entfernt ein eigenes Atemmuster; ohne Muster entfällt das Feld. Sitzungen und `lastUsed` bleiben. */
export function withoutBreathPattern(data: AppData, id: string): AppData {
  if (!data.breathPatterns?.some(p => p.id === id)) return data
  const { breathPatterns, ...rest } = data
  const left = breathPatterns.filter(p => p.id !== id)
  return left.length > 0 ? { ...rest, breathPatterns: left } : rest
}

/** Hängt einen Energie-Check-in an einen neuen Stand an (`data` bleibt unverändert). */
export function withCheckin(data: AppData, checkin: EnergyCheckin): AppData {
  return { ...data, energyCheckins: [...(data.energyCheckins ?? []), checkin] }
}

/** Hängt einen Hack-Lauf an einen neuen Stand an; die Mindestdauer prüft `hackRunFrom`. */
export function withHackRun(data: AppData, run: HackRun): AppData {
  return { ...data, hackRuns: [...(data.hackRuns ?? []), run] }
}

/** Hängt einen Fokus-Sprint an einen neuen Stand an; die Mindestdauer prüft `focusSprintFrom`. */
export function withFocusSprint(data: AppData, sprint: FocusSprint): AppData {
  return { ...data, focusSprints: [...(data.focusSprints ?? []), sprint] }
}

/**
 * Setzt oder entfernt (`null`) den Vorher- oder Jetzt-Wert eines Hack-Laufs in einem neuen Stand
 * (`data` bleibt unverändert). Eine unbekannte ID ergibt `null`.
 */
export function withHackEffect(data: AppData, runId: string, which: 'before' | 'after', level: EnergyLevel | null): AppData | null {
  const runs = data.hackRuns ?? []
  const index = runs.findIndex(r => r.id === runId)
  if (index === -1) return null
  const next = { ...runs[index] }
  if (level === null) delete next[which]
  else next[which] = level
  return { ...data, hackRuns: runs.map((r, i) => (i === index ? next : r)) }
}
