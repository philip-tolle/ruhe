// Datenschema der gespeicherten Daten (localStorage['ruhe.v1']) mit strenger Prüfung.
// Reine Funktionen ohne Speicherzugriff; das Laden und Sichern übernimmt die Persistenz.
import { isBackgroundId, type BackgroundId } from '../sounds/catalog'
import { BREATH_MINUTES, BREATH_PATTERNS, type BreathPatternId } from '../breath/patterns'
import { INTERVAL_OPTIONS } from '../meditation/timer-plan'

export type SessionKind = 'guided' | 'timer' | 'breath'

export interface Session {
  id: string
  /** ISO-Zeitpunkt des Beginns. */
  start: string
  kind: SessionKind
  /** Meditations-ID, 'timer' oder Atemübungs-ID. */
  ref: string
  /** Tatsächlich absolvierte Sekunden. */
  seconds: number
}

/** Von der Engine gemeldetes Ende einer Sitzung. */
export interface SessionResult {
  kind: SessionKind
  ref: string
  start: Date
  seconds: number
}

export interface Settings {
  vibration: boolean
  /** Balance Stimme ↔ Hintergrund (0 … 1), für Meilenstein 3. */
  voiceBalance: number
  /** Standard-Hintergrund des Timers (Naturklang oder Musik). */
  timerSound: BackgroundId | null
  /** Zuletzt gewählter Hintergrund geführter Meditationen (eigener Wert, unabhängig vom Timer). */
  guidedSound: BackgroundId | null
  /** Vorlauf beim Timer. */
  timerLead: boolean
  /** Zuletzt gewählt im Timer. */
  timer: { minutes: number; intervalMin: number | null }
}

export type LastUsed =
  | { kind: 'timer'; minutes: number; intervalMin: number | null; sound: BackgroundId | null; lead: boolean }
  | { kind: 'breath'; pattern: BreathPatternId; minutes: number }
  | { kind: 'guided'; id: string }

export interface AppData {
  version: 1
  sessions: Session[]
  settings: Settings
  lastUsed?: LastUsed
}

function defaultSettings(): Settings {
  return { vibration: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }
}

export const DEFAULT_SETTINGS: Settings = defaultSettings()

/** Leerer Stand; jedes Mal neue Objekte, weil Aufrufer sie verändern. */
export function emptyData(): AppData {
  return { version: 1, sessions: [], settings: defaultSettings() }
}

const SESSION_KINDS: readonly string[] = ['guided', 'timer', 'breath']
const PATTERN_IDS: readonly string[] = BREATH_PATTERNS.map(p => p.id)
const MAX_TIMER_MINUTES = 120

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isPatternId(v: unknown): v is BreathPatternId {
  return typeof v === 'string' && PATTERN_IDS.includes(v)
}
function isInterval(v: unknown): v is number | null {
  return INTERVAL_OPTIONS.includes(v as number | null)
}
function isPositive(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

// ISO-Datum mit Uhrzeit; Date.parse allein ließe auch Texte wie "1" oder "Oct 21" durch.
const ISO_START = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

function parseSession(raw: unknown): Session | null {
  if (!isRecord(raw)) return null
  const { id, start, kind, ref, seconds } = raw
  if (typeof id !== 'string' || id === '') return null
  if (typeof start !== 'string' || !ISO_START.test(start) || Number.isNaN(Date.parse(start))) return null
  if (typeof kind !== 'string' || !SESSION_KINDS.includes(kind)) return null
  if (typeof ref !== 'string') return null
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null
  return { id, start, kind: kind as SessionKind, ref, seconds }
}

/** Jedes fehlende oder ungültige Feld bekommt seinen Standardwert. */
function parseSettings(raw: Record<string, unknown>): Settings {
  const def = defaultSettings()
  const { vibration, voiceBalance, timerSound, guidedSound, timerLead } = raw
  const timer = isRecord(raw.timer) ? raw.timer : {}
  const { minutes, intervalMin } = timer
  return {
    vibration: typeof vibration === 'boolean' ? vibration : def.vibration,
    voiceBalance: typeof voiceBalance === 'number' && voiceBalance >= 0 && voiceBalance <= 1 ? voiceBalance : def.voiceBalance,
    timerSound: timerSound === null || isBackgroundId(timerSound) ? timerSound : def.timerSound,
    guidedSound: guidedSound === null || isBackgroundId(guidedSound) ? guidedSound : def.guidedSound,
    timerLead: typeof timerLead === 'boolean' ? timerLead : def.timerLead,
    timer: {
      minutes: typeof minutes === 'number' && Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_TIMER_MINUTES ? minutes : def.timer.minutes,
      intervalMin: isInterval(intervalMin) ? intervalMin : def.timer.intervalMin,
    },
  }
}

/** Ungültig ergibt `null`; die Karte „Zuletzt genutzt“ ist nie ein Grund, Daten zu verwerfen. */
function parseLastUsed(raw: unknown): LastUsed | null {
  if (!isRecord(raw)) return null
  if (raw.kind === 'timer') {
    const { minutes, intervalMin, sound, lead } = raw
    if (!isPositive(minutes) || !isInterval(intervalMin) || !(sound === null || isBackgroundId(sound)) || typeof lead !== 'boolean') return null
    return { kind: 'timer', minutes, intervalMin, sound, lead }
  }
  if (raw.kind === 'breath') {
    const { pattern, minutes } = raw
    // Nur die angebotenen Dauern: Eine Atemübung startet über diesen Eintrag direkt.
    if (!isPatternId(pattern) || typeof minutes !== 'number' || !BREATH_MINUTES.includes(minutes)) return null
    return { kind: 'breath', pattern, minutes }
  }
  if (raw.kind === 'guided') {
    // Ob es die Meditation gibt, prüft erst der Katalog beim Anzeigen; hier nur die Form.
    const { id } = raw
    if (typeof id !== 'string' || id === '') return null
    return { kind: 'guided', id }
  }
  return null
}

/**
 * Strenge Strukturprüfung. Eine ungültige Sitzung macht alles ungültig (`null`);
 * fehlende oder ungültige Einstellungen werden aufgefüllt, ein ungültiges `lastUsed` entfällt.
 */
export function parseData(raw: unknown): AppData | null {
  if (!isRecord(raw) || raw.version !== 1) return null
  if (!Array.isArray(raw.sessions) || !isRecord(raw.settings)) return null
  const sessions: Session[] = []
  for (const item of raw.sessions) {
    const session = parseSession(item)
    if (!session) return null
    sessions.push(session)
  }
  const data: AppData = { version: 1, sessions, settings: parseSettings(raw.settings) }
  const lastUsed = parseLastUsed(raw.lastUsed)
  if (lastUsed) data.lastUsed = lastUsed
  return data
}
