// Brain Hacks (Spec M9 §4, §5.1): kurze Übungen als Daten in content/hacks.json, gespielt von einem Player.
// Reine Berechnung ohne Audio-Zugriff; Zeiten sind Sekunden ab Start des Hacks. Drei Führungsarten:
// „takt“ (Atemkurve im Zyklus), „schritte“ (Schritt-Text mit Zeit je Schritt) und „ring“ (ein Timer).
import data from '../../../content/hacks.json'
import { isBuiltinPatternId, type BreathPatternId } from '../breath/patterns'
import { isEnergyArea, type EnergyArea } from './areas'

export type HackGuide = 'takt' | 'schritte' | 'ring'
export type TaktPhase = 'ein' | 'nach' | 'aus' | 'halten'

/** Linien-Symbole für die Schritte; gezeichnet von HackIcon.svelte. */
export const HACK_ICONS = [
  'einatmen', 'nachatmen', 'ausatmen', 'halten', 'bewegung', 'gehen', 'sonne', 'wasser', 'liegen',
  'stift', 'herz', 'auge', 'handy-weg', 'kompass', 'stern', 'pfeil', 'frage',
] as const

export type HackIconName = (typeof HACK_ICONS)[number]

export interface HackStep {
  title: string
  detail: string
  icon: HackIconName
  /** Nur bei „schritte“: Dauer des Schritts, mindestens 10 s. */
  seconds?: number
}

export interface TaktPhaseDef {
  phase: TaktPhase
  seconds: number
  /** Anweisung im Player, z. B. „Tief einatmen …“. */
  say: string
}

/** Eine Phase oder eine Gruppe, die ihre Phasen `repeat`-mal wiederholt. */
export type TaktEntry = TaktPhaseDef | { repeat: number; phases: TaktPhaseDef[] }

export interface Hack {
  /** Kleinbuchstaben, Ziffern, Bindestrich. */
  id: string
  title: string
  area: EnergyArea
  /** Nenndauer auf Karte und Kachel, 1 bis 10. */
  minutes: number
  /** Ein Satz Nutzen. */
  benefit: string
  guide: HackGuide
  /** Karte „So geht’s“; bei „schritte“ mit Sekunden, die zusammen `minutes × 60` ergeben. */
  steps: HackStep[]
  /** Nur bei „takt“: ein Zyklus der Atemkurve. */
  cycle?: TaktEntry[]
  /** Wirkungsbild „from → to“ und zwei, drei Sätze. */
  why: { from: string; to: string; text: string }
  source: string
  /** Leseempfehlung („Weiterlesen: …“) oder null. */
  further: string | null
  /** Sicherheitshinweis oder null. */
  caution: string | null
  /** Volle Stunden Ortszeit, `from ≤ Stunde < to`; der Jetzt-Reset schlägt den Hack nur darin vor. */
  window: { from: number; to: number } | null
  /** „Passt dazu“: eine feste Atemübung der App. */
  link: { kind: 'breath'; id: BreathPatternId } | null
}

export const HACKS: readonly Hack[] = data.hacks as Hack[]

const GUIDES: readonly HackGuide[] = ['takt', 'schritte', 'ring']
const TAKT_PHASES: readonly TaktPhase[] = ['ein', 'nach', 'aus', 'halten']
const HACK_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MIN_STEP_SECONDS = 10
const PHASE_SECONDS = { min: 0.5, max: 30 }
/** Pegel am Ende von „ein“, wenn „nach“ folgt: Das Nachatmen füllt den Rest. */
const BEFORE_TOP_UP = 0.8

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isText(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function stepProblems(raw: unknown, where: string, guide: unknown): string[] {
  if (!isRecord(raw)) return [`${where}: kein Objekt`]
  const problems: string[] = []
  if (!isText(raw.title)) problems.push(`${where}: Titel fehlt`)
  if (!isText(raw.detail)) problems.push(`${where}: Erklärung fehlt`)
  if (!(HACK_ICONS as readonly unknown[]).includes(raw.icon)) problems.push(`${where}: unbekanntes Symbol ${String(raw.icon)}`)
  if (guide === 'schritte') {
    if (!isNumber(raw.seconds) || raw.seconds < MIN_STEP_SECONDS) problems.push(`${where}: braucht mindestens ${MIN_STEP_SECONDS} s`)
  } else if (raw.seconds !== undefined) {
    problems.push(`${where}: Sekunden nur bei „schritte“`)
  }
  return problems
}

function phaseProblems(raw: unknown, where: string): string[] {
  if (!isRecord(raw)) return [`${where}: kein Objekt`]
  const problems: string[] = []
  if (!(TAKT_PHASES as readonly unknown[]).includes(raw.phase)) problems.push(`${where}: unbekannte Phase ${String(raw.phase)}`)
  if (!isNumber(raw.seconds) || raw.seconds < PHASE_SECONDS.min || raw.seconds > PHASE_SECONDS.max) {
    problems.push(`${where}: Dauer muss ${PHASE_SECONDS.min}–${PHASE_SECONDS.max} s sein`)
  }
  if (!isText(raw.say)) problems.push(`${where}: Anweisung fehlt`)
  return problems
}

/** Befunde zum Zyklus eines Takt-Hacks; Gruppen zählen mit ihren Wiederholungen. */
function cycleProblems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ['cycle: fehlt']
  const problems: string[] = []
  let count = 0
  raw.forEach((entry, i) => {
    if (isRecord(entry) && 'repeat' in entry) {
      const { repeat, phases } = entry
      const repeatOk = Number.isInteger(repeat) && (repeat as number) >= 1
      if (!repeatOk) problems.push(`cycle[${i}]: repeat muss eine ganze Zahl ab 1 sein`)
      if (!Array.isArray(phases) || phases.length === 0) problems.push(`cycle[${i}]: Gruppe ohne Phasen`)
      else {
        phases.forEach((p, j) => problems.push(...phaseProblems(p, `cycle[${i}].phases[${j}]`)))
        if (repeatOk) count += (repeat as number) * phases.length
      }
    } else {
      problems.push(...phaseProblems(entry, `cycle[${i}]`))
      count += 1
    }
  })
  if (count < 2) problems.push('cycle: mindestens zwei Phasen')
  return problems
}

function windowProblems(raw: unknown): string[] {
  if (raw === null) return []
  const hour = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 24
  if (!isRecord(raw) || !hour(raw.from) || !hour(raw.to) || (raw.from as number) >= (raw.to as number)) {
    return ['window: volle Stunden 0–24 mit from < to oder null']
  }
  return []
}

function linkProblems(raw: unknown): string[] {
  if (raw === null) return []
  if (!isRecord(raw) || raw.kind !== 'breath' || typeof raw.id !== 'string' || !isBuiltinPatternId(raw.id)) {
    return ['link: muss auf eine feste Atemübung zeigen oder null sein']
  }
  return []
}

/** Prüft einen rohen Eintrag aus content/hacks.json nach Spec §5.1; leer heißt gültig. */
export function hackProblems(raw: unknown): string[] {
  if (!isRecord(raw)) return ['kein Objekt']
  const { id, title, area, minutes, benefit, guide, steps, cycle, why, source, further, caution, window: hours, link } = raw
  const problems: string[] = []
  if (typeof id !== 'string' || !HACK_ID.test(id)) problems.push(`id: ungültige Kennung ${String(id)}`)
  if (!isText(title)) problems.push('title: fehlt')
  if (!isEnergyArea(area)) problems.push(`area: unbekannter Bereich ${String(area)}`)
  const minutesOk = Number.isInteger(minutes) && (minutes as number) >= 1 && (minutes as number) <= 10
  if (!minutesOk) problems.push('minutes: ganze Zahl von 1 bis 10')
  if (!isText(benefit)) problems.push('benefit: fehlt')
  if (!(GUIDES as readonly unknown[]).includes(guide)) problems.push(`guide: unbekannte Führung ${String(guide)}`)
  if (!Array.isArray(steps) || steps.length === 0) problems.push('steps: mindestens ein Schritt')
  else {
    steps.forEach((s, i) => problems.push(...stepProblems(s, `steps[${i}]`, guide)))
    if (guide === 'schritte' && minutesOk) {
      const sum = steps.reduce((total: number, s) => total + (isRecord(s) && isNumber(s.seconds) ? s.seconds : 0), 0)
      if (Math.abs(sum - (minutes as number) * 60) > 1e-6) problems.push(`steps: zusammen ${sum} s statt ${(minutes as number) * 60} s`)
    }
  }
  if (guide === 'takt') problems.push(...cycleProblems(cycle))
  else if (cycle !== undefined) problems.push('cycle: nur bei „takt“')
  if (!isRecord(why) || !isText(why.from) || !isText(why.to) || !isText(why.text)) problems.push('why: from, to und text nötig')
  if (!isText(source)) problems.push('source: fehlt')
  if (further !== null && !isText(further)) problems.push('further: Text oder null')
  if (caution !== null && !isText(caution)) problems.push('caution: Text oder null')
  problems.push(...windowProblems(hours), ...linkProblems(link))
  return problems
}

export function hackById(id: string): Hack | null {
  return HACKS.find((h) => h.id === id) ?? null
}

/** Die Hacks eines Bereichs in Katalog-Reihenfolge. */
export function hacksIn(area: EnergyArea): Hack[] {
  return HACKS.filter((h) => h.area === area)
}

/** Ein Zyklus der Atemkurve mit aufgelösten Gruppen; leer, wenn der Hack kein Takt-Hack ist. */
export function taktPhases(h: Hack): TaktPhaseDef[] {
  if (h.guide !== 'takt' || !h.cycle) return []
  return h.cycle.flatMap((entry) =>
    'repeat' in entry ? Array.from({ length: entry.repeat }, () => entry.phases).flat() : [entry],
  )
}

function cycleSeconds(phases: readonly TaktPhaseDef[]): number {
  return phases.reduce((sum, p) => sum + p.seconds, 0)
}

/** Ganze Zyklen, die der Nenndauer am nächsten kommen, mindestens einer. */
function taktRounds(h: Hack, cycle: number): number {
  return Math.max(1, Math.round((h.minutes * 60) / cycle))
}

/** Laufzeit in Sekunden: bei „takt“ ganze Zyklen, sonst die Nenndauer. */
export function hackLength(h: Hack): number {
  if (h.guide === 'takt') {
    const cycle = cycleSeconds(taktPhases(h))
    return taktRounds(h, cycle) * cycle
  }
  return h.minutes * 60
}

/**
 * Pegel der Atemkurve je Phase, 0 (leer) bis 1 (voll): „ein“ endet bei 0,8, wenn „nach“ folgt, sonst bei 1;
 * „nach“ endet bei 1, „aus“ bei 0, „halten“ behält den Pegel. Der Zyklus beginnt bei 0.
 */
export function taktShape(h: Hack): { phase: TaktPhase; seconds: number; from: number; to: number }[] {
  const phases = taktPhases(h)
  let level = 0
  return phases.map((p, i) => {
    const from = level
    if (p.phase === 'ein') level = phases[i + 1]?.phase === 'nach' ? BEFORE_TOP_UP : 1
    else if (p.phase === 'nach') level = 1
    else if (p.phase === 'aus') level = 0
    return { phase: p.phase, seconds: p.seconds, from, to: level }
  })
}

/**
 * Stand eines Takt-Hacks zur Zeit `elapsed`: Phase, Anweisung, Runde (ab 1), Fortschritt im Zyklus (0…1) und Pegel
 * mit weichem Übergang (0,5 − cos(π·t)/2). Eine Zeit genau auf der Grenze gehört zur nächsten Phase; ab dem Ende
 * steht der Hack am Schluss der letzten Phase.
 */
export function taktAt(h: Hack, elapsed: number): { phase: TaktPhase; say: string; round: number; rounds: number; cycleProgress: number; level: number } {
  const phases = taktPhases(h)
  if (phases.length === 0) throw new Error(`Kein Takt-Hack: ${h.id}`)
  const shape = taktShape(h)
  const cycle = cycleSeconds(phases)
  const rounds = taktRounds(h, cycle)
  // `elapsed > 0` fängt auch NaN ab; die Position im Zyklus per Modulo, damit sich keine Rundungsfehler anhäufen.
  const t = elapsed > 0 ? elapsed : 0
  const done = t >= rounds * cycle
  const round = done ? rounds : Math.floor(t / cycle) + 1
  const pos = done ? cycle : t % cycle
  let i = 0
  let start = 0
  for (; i < phases.length - 1; i++) {
    if (pos < start + phases[i].seconds) break
    start += phases[i].seconds
  }
  const progress = Math.min(1, (pos - start) / phases[i].seconds)
  const { from, to } = shape[i]
  return {
    phase: phases[i].phase,
    say: phases[i].say,
    round,
    rounds,
    cycleProgress: pos / cycle,
    level: from + (to - from) * (0.5 - Math.cos(Math.PI * progress) / 2),
  }
}

/**
 * Aktueller Schritt und seine Restzeit in Sekunden; nach dem Ende der letzte Schritt mit 0.
 * Ohne Zeit je Schritt („takt“, „ring“) gilt der ganze Hack als ein Schritt.
 */
export function stepAt(h: Hack, elapsed: number): { index: number; remaining: number } {
  const t = elapsed > 0 ? elapsed : 0
  if (h.guide !== 'schritte') return { index: 0, remaining: Math.max(0, hackLength(h) - t) }
  let end = 0
  for (let i = 0; i < h.steps.length; i++) {
    end += h.steps[i].seconds ?? 0
    if (t < end) return { index: i, remaining: end - t }
  }
  return { index: h.steps.length - 1, remaining: 0 }
}

/** Sekunden der Schrittwechsel ohne Start und Ende, für die Hinweistöne; nur bei „schritte“. */
export function stepBoundaries(h: Hack): number[] {
  if (h.guide !== 'schritte') return []
  const boundaries: number[] = []
  let at = 0
  for (const step of h.steps.slice(0, -1)) {
    at += step.seconds ?? 0
    boundaries.push(at)
  }
  return boundaries
}

/** Ohne Fenster immer; sonst wenn `from ≤ Stunde < to` (Ortszeit). */
export function inWindow(h: Hack, now: Date): boolean {
  if (!h.window) return true
  const hour = now.getHours()
  return h.window.from <= hour && hour < h.window.to
}
