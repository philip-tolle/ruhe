// Der Zustand des Morgen-Starts (`morningUi`): Schritte, Entwurf, Speichern am Ende und die Übergabe an die Player.
// Die Player selbst (`session-ui`) und die Klangschale sind ersetzt: Der Test prüft, was der Ablauf auslöst, nicht Audio.
import { beforeEach, expect, test, vi } from 'vitest'

vi.mock('../../src/lib/ui/session-ui.svelte', () => ({
  sessionUi: { done: null },
  startHack: vi.fn(),
  startGuidedSession: vi.fn(),
  clearDone: vi.fn(),
}))
vi.mock('../../src/lib/audio/chime', () => ({ playChime: vi.fn() }))

import { playChime } from '../../src/lib/audio/chime'
import type { ProgramSnapshot } from '../../src/lib/audio/engine'
import { audio } from '../../src/lib/audio/engine-store.svelte'
import { meditationById } from '../../src/lib/content/catalog'
import { exerciseOfDay } from '../../src/lib/morning/logic'
import { MORNING_EXERCISES } from '../../src/lib/morning/words'
import { emptyData, type ResultKind } from '../../src/lib/stats/schema'
import { stats } from '../../src/lib/stats/store.svelte'
import {
  closeMorning,
  morningContinueAfterHack,
  morningHidden,
  morningPlayerClosed,
  morningSessionEnded,
  morningUi,
  nextStep,
  openMorning,
  skipStep,
  startExercise,
  startMorningMeditation,
  swapExercise,
} from '../../src/lib/ui/morning-ui.svelte'
import { clearDone, sessionUi, startGuidedSession, startHack, type SessionDoneInfo } from '../../src/lib/ui/session-ui.svelte'
import { appNow } from '../../src/lib/ui/tageszeit.svelte'

beforeEach(() => {
  localStorage.clear()
  stats.data = emptyData()
  stats.saveFailed = false
  vi.clearAllMocks()
  closeMorning()
  sessionUi.done = null
})

// Erfundene Eingaben, nur für den Test.
const FILLED = { intention: '  gelassen ', gratitude: ' ein ruhiger Kaffee  ', value: ' Geduld ', domino: '  Kapitel 3 abgeben ' }

function fillDraft(): void {
  Object.assign(morningUi.draft, FILLED)
}

/** Schaltet `count`-mal weiter, mit `nextStep` oder `skipStep`. */
function walk(advance: () => void, count: number): void {
  for (let i = 0; i < count; i++) advance()
}

test('openMorning setzt den Ablauf zurück: Schritt Check-in, Übung des Tages, leerer Entwurf', () => {
  // Zustand eines früheren Durchgangs, der alles belegt.
  morningUi.step = 'abschluss'
  morningUi.exercise = 'wach-klopfen'
  morningUi.checkin = { koerper: 1, gefuehl: 2, geist: 3, sinn: 4 }
  morningUi.awaiting = 'guided'
  morningUi.confirming = true
  fillDraft()

  openMorning('kurz')

  expect(morningUi).toEqual({
    open: true,
    variant: 'kurz',
    step: 'checkin',
    exercise: exerciseOfDay(appNow()),
    checkin: null,
    draft: { intention: '', gratitude: '', value: '', domino: '' },
    awaiting: null,
    confirming: false,
  })
  openMorning('lang')
  expect(morningUi.variant).toBe('lang')
})

test('nextStep geht durch die Folge; nach „Big Domino“ speichert es genau einen Eintrag und läutet die Klangschale', () => {
  openMorning('kurz')
  fillDraft()
  const order: string[] = [morningUi.step]
  for (let i = 0; i < 5; i++) {
    nextStep()
    order.push(morningUi.step)
    // Bis zum Abschluss ist noch nichts gespeichert, und es läutet nichts.
    if (morningUi.step !== 'abschluss') {
      expect(stats.data.mornings).toBeUndefined()
      expect(playChime).not.toHaveBeenCalled()
    }
  }
  expect(order).toEqual(['checkin', 'aktivieren', 'intention', 'dankbarkeit', 'domino', 'abschluss'])
  expect(stats.data.mornings).toHaveLength(1)
  // Getrimmt; der Wert gehört nur zum langen Ablauf.
  expect(stats.data.mornings![0]).toMatchObject({ variant: 'kurz', intention: 'gelassen', gratitude: 'ein ruhiger Kaffee', domino: 'Kapitel 3 abgeben' })
  expect(stats.data.mornings![0]).not.toHaveProperty('value')
  expect(playChime).toHaveBeenCalledTimes(1)
  // Der Morgen-Start ist keine Sitzung.
  expect(stats.data.sessions).toEqual([])
})

test('der lange Ablauf geht über „Vertiefen“ und speichert auch den Wert; leere Felder entfallen', () => {
  openMorning('lang')
  Object.assign(morningUi.draft, { intention: '   ', gratitude: '', value: ' Mut ', domino: '' })
  const order: string[] = [morningUi.step]
  for (let i = 0; i < 6; i++) {
    nextStep()
    order.push(morningUi.step)
  }
  expect(order).toEqual(['checkin', 'aktivieren', 'vertiefen', 'intention', 'dankbarkeit', 'domino', 'abschluss'])
  expect(stats.data.mornings).toHaveLength(1)
  const entry = stats.data.mornings![0]
  expect(entry).toMatchObject({ variant: 'lang', value: 'Mut' })
  for (const key of ['intention', 'gratitude', 'domino', 'dominoDone']) expect(entry).not.toHaveProperty(key)
})

test('im Abschluss tut nextStep nichts mehr: ein zweiter Tipp speichert nicht noch einmal und läutet nicht erneut', () => {
  openMorning('kurz')
  walk(nextStep, 5)
  expect(morningUi.step).toBe('abschluss')
  const saved = JSON.stringify(stats.data.mornings)
  nextStep()
  nextStep()
  expect(morningUi.step).toBe('abschluss')
  expect(JSON.stringify(stats.data.mornings)).toBe(saved)
  expect(playChime).toHaveBeenCalledTimes(1)
})

test('bei geschlossenem Ablauf tut nextStep nichts', () => {
  morningUi.step = 'domino'
  nextStep()
  expect(morningUi.step).toBe('domino')
  expect(stats.data.mornings).toBeUndefined()
  expect(playChime).not.toHaveBeenCalled()
})

test('skipStep überall bis zum Abschluss ergibt einen Eintrag nur mit der Variante', () => {
  for (const variant of ['kurz', 'lang'] as const) {
    stats.data = emptyData()
    openMorning(variant)
    // Der Entwurf ist voll belegt; jedes Überspringen lässt die Angaben seines Schritts liegen.
    fillDraft()
    walk(skipStep, variant === 'kurz' ? 5 : 6)
    expect(morningUi.step).toBe('abschluss')
    expect(stats.data.mornings).toHaveLength(1)
    expect(Object.keys(stats.data.mornings![0]).sort()).toEqual(['at', 'day', 'variant'])
    expect(stats.data.mornings![0].variant).toBe(variant)
  }
})

test('skipStep nimmt nur die Eingaben des eigenen Schritts nicht mit', () => {
  openMorning('lang')
  fillDraft()
  morningUi.step = 'intention'
  skipStep()
  expect(morningUi.step).toBe('dankbarkeit')
  expect(morningUi.draft).toEqual({ ...FILLED, intention: '' })
  // „Dankbarkeit“ trägt auch den Wert.
  skipStep()
  expect(morningUi.step).toBe('domino')
  expect(morningUi.draft).toEqual({ intention: '', gratitude: '', value: '', domino: FILLED.domino })
  // Überspringen von „Big Domino“ erreicht den Abschluss und speichert den Eintrag.
  skipStep()
  expect(morningUi.step).toBe('abschluss')
  expect(stats.data.mornings).toHaveLength(1)
  expect(stats.data.mornings![0]).not.toHaveProperty('domino')
  expect(playChime).toHaveBeenCalledTimes(1)
})

test('skipStep auf dem Check-in speichert keinen Check-in und lässt den Check-in-Zustand leer', () => {
  openMorning('kurz')
  skipStep()
  expect(morningUi.step).toBe('aktivieren')
  expect(morningUi.checkin).toBeNull()
  expect(stats.data.energyCheckins).toBeUndefined()
})

test('swapExercise dreimal kehrt zur ersten Übung zurück und durchläuft alle drei', () => {
  openMorning('kurz')
  const first = morningUi.exercise
  const seen = [first]
  for (let i = 0; i < 3; i++) {
    swapExercise()
    seen.push(morningUi.exercise)
  }
  expect(seen[3]).toBe(first)
  expect(new Set(seen.slice(0, 3))).toEqual(new Set(MORNING_EXERCISES))
})

test('closeMorning schließt den Ablauf, ohne etwas zu speichern, und löscht Warten und Rückfrage', () => {
  openMorning('kurz')
  fillDraft()
  morningUi.step = 'domino'
  morningUi.awaiting = 'hack'
  morningUi.confirming = true
  closeMorning()
  expect(morningUi).toMatchObject({ open: false, awaiting: null, confirming: false })
  expect(stats.data.mornings).toBeUndefined()
  expect(playChime).not.toHaveBeenCalled()
})

test('startExercise merkt sich das Warten, bevor der Hack-Player startet (beides im selben Tipp)', () => {
  openMorning('kurz')
  vi.mocked(startHack).mockImplementation(() => {
    // Beim Start des Players steht das Warten schon.
    expect(morningUi.awaiting).toBe('hack')
  })
  startExercise('strecken')
  expect(startHack).toHaveBeenCalledExactlyOnceWith('strecken')
  expect(morningUi.awaiting).toBe('hack')
})

test('startExercise mit unbekannter Kennung startet nichts und lässt den Ablauf nicht im Warten stehen', () => {
  openMorning('kurz')
  startExercise('gibt-es-nicht')
  expect(startHack).not.toHaveBeenCalled()
  expect(morningUi.awaiting).toBeNull()
})

test('startMorningMeditation merkt sich das Warten und startet „Guten Morgen“ im geführten Player', () => {
  openMorning('lang')
  vi.mocked(startGuidedSession).mockImplementation(() => {
    expect(morningUi.awaiting).toBe('guided')
  })
  startMorningMeditation()
  expect(startGuidedSession).toHaveBeenCalledExactlyOnceWith(meditationById('guten-morgen'))
  expect(morningUi.awaiting).toBe('guided')
})

test('morningSessionEnded: Meditation im Ablauf übernimmt das Ende, zählt oder nicht, und geht einen Schritt weiter', () => {
  for (const counted of [true, false]) {
    openMorning('lang')
    morningUi.step = 'vertiefen'
    morningUi.awaiting = 'guided'
    vi.mocked(clearDone).mockClear()
    expect(morningSessionEnded('guided', counted)).toBe(true)
    expect(morningUi.step).toBe('intention')
    expect(morningUi.awaiting).toBeNull()
    expect(morningUi.open).toBe(true)
    // Ein Abschluss-Bildschirm der Meditation darf nicht stehen bleiben.
    expect(clearDone).toHaveBeenCalledTimes(1)
  }
})

test('morningSessionEnded: ein Hack, der nicht zählt, beendet das Warten; der Ablauf bleibt beim Schritt', () => {
  openMorning('kurz')
  morningUi.step = 'aktivieren'
  morningUi.awaiting = 'hack'
  expect(morningSessionEnded('hack', false)).toBe(false)
  expect(morningUi.step).toBe('aktivieren')
  expect(morningUi.awaiting).toBeNull()
})

test('morningSessionEnded: ein Hack, der zählt, lässt das Warten stehen; „Weiter“ im Hack-Ende geht dann einen Schritt weiter', () => {
  openMorning('kurz')
  morningUi.step = 'aktivieren'
  morningUi.awaiting = 'hack'
  expect(morningSessionEnded('hack', true)).toBe(false)
  expect(morningUi.step).toBe('aktivieren')
  expect(morningUi.awaiting).toBe('hack')

  morningContinueAfterHack()
  expect(clearDone).toHaveBeenCalledTimes(1)
  expect(morningUi.awaiting).toBeNull()
  expect(morningUi.step).toBe('intention')
})

test('morningSessionEnded: eine andere Art als die erwartete ändert nichts', () => {
  openMorning('lang')
  morningUi.step = 'aktivieren'
  morningUi.awaiting = 'hack'
  expect(morningSessionEnded('guided', true)).toBe(false)
  expect(morningUi).toMatchObject({ step: 'aktivieren', awaiting: 'hack' })

  morningUi.step = 'vertiefen'
  morningUi.awaiting = 'guided'
  expect(morningSessionEnded('hack', false)).toBe(false)
  expect(morningSessionEnded('focus', true)).toBe(false)
  expect(morningUi).toMatchObject({ step: 'vertiefen', awaiting: 'guided' })

  // Wartet der Ablauf auf nichts, sind alle Arten Sache der Player.
  morningUi.awaiting = null
  expect(morningSessionEnded('guided', true)).toBe(false)
  expect(morningUi.step).toBe('vertiefen')
})

test('morningSessionEnded ohne offenen Ablauf gibt für jede Art false und ändert nichts', () => {
  const kinds: ResultKind[] = ['timer', 'breath', 'guided', 'hack', 'focus']
  for (const kind of kinds) {
    for (const counted of [true, false]) {
      // Ein Rest des Wartens bei geschlossenem Ablauf darf nichts auslösen.
      morningUi.open = false
      morningUi.step = 'aktivieren'
      morningUi.awaiting = kind === 'guided' ? 'guided' : 'hack'
      expect(morningSessionEnded(kind, counted)).toBe(false)
      expect(morningUi.step).toBe('aktivieren')
    }
  }
  expect(stats.data.mornings).toBeUndefined()
})

// ── Der Player, auf den der Ablauf wartet, ist zu (Zurück-Geste, Escape, gescheiterter Start) ───────────────────────

test('ein Hack hat gezählt und seine Ende-Ansicht wird ohne „Weiter“ geschlossen: der Ablauf geht weiter, wie bei „Weiter“', () => {
  openMorning('kurz')
  morningUi.step = 'aktivieren'
  startExercise('strecken')
  expect(morningSessionEnded('hack', true)).toBe(false)
  expect(morningUi).toMatchObject({ step: 'aktivieren', awaiting: 'hack' })
  // `PlayerShell` hat den Abschluss selbst geschlossen (`clearDone`); der Ablauf ruft es nicht noch einmal.
  vi.mocked(clearDone).mockClear()

  morningPlayerClosed()
  expect(morningUi.step).toBe('intention')
  expect(morningUi.awaiting).toBeNull()
  expect(clearDone).not.toHaveBeenCalled()
  // Noch nichts gespeichert, kein Abschluss; ein zweiter Aufruf rückt nicht noch einen Schritt vor.
  expect(stats.data.mornings).toBeUndefined()
  expect(playChime).not.toHaveBeenCalled()
  morningPlayerClosed()
  expect(morningUi.step).toBe('intention')
})

test('ein Hack, der nicht zählt, oder gar kein Ende: der Ablauf bleibt beim Schritt, das Warten endet', () => {
  openMorning('lang')
  morningUi.step = 'aktivieren'
  startExercise('strecken')
  expect(morningSessionEnded('hack', false)).toBe(false)
  expect(morningUi.awaiting).toBeNull()
  morningPlayerClosed()
  expect(morningUi).toMatchObject({ step: 'aktivieren', awaiting: null })

  // Der Start kam nie bis zu einem Player: kein Ende gemeldet.
  startExercise('strecken')
  expect(morningUi.awaiting).toBe('hack')
  morningPlayerClosed()
  expect(morningUi).toMatchObject({ step: 'aktivieren', awaiting: null })

  // Dasselbe bei der Meditation.
  morningUi.step = 'vertiefen'
  startMorningMeditation()
  morningPlayerClosed()
  expect(morningUi).toMatchObject({ step: 'vertiefen', awaiting: null })
})

test('bei geschlossenem Ablauf oder ohne Warten tut morningPlayerClosed nichts', () => {
  openMorning('kurz')
  morningUi.step = 'aktivieren'
  morningPlayerClosed() // ohne Warten
  expect(morningUi).toMatchObject({ open: true, step: 'aktivieren', awaiting: null })

  startExercise('strecken')
  morningSessionEnded('hack', true)
  closeMorning()
  morningPlayerClosed() // geschlossen
  expect(morningUi).toMatchObject({ open: false, step: 'aktivieren', awaiting: null })

  // Auch ein Rest des Wartens bei geschlossenem Ablauf löst nichts aus.
  morningUi.awaiting = 'hack'
  morningPlayerClosed()
  expect(morningUi).toMatchObject({ open: false, step: 'aktivieren', awaiting: 'hack' })
  expect(stats.data.mornings).toBeUndefined()
})

test('nach „Weiter“ rückt morningPlayerClosed nicht noch einmal vor: genau ein Schritt', () => {
  openMorning('kurz')
  morningUi.step = 'aktivieren'
  startExercise('strecken')
  morningSessionEnded('hack', true)
  morningContinueAfterHack()
  expect(morningUi.step).toBe('intention')
  // Der `$effect` der Oberfläche läuft danach, wenn der Player zu ist.
  morningPlayerClosed()
  expect(morningUi.step).toBe('intention')
})

test('ein neuer Start und jedes Zurücksetzen vergessen, dass der letzte Hack gezählt hat', () => {
  openMorning('kurz')
  morningUi.step = 'aktivieren'
  startExercise('strecken')
  morningSessionEnded('hack', true)
  // Ein neuer Start (hier eine andere Übung): Er hat noch nicht gezählt.
  swapExercise()
  startExercise('wasser-licht')
  morningPlayerClosed()
  expect(morningUi.step).toBe('aktivieren')

  // Beenden und neu Öffnen: der Rest des alten Ablaufs gilt nicht.
  startExercise('strecken')
  morningSessionEnded('hack', true)
  closeMorning()
  openMorning('kurz')
  morningUi.step = 'aktivieren'
  morningUi.awaiting = 'hack'
  morningPlayerClosed()
  expect(morningUi.step).toBe('aktivieren')
})

test('morningContinueAfterHack tut nichts, solange der Ablauf nicht auf einen Hack wartet oder geschlossen ist', () => {
  openMorning('kurz')
  morningUi.step = 'aktivieren'
  morningContinueAfterHack() // wartet auf nichts
  expect(morningUi.step).toBe('aktivieren')

  morningUi.awaiting = 'guided'
  morningContinueAfterHack() // wartet auf die Meditation
  expect(morningUi).toMatchObject({ step: 'aktivieren', awaiting: 'guided' })

  morningUi.awaiting = 'hack'
  closeMorning()
  morningUi.awaiting = 'hack' // Rest bei geschlossenem Ablauf
  morningContinueAfterHack()
  expect(morningUi).toMatchObject({ open: false, step: 'aktivieren', awaiting: 'hack' })
  expect(clearDone).not.toHaveBeenCalled()
})

test('morningHidden: der Ablauf ist nur verborgen, wenn er wartet und der Player offen ist', () => {
  const done = (kind: 'hack' | 'guided'): SessionDoneInfo => ({ kind, ref: 'x', seconds: 64, counted: true, sessionId: 's-1' })
  const program = (kind: ProgramSnapshot['kind']) => ({ kind, ref: 'x', ended: false }) as ProgramSnapshot
  const before = audio.snap
  try {
    openMorning('lang')
    // Er wartet auf nichts: nie verborgen, auch wenn ein Player offen ist.
    sessionUi.done = done('hack')
    expect(morningHidden()).toBe(false)
    sessionUi.done = null

    morningUi.awaiting = 'hack'
    expect(morningHidden()).toBe(false) // kein Player offen
    sessionUi.done = done('hack') // Ende-Ansicht des Hacks
    expect(morningHidden()).toBe(true)
    sessionUi.done = null
    audio.snap = { ...before, program: program('hack') } // Laufansicht des Hacks
    expect(morningHidden()).toBe(true)
    audio.snap = { ...before, program: program('timer') } // ein fremder Player ändert nichts
    expect(morningHidden()).toBe(false)

    morningUi.awaiting = 'guided'
    audio.snap = { ...before, program: program('guided') }
    expect(morningHidden()).toBe(true)
    audio.snap = before
    expect(morningHidden()).toBe(false)
  } finally {
    audio.snap = before
  }
})
