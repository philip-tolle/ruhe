// Start der Energie-Programme aus der Oberfläche (Brain Hack, Fokus-Sprint). Liegt unter browser/,
// weil session-ui.svelte.ts Runen und den Speicher der App braucht; die Engine ist gemockt.
import { afterEach, beforeEach, expect, test, vi, type MockInstance } from 'vitest'
import { engine } from '../../src/lib/audio/engine'
import { focusProgram, hackProgram, type ProgramSpec } from '../../src/lib/audio/program'
import { hackById } from '../../src/lib/energy/hacks'
import { emptyData } from '../../src/lib/stats/schema'
import { stats } from '../../src/lib/stats/store.svelte'
import { sessionUi, startHack, startSprint } from '../../src/lib/ui/session-ui.svelte'

let startProgram: MockInstance<typeof engine.startProgram>

beforeEach(() => {
  localStorage.clear()
  stats.data = emptyData()
  stats.saveFailed = false
  sessionUi.done = null
  startProgram = vi.spyOn(engine, 'startProgram').mockResolvedValue(undefined)
})

afterEach(() => {
  startProgram.mockRestore()
})

// Eine Spec ohne ihre `schedule`-Funktion (jede Spec hat eine eigene) zum Vergleichen.
const plain = ({ schedule, ...rest }: ProgramSpec) => rest

test('startSprint remembers the choice and starts the sprint program', () => {
  startSprint(90, 'Konzept', null)
  expect(stats.data.settings.focus).toEqual({ minutes: 90, sound: null })
  expect(startProgram).toHaveBeenCalledTimes(1)
  const spec = startProgram.mock.calls[0][0]
  expect(plain(spec)).toEqual(plain(focusProgram(90, null, 'Konzept')))
  expect(spec.note).toBe('Konzept')
  expect(typeof spec.schedule).toBe('function')
  expect(JSON.parse(localStorage.getItem('ruhe.v1')!).settings.focus).toEqual({ minutes: 90, sound: null })
})

test('startSprint with a background sound stores it and leaves the other settings alone', () => {
  const before = stats.data.settings
  startSprint(25, '', 'regen')
  expect(stats.data.settings).toEqual({ ...before, focus: { minutes: 25, sound: 'regen' } })
  expect(plain(startProgram.mock.calls[0][0])).toEqual(plain(focusProgram(25, 'regen', '')))
})

test('starting a sprint clears an open done view of the previous session', () => {
  sessionUi.done = { kind: 'timer', ref: 'timer', seconds: 600, counted: true, sessionId: 'x' }
  startSprint(50, 'X', null)
  expect(sessionUi.done).toBeNull()
})

test('startHack starts the program of that hack without touching last used or settings', () => {
  const before = stats.data
  startHack('bewegungs-snack')
  expect(startProgram).toHaveBeenCalledTimes(1)
  expect(plain(startProgram.mock.calls[0][0])).toEqual(plain(hackProgram(hackById('bewegungs-snack')!)))
  expect(stats.data).toBe(before)             // kein setLastUsed, keine Einstellung
  expect(stats.data.lastUsed).toBeUndefined()
})

test('starting a hack clears an open done view of the previous session', () => {
  sessionUi.done = { kind: 'hack', ref: 'seufzer', seconds: 64, counted: true, sessionId: 'x' }
  startHack('kaltes-gesicht')
  expect(sessionUi.done).toBeNull()
})

test('startHack with an unknown id does nothing', () => {
  const done = { kind: 'timer' as const, ref: 'timer', seconds: 600, counted: true, sessionId: 'x' }
  sessionUi.done = done
  startHack('gibt-es-nicht')
  expect(startProgram).not.toHaveBeenCalled()
  expect(sessionUi.done).toEqual(done)         // unberührt (das Objekt selbst ist ein Rune-Proxy)
})
