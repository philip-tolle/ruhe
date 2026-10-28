// Datenschema der gespeicherten Daten (localStorage['ruhe.v1']) mit strenger Prüfung.
// Reine Funktionen ohne Speicherzugriff; das Laden und Sichern übernimmt die Persistenz.
import { isBackgroundId, type BackgroundId } from '../sounds/catalog'
import { BREATH_MINUTES, isBuiltinPatternId } from '../breath/patterns'
import { CUSTOM_PATTERN_ID, MAX_LOADED_PATTERNS, parseCustomPattern, type CustomBreathPattern } from '../breath/custom'
import { INTERVAL_OPTIONS } from '../meditation/timer-plan'
import { isEnergyArea, isEnergyLevel, AREAS, type EnergyArea, type EnergyLevel } from '../energy/areas'
import { DOMINO_MAX, GRATITUDE_MAX, INTENTION_MAX, VALUE_MAX } from '../morning/words'

export type SessionKind = 'guided' | 'timer' | 'breath'

/** Art eines Engine-Ergebnisses: Sitzungen, dazu Hack-Läufe und Fokus-Sprints (Spec M9 §5.2). */
export type ResultKind = SessionKind | 'hack' | 'focus'

/** Ruhe in fünf Stufen, von 1 „sehr unruhig“ bis 5 „ganz ruhig“ (Spec M6 §2). */
export type CalmLevel = 1 | 2 | 3 | 4 | 5

/** Ruhe-Check-in einer Sitzung: wie ruhig vorher und jetzt, beides freiwillig. */
export interface Calm {
  before?: CalmLevel
  after?: CalmLevel
}

export interface Session {
  id: string
  /** ISO-Zeitpunkt des Beginns. */
  start: string
  kind: SessionKind
  /** Meditations-ID, 'timer' oder Atemübungs-ID. */
  ref: string
  /** Tatsächlich absolvierte Sekunden. */
  seconds: number
  /** Ruhe-Check-in; fehlt, solange nichts festgehalten ist (nie ein leeres Objekt). */
  calm?: Calm
}

/** Check-in der vier Energie-Bereiche (Spec M9 §6.1): alle vier Stufen oder gar kein Eintrag. */
export interface EnergyCheckin {
  id: string
  /** ISO-Zeitpunkt des Check-ins. */
  at: string
  levels: Record<EnergyArea, EnergyLevel>
}

/** Ein gespielter Hack; `before` und `after` sind freiwillig, die Wirkung ist `after − before`. */
export interface HackRun {
  id: string
  /** ISO-Zeitpunkt des Beginns. */
  at: string
  /** Hack-Kennung; ob es ihn noch gibt, prüft der Katalog beim Anzeigen. */
  hack: string
  /** Bereich des Hacks zum Zeitpunkt des Laufs. */
  area: EnergyArea
  /** Tatsächlich gehörte Sekunden. */
  seconds: number
  before?: EnergyLevel
  after?: EnergyLevel
}

/** Angebotene Längen eines Fokus-Sprints in Minuten. */
export const FOCUS_MINUTES = [25, 50, 90] as const
export type FocusMinutes = (typeof FOCUS_MINUTES)[number]

export interface FocusSprint {
  id: string
  /** ISO-Zeitpunkt des Beginns. */
  at: string
  /** Gewählte Länge; `seconds` ist die tatsächliche. */
  planned: FocusMinutes
  seconds: number
  /** Woran gearbeitet wurde, höchstens `MAX_TASK_LENGTH` Zeichen; fehlt, wenn leer. */
  task?: string
}

export const MAX_TASK_LENGTH = 80

export type MorningVariant = 'kurz' | 'lang'

/** Ein Morgen-Start (Spec M10 §4.1): je Tag höchstens einer; die Texte sind getrimmt und gekürzt, leere fehlen. */
export interface MorningEntry {
  /** Tag in Ortszeit, `JJJJ-MM-TT`. */
  day: string
  /** ISO-Zeitpunkt, an dem der Abschluss erreicht wurde. */
  at: string
  variant: MorningVariant
  intention?: string
  gratitude?: string
  /** Nur bei `lang`. */
  value?: string
  domino?: string
  /** ISO-Zeitpunkt des Abhakens; nur mit `domino`. */
  dominoDone?: string
}

/** Was der Ablauf am Ende meldet; Tag und Zeitpunkt setzt `withMorning`, die Texte prüft und kürzt es. */
export interface MorningInput {
  variant: MorningVariant
  intention?: string
  gratitude?: string
  value?: string
  domino?: string
}

/** Von der Engine gemeldetes Ende einer Sitzung, eines Hacks oder eines Sprints. */
export interface SessionResult {
  kind: ResultKind
  ref: string
  start: Date
  seconds: number
  /** Beim Sprint die Aufgabe (Freitext, ungeprüft); sonst ohne Bedeutung. */
  note?: string
}

export interface Settings {
  vibration: boolean
  /** Leises Atemgeräusch bei Atemübungen. */
  breathSound: boolean
  /** Balance Stimme ↔ Hintergrund (0 … 1), für Meilenstein 3. */
  voiceBalance: number
  /** Standard-Hintergrund des Timers (Naturklang oder Musik). */
  timerSound: BackgroundId | null
  /** Zuletzt gewählter Hintergrund geführter Meditationen (eigener Wert, unabhängig vom Timer). */
  guidedSound: BackgroundId | null
  /** Hintergrund bei Atemübungen (Naturklang oder Musik), für alle Übungen gleich; anfangs keiner. */
  breathBackground: BackgroundId | null
  /** Vorlauf beim Timer. */
  timerLead: boolean
  /** Zuletzt gewählt im Timer. */
  timer: { minutes: number; intervalMin: number | null }
  /** Fokus-Sprint: gewählte Länge und Hintergrund (Musik oder Naturklang, auch keiner). */
  focus: { minutes: FocusMinutes; sound: BackgroundId | null }
}

export type LastUsed =
  | { kind: 'timer'; minutes: number; intervalMin: number | null; sound: BackgroundId | null; lead: boolean }
  /** `pattern`: feste Übung oder eigenes Muster (`eigen-…`); ob es das eigene noch gibt, prüft die Anzeige. */
  | { kind: 'breath'; pattern: string; minutes: number }
  | { kind: 'guided'; id: string }

export interface AppData {
  version: 1
  sessions: Session[]
  settings: Settings
  lastUsed?: LastUsed
  /** Eigene Atemmuster (Spec M8 §7); fehlt, solange es keine gibt. */
  breathPatterns?: CustomBreathPattern[]
  /** Energie-Check-ins, Hack-Läufe und Fokus-Sprints (Spec M9 §6.1); fehlen, solange es keine gibt. */
  energyCheckins?: EnergyCheckin[]
  hackRuns?: HackRun[]
  focusSprints?: FocusSprint[]
  /** Morgen-Starts (Spec M10 §4.1), nach Tag sortiert, je Tag einer; fehlt, solange es keinen gibt. */
  mornings?: MorningEntry[]
}

function defaultSettings(): Settings {
  return { vibration: true, breathSound: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, breathBackground: null, timerLead: true, timer: { minutes: 10, intervalMin: null }, focus: { minutes: 50, sound: 'kaffee-und-notizen' } }
}

export const DEFAULT_SETTINGS: Settings = defaultSettings()

/** Leerer Stand; jedes Mal neue Objekte, weil Aufrufer sie verändern. */
export function emptyData(): AppData {
  return { version: 1, sessions: [], settings: defaultSettings() }
}

const SESSION_KINDS: readonly string[] = ['guided', 'timer', 'breath']
const MAX_TIMER_MINUTES = 120

/** Eine echte Sitzung (nicht Hack-Lauf oder Sprint): Nur sie gehört in `sessions`. */
export function isSessionKind(k: ResultKind): k is SessionKind {
  return SESSION_KINDS.includes(k)
}

export function isFocusMinutes(v: unknown): v is FocusMinutes {
  return (FOCUS_MINUTES as readonly unknown[]).includes(v)
}

export function isMorningVariant(v: unknown): v is MorningVariant {
  return v === 'kurz' || v === 'lang'
}

// Gezählt werden Unicode-Zeichen (Codepunkte), damit kein Ersatzpaar zerreißt. Der Morgen-Start kürzt damit auch beim
// Tippen (ohne zu trimmen, ein Leerzeichen zwischen zwei Wörtern muss sich tippen lassen), damit Feld und Speicher
// dieselbe Grenze haben; `maxlength` zählte UTF-16-Einheiten und schnitte ein Emoji nach der Hälfte der Zeichen ab.
export function clipChars(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max).join('') : text
}

/** Kürzt eine Aufgabe auf `MAX_TASK_LENGTH` Zeichen; sie trimmt nicht (das tun die Aufrufer). */
export function clipTask(text: string): string {
  return clipChars(text, MAX_TASK_LENGTH)
}

/**
 * Trimmt und kürzt auf `max` Zeichen; leer ergibt `''`. Der Schnitt kann auf einem Leerzeichen landen, darum wird
 * danach noch einmal hinten getrimmt: Gespeichert ist immer ein getrimmter Text (Spec M10 §4.1).
 */
export function clipText(text: string, max: number): string {
  return clipChars(text.trim(), max).trimEnd()
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isPatternId(v: unknown): v is string {
  return typeof v === 'string' && (isBuiltinPatternId(v) || CUSTOM_PATTERN_ID.test(v))
}
function isInterval(v: unknown): v is number | null {
  return INTERVAL_OPTIONS.includes(v as number | null)
}
function isPositive(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

// ISO-Datum mit Uhrzeit; Date.parse allein ließe auch Texte wie "1" oder "Oct 21" durch.
const ISO_START = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

function isIsoTime(v: unknown): v is string {
  return typeof v === 'string' && ISO_START.test(v) && !Number.isNaN(Date.parse(v))
}

function isCalmLevel(v: unknown): v is CalmLevel {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5
}

/** Nur gültige Stufen bleiben; ohne eine gültige ergibt es `undefined`. Verwirft nie die Sitzung. */
function parseCalm(raw: unknown): Calm | undefined {
  if (!isRecord(raw)) return undefined
  const calm: Calm = {}
  if (isCalmLevel(raw.before)) calm.before = raw.before
  if (isCalmLevel(raw.after)) calm.after = raw.after
  return calm.before === undefined && calm.after === undefined ? undefined : calm
}

function parseSession(raw: unknown): Session | null {
  if (!isRecord(raw)) return null
  const { id, start, kind, ref, seconds } = raw
  if (typeof id !== 'string' || id === '') return null
  if (!isIsoTime(start)) return null
  if (typeof kind !== 'string' || !SESSION_KINDS.includes(kind)) return null
  if (typeof ref !== 'string') return null
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null
  const session: Session = { id, start, kind: kind as SessionKind, ref, seconds }
  const calm = parseCalm(raw.calm)
  if (calm) session.calm = calm
  return session
}

/** Jedes fehlende oder ungültige Feld bekommt seinen Standardwert. */
function parseSettings(raw: Record<string, unknown>): Settings {
  const def = defaultSettings()
  const { vibration, breathSound, voiceBalance, timerSound, guidedSound, breathBackground, timerLead } = raw
  const timer = isRecord(raw.timer) ? raw.timer : {}
  const { minutes, intervalMin } = timer
  const focus = isRecord(raw.focus) ? raw.focus : {}
  return {
    vibration: typeof vibration === 'boolean' ? vibration : def.vibration,
    breathSound: typeof breathSound === 'boolean' ? breathSound : def.breathSound,
    voiceBalance: typeof voiceBalance === 'number' && voiceBalance >= 0 && voiceBalance <= 1 ? voiceBalance : def.voiceBalance,
    timerSound: timerSound === null || isBackgroundId(timerSound) ? timerSound : def.timerSound,
    guidedSound: guidedSound === null || isBackgroundId(guidedSound) ? guidedSound : def.guidedSound,
    breathBackground: breathBackground === null || isBackgroundId(breathBackground) ? breathBackground : def.breathBackground,
    timerLead: typeof timerLead === 'boolean' ? timerLead : def.timerLead,
    timer: {
      minutes: typeof minutes === 'number' && Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_TIMER_MINUTES ? minutes : def.timer.minutes,
      intervalMin: isInterval(intervalMin) ? intervalMin : def.timer.intervalMin,
    },
    focus: {
      minutes: isFocusMinutes(focus.minutes) ? focus.minutes : def.focus.minutes,
      sound: focus.sound === null || isBackgroundId(focus.sound) ? focus.sound : def.focus.sound,
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

/** Gültige eigene Muster in ihrer Reihenfolge; ungültige und doppelte Kennungen entfallen einzeln. */
function parseBreathPatterns(raw: unknown): CustomBreathPattern[] {
  if (!Array.isArray(raw)) return []
  const patterns: CustomBreathPattern[] = []
  for (const item of raw) {
    const pattern = parseCustomPattern(item)
    if (pattern && !patterns.some(p => p.id === pattern.id)) patterns.push(pattern)
    if (patterns.length === MAX_LOADED_PATTERNS) break
  }
  return patterns
}

/** Alle vier Stufen gültig, sonst `null`; weitere Schlüssel entfallen. */
function parseLevels(raw: unknown): Record<EnergyArea, EnergyLevel> | null {
  if (!isRecord(raw)) return null
  const levels: Partial<Record<EnergyArea, EnergyLevel>> = {}
  for (const area of AREAS) {
    const level = raw[area]
    if (!isEnergyLevel(level)) return null
    levels[area] = level
  }
  return levels as Record<EnergyArea, EnergyLevel>
}

function parseCheckin(raw: unknown): EnergyCheckin | null {
  if (!isRecord(raw)) return null
  const { id, at } = raw
  if (typeof id !== 'string' || id === '' || !isIsoTime(at)) return null
  const levels = parseLevels(raw.levels)
  return levels ? { id, at, levels } : null
}

/** Der Hack muss dem Katalog nicht (mehr) angehören; geprüft wird nur die Form. Ungültige Stufen entfallen einzeln. */
function parseHackRun(raw: unknown): HackRun | null {
  if (!isRecord(raw)) return null
  const { id, at, hack, area, seconds } = raw
  if (typeof id !== 'string' || id === '' || !isIsoTime(at)) return null
  if (typeof hack !== 'string' || !isEnergyArea(area)) return null
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null
  const run: HackRun = { id, at, hack, area, seconds }
  if (isEnergyLevel(raw.before)) run.before = raw.before
  if (isEnergyLevel(raw.after)) run.after = raw.after
  return run
}

function parseFocusSprint(raw: unknown): FocusSprint | null {
  if (!isRecord(raw)) return null
  const { id, at, planned, seconds, task } = raw
  if (typeof id !== 'string' || id === '' || !isIsoTime(at) || !isFocusMinutes(planned)) return null
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null
  const sprint: FocusSprint = { id, at, planned, seconds }
  const clipped = typeof task === 'string' ? clipTask(task) : ''
  if (clipped !== '') sprint.task = clipped
  return sprint
}

/** Gültige Einträge in ihrer Reihenfolge; ungültige entfallen einzeln. */
function parseList<T>(raw: unknown, parse: (item: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return []
  const list: T[] = []
  for (const item of raw) {
    const parsed = parse(item)
    if (parsed) list.push(parsed)
  }
  return list
}

/** Ein Kalendertag `JJJJ-MM-TT`, den es gibt: `2026-02-30` und `2026-13-01` nicht. */
function isDayKey(v: unknown): v is string {
  if (typeof v !== 'string') return false
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  // Date rechnet einen Überlauf weiter (30. Februar → 2. März); stimmt das Datum danach nicht mehr, gab es den Tag nicht.
  // setUTCFullYear statt Date.UTC, weil Letzteres die Jahre 0 bis 99 auf 1900 bis 1999 legt.
  const t = new Date(0)
  t.setUTCFullYear(y, mo - 1, d)
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

/** Getrimmt und gekürzt; ohne Text (fehlt, falscher Typ, nur Leerraum) ergibt es `undefined`. */
function parseText(raw: unknown, max: number): string | undefined {
  const text = typeof raw === 'string' ? clipText(raw, max) : ''
  return text === '' ? undefined : text
}

/** Ungültiger Tag, Zeitpunkt oder Variante ergibt `null`; ungültige Texte entfallen einzeln, der Eintrag bleibt. */
function parseMorning(raw: unknown): MorningEntry | null {
  if (!isRecord(raw)) return null
  const { day, at, variant } = raw
  if (!isDayKey(day) || !isIsoTime(at) || !isMorningVariant(variant)) return null
  const entry: MorningEntry = { day, at, variant }
  const intention = parseText(raw.intention, INTENTION_MAX)
  if (intention) entry.intention = intention
  const gratitude = parseText(raw.gratitude, GRATITUDE_MAX)
  if (gratitude) entry.gratitude = gratitude
  const value = variant === 'lang' ? parseText(raw.value, VALUE_MAX) : undefined
  if (value) entry.value = value
  const domino = parseText(raw.domino, DOMINO_MAX)
  if (domino) entry.domino = domino
  if (domino && isIsoTime(raw.dominoDone)) entry.dominoDone = raw.dominoDone
  return entry
}

/** Je Tag der Eintrag mit dem späteren `at` (bei gleichem Zeitpunkt der erste), nach Tag sortiert. */
function parseMornings(raw: unknown): MorningEntry[] {
  const byDay = new Map<string, MorningEntry>()
  for (const entry of parseList(raw, parseMorning)) {
    const known = byDay.get(entry.day)
    if (!known || Date.parse(entry.at) > Date.parse(known.at)) byDay.set(entry.day, entry)
  }
  return sortByDay([...byDay.values()])
}

/** Nach Tag aufsteigend; `JJJJ-MM-TT` ordnet sich als Text richtig. */
export function sortByDay(list: readonly MorningEntry[]): MorningEntry[] {
  return [...list].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}

/**
 * Strenge Strukturprüfung. Eine ungültige Sitzung macht alles ungültig (`null`);
 * fehlende oder ungültige Einstellungen werden aufgefüllt, ein ungültiges `lastUsed`, ungültige eigene
 * Atemmuster sowie ungültige Check-ins, Hack-Läufe, Sprints und Morgen-Einträge entfallen einzeln.
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
  const breathPatterns = parseBreathPatterns(raw.breathPatterns)
  if (breathPatterns.length > 0) data.breathPatterns = breathPatterns
  const energyCheckins = parseList(raw.energyCheckins, parseCheckin)
  if (energyCheckins.length > 0) data.energyCheckins = energyCheckins
  const hackRuns = parseList(raw.hackRuns, parseHackRun)
  if (hackRuns.length > 0) data.hackRuns = hackRuns
  const focusSprints = parseList(raw.focusSprints, parseFocusSprint)
  if (focusSprints.length > 0) data.focusSprints = focusSprints
  const mornings = parseMornings(raw.mornings)
  if (mornings.length > 0) data.mornings = mornings
  return data
}
