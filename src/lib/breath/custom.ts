// Eigene Atemmuster (Spec M8 §2): ein Name und vier Phasen in fester Reihenfolge. Reine Funktionen;
// gespeichert werden sie in `ruhe.v1.breathPatterns` (schema.ts), abgespielt als gewöhnliches `BreathPattern`.
import { isBuiltinPatternId, patternById, type BreathPattern, type BreathPhase } from './patterns'

export interface CustomBreathPattern {
  /** `eigen-` und 8 Hex-Zeichen; entsteht beim Anlegen und bleibt. */
  id: string
  /** Wie eingegeben; leer heißt das Muster „Eigenes Muster“ (`customTitle`). */
  name: string
  /** Sekunden je Phase, Vielfache von 0,5 innerhalb von `PHASE_LIMITS`. */
  inhale: number
  holdIn: number
  exhale: number
  holdOut: number
}

export type PhaseField = 'inhale' | 'holdIn' | 'exhale' | 'holdOut'

export const PHASE_FIELDS: readonly PhaseField[] = ['inhale', 'holdIn', 'exhale', 'holdOut']

export const PHASE_LIMITS: Record<PhaseField, { min: number; max: number }> = {
  inhale: { min: 2, max: 15 },
  holdIn: { min: 0, max: 20 },
  exhale: { min: 2, max: 20 },
  holdOut: { min: 0, max: 20 },
}

export const PHASE_FIELD_LABEL: Record<PhaseField, string> = {
  inhale: 'Einatmen',
  holdIn: 'Halten nach dem Einatmen',
  exhale: 'Ausatmen',
  holdOut: 'Halten nach dem Ausatmen',
}

const PHASE_KIND: Record<PhaseField, BreathPhase['kind']> = { inhale: 'ein', holdIn: 'halten', exhale: 'aus', holdOut: 'halten' }
const PHASE_WORD: Record<BreathPhase['kind'], string> = { ein: 'Einatmen', halten: 'Halten', aus: 'Ausatmen' }

export const PHASE_STEP = 0.5
/** Grenze beim Anlegen; beim Laden gilt `MAX_LOADED_PATTERNS` (Schutz vor kaputten Daten). */
export const MAX_CUSTOM_PATTERNS = 6
export const MAX_LOADED_PATTERNS = 50
export const MAX_NAME_LENGTH = 30
export const DEFAULT_PATTERN_NAME = 'Eigenes Muster'
export const CUSTOM_PATTERN_ID = /^eigen-[0-9a-f]{8}$/

export function newCustomPatternId(): string {
  return `eigen-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
}

/** Neues Muster mit den Standardwerten 4-2-6-0 und leerem Namen. */
export function defaultCustomPattern(id: string): CustomBreathPattern {
  return { id, name: '', inhale: 4, holdIn: 2, exhale: 6, holdOut: 0 }
}

/** Eine Stufe länger (`1`) oder kürzer (`-1`); an den Grenzen bleibt der Wert. */
export function stepSeconds(field: PhaseField, value: number, direction: 1 | -1): number {
  const { min, max } = PHASE_LIMITS[field]
  return Math.min(max, Math.max(min, value + direction * PHASE_STEP))
}

/** Sekunden mit Komma, ohne überflüssige Nullen: „4 s“, „5,5 s“. Zahl und Einheit trennt ein geschütztes Leerzeichen. */
export function secondsLabel(seconds: number): string {
  return `${String(seconds).replace('.', ',')}\u00a0s`
}

export function customTitle(p: CustomBreathPattern): string {
  return p.name.trim() || DEFAULT_PATTERN_NAME
}

function phasesOf(p: CustomBreathPattern): BreathPhase[] {
  return PHASE_FIELDS.filter((field) => p[field] > 0).map((field) => ({ kind: PHASE_KIND[field], seconds: p[field] }))
}

/** Als gewöhnliches Atemmuster: Phasen mit 0 s entfallen, die Beschreibung nennt die übrigen. */
export function customToPattern(p: CustomBreathPattern): BreathPattern {
  const phases = phasesOf(p)
  return {
    id: p.id,
    title: customTitle(p),
    description: phases.map((phase) => `${PHASE_WORD[phase.kind]} ${secondsLabel(phase.seconds)}`).join(' · '),
    effect: 'Eigener Rhythmus',
    phases,
  }
}

/** „Ein Atemzug dauert 12 s, etwa 5 pro Minute.“ (pro Minute auf eine Nachkommastelle). */
export function cyclePreview(p: CustomBreathPattern): string {
  const cycle = PHASE_FIELDS.reduce((sum, field) => sum + p[field], 0)
  const perMinute = Math.round(600 / cycle) / 10
  return `Ein Atemzug dauert ${secondsLabel(cycle)}, etwa ${String(perMinute).replace('.', ',')} pro Minute.`
}

function isSeconds(field: PhaseField, v: unknown): v is number {
  const { min, max } = PHASE_LIMITS[field]
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && Number.isInteger(v * 2)
}

/** Strenge Prüfung eines gespeicherten Musters; ungültig ergibt `null`, ein zu langer Name wird gekürzt. */
export function parseCustomPattern(raw: unknown): CustomBreathPattern | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const { id, name, inhale, holdIn, exhale, holdOut } = raw as Record<string, unknown>
  if (typeof id !== 'string' || !CUSTOM_PATTERN_ID.test(id) || typeof name !== 'string') return null
  if (!isSeconds('inhale', inhale) || !isSeconds('holdIn', holdIn) || !isSeconds('exhale', exhale) || !isSeconds('holdOut', holdOut)) return null
  return { id, name: name.slice(0, MAX_NAME_LENGTH), inhale, holdIn, exhale, holdOut }
}

/** Feste Übung oder eigenes Muster zu einer Kennung; unbekannt (z. B. gelöscht) ergibt `null`. */
export function resolvePattern(id: string, custom: readonly CustomBreathPattern[]): BreathPattern | null {
  if (isBuiltinPatternId(id)) return patternById(id)
  const own = custom.find((p) => p.id === id)
  return own ? customToPattern(own) : null
}
