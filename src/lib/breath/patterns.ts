// Atemmuster und Ablauf: reine Berechnung, ohne Audio-Zugriff.
// Zeiten sind Sekunden ab Übungsbeginn; die Audio-Engine plant damit auf der AudioContext-Uhr,
// die Anzeige liest mit breathAt() Phase, Countdown und Kreisgröße.

export type BreathPatternId = '478' | 'box' | 'kohaerent' | 'langes-ausatmen' | 'seufzer' | 'wechselatmung'
export type PhaseKind = 'ein' | 'halten' | 'aus'

export interface BreathPhase {
  kind: PhaseKind
  seconds: number
  /** Ersetzt `PHASE_LABEL[kind]` in der Anzeige. */
  label?: string
  /** Kreisgröße am Phasenende (0 klein … 1 groß). Standard: ein → 1, aus → 0, halten → unverändert. */
  level?: number
}

export interface BreathPattern {
  id: BreathPatternId
  title: string
  description: string
  /** Ein Zyklus: beginnt und endet bei Kreisgröße 0. */
  phases: readonly BreathPhase[]
}

export const BREATH_PATTERNS: readonly BreathPattern[] = [
  {
    id: '478',
    title: '4-7-8',
    description: 'Einatmen 4 s · Halten 7 s · Ausatmen 8 s',
    phases: [{ kind: 'ein', seconds: 4 }, { kind: 'halten', seconds: 7 }, { kind: 'aus', seconds: 8 }],
  },
  {
    id: 'box',
    title: 'Box-Atmung',
    description: 'Einatmen 4 s · Halten 4 s · Ausatmen 4 s · Halten 4 s',
    phases: [{ kind: 'ein', seconds: 4 }, { kind: 'halten', seconds: 4 }, { kind: 'aus', seconds: 4 }, { kind: 'halten', seconds: 4 }],
  },
  {
    id: 'kohaerent',
    title: 'Kohärentes Atmen',
    description: 'Einatmen 5,5 s · Ausatmen 5,5 s',
    phases: [{ kind: 'ein', seconds: 5.5 }, { kind: 'aus', seconds: 5.5 }],
  },
  {
    id: 'langes-ausatmen',
    title: 'Langes Ausatmen',
    description: 'Einatmen 4 s · Ausatmen 6 s',
    phases: [{ kind: 'ein', seconds: 4 }, { kind: 'aus', seconds: 6 }],
  },
  {
    id: 'seufzer',
    title: 'Physiologischer Seufzer',
    description: 'Einatmen 3 s · kurz Nachatmen 1 s · langsam Ausatmen 6 s',
    phases: [
      { kind: 'ein', seconds: 3, level: 0.8 },
      { kind: 'ein', seconds: 1, label: 'Nachatmen', level: 1 },
      { kind: 'aus', seconds: 6 },
    ],
  },
  {
    id: 'wechselatmung',
    title: 'Wechselatmung',
    description: 'Je 4 s: links ein · rechts aus · rechts ein · links aus. Das andere Nasenloch hältst du mit dem Finger zu.',
    phases: [
      { kind: 'ein', seconds: 4, label: 'Links einatmen' },
      { kind: 'aus', seconds: 4, label: 'Rechts ausatmen' },
      { kind: 'ein', seconds: 4, label: 'Rechts einatmen' },
      { kind: 'aus', seconds: 4, label: 'Links ausatmen' },
    ],
  },
]

/** Auswahl der Dauer in Minuten. */
export const BREATH_MINUTES: readonly number[] = [1, 3, 5, 10]

export const PHASE_LABEL: Record<PhaseKind, string> = { ein: 'Einatmen', halten: 'Halten', aus: 'Ausatmen' }

export function patternById(id: BreathPatternId): BreathPattern {
  const pattern = BREATH_PATTERNS.find(p => p.id === id)
  if (!pattern) throw new Error(`Unbekanntes Atemmuster: ${id}`)
  return pattern
}

/** Dauer eines Zyklus in Sekunden. */
function cycleSeconds(pattern: BreathPattern): number {
  return pattern.phases.reduce((sum, p) => sum + p.seconds, 0)
}

/** Kreisgröße am Ende der Phase; `from` ist der Stand zu Beginn der Phase. */
function levelAfter(phase: BreathPhase, from: number): number {
  if (phase.level !== undefined) return phase.level
  if (phase.kind === 'ein') return 1
  if (phase.kind === 'aus') return 0
  return from
}

export interface BreathPlan {
  /** Dauer eines Zyklus in Sekunden. */
  cycle: number
  cycles: number
  /** Gesamtdauer in Sekunden: ganze Zyklen. */
  length: number
  /** Beginn jeder Phase in Sekunden, aufsteigend. */
  cues: { at: number; kind: PhaseKind }[]
}

/** Plan für eine Dauer in Minuten. Der laufende Zyklus wird zu Ende geführt. */
export function breathPlan(id: BreathPatternId, minutes: number): BreathPlan {
  const pattern = patternById(id)
  const cycle = cycleSeconds(pattern)
  const cycles = Math.ceil((minutes * 60) / cycle)
  const cues: BreathPlan['cues'] = []
  for (let c = 0; c < cycles; c++) {
    let at = c * cycle
    for (const phase of pattern.phases) {
      cues.push({ at, kind: phase.kind })
      at += phase.seconds
    }
  }
  return { cycle, cycles, length: cycles * cycle, cues }
}

export interface BreathMoment {
  kind: PhaseKind
  label: string
  /** Kreisgröße von 0 (klein) bis 1 (groß), linear über die Phase. */
  level: number
  /** Kreisgröße am Beginn der Phase. */
  startLevel: number
  /** Kreisgröße am Ende der Phase. */
  endLevel: number
  phaseElapsed: number
  phaseLength: number
  /** Verbleibende ganze Sekunden der Phase, aufgerundet. */
  secondsLeft: number
  done: boolean
}

/**
 * Zustand zum Zeitpunkt `elapsed` einer Übung der Dauer `length`.
 * Vor dem Start gilt der Beginn der ersten Phase; ab `length` ist die Übung fertig.
 */
export function breathAt(id: BreathPatternId, elapsed: number, length: number): BreathMoment {
  const pattern = patternById(id)
  const { phases } = pattern
  const cycle = cycleSeconds(pattern)
  const done = elapsed >= length
  // Position im Zyklus per Modulo statt aufsummierter Phasen, damit sich Rundungsfehler nicht anhäufen.
  // `elapsed > 0` fängt auch NaN ab. Am Ende steht die Übung am Schluss der letzten Phase.
  const pos = done ? cycle : (elapsed > 0 ? elapsed : 0) % cycle
  let i = 0
  let start = 0
  let from = 0
  // Eine Zeit genau auf der Grenze gehört bereits zur nächsten Phase; die letzte Phase fängt den Rest.
  for (; i < phases.length - 1; i++) {
    const end = start + phases[i].seconds
    if (pos < end) break
    from = levelAfter(phases[i], from)
    start = end
  }
  const phase = phases[i]
  const phaseElapsed = Math.min(pos - start, phase.seconds)
  const to = levelAfter(phase, from)
  return {
    kind: phase.kind,
    label: phase.label ?? PHASE_LABEL[phase.kind],
    level: done ? 0 : from + (to - from) * (phaseElapsed / phase.seconds),
    startLevel: from,
    endLevel: to,
    phaseElapsed,
    phaseLength: phase.seconds,
    secondsLeft: Math.ceil(phase.seconds - phaseElapsed),
    done,
  }
}
