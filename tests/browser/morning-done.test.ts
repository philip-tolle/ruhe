// Der Abschluss des Morgen-Starts (MorningDone): Er zeigt den Eintrag, den der Ablauf beim Speichern angelegt hat, und
// hält ihn fest, auch wenn die Uhr danach über Mitternacht geht. „Fokus-Sprint starten“ steht nur, wenn es ein Big Domino
// gibt, das noch nicht erledigt ist. Liegt unter browser/, weil die Komponente einen Svelte-Compiler und die Runen der
// Oberfläche braucht; die Engine ist gemockt. Alle Texte sind ausgedachte Testdaten.
import { afterEach, beforeEach, expect, test, vi, type MockInstance } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import MorningDone from '../../src/components/morning/MorningDone.svelte'
import { engine } from '../../src/lib/audio/engine'
import { emptyData, type MorningEntry } from '../../src/lib/stats/schema'
import { stats } from '../../src/lib/stats/store.svelte'
import { closeMorning, morningUi, nextStep, openMorning } from '../../src/lib/ui/morning-ui.svelte'
import { tageszeitUi } from '../../src/lib/ui/tageszeit.svelte'

// Ohne Klangschale: Der Abschluss läutet sie beim Erreichen, das Audio gehört nicht in diesen Test.
vi.mock('../../src/lib/audio/chime', () => ({ playChime: vi.fn() }))

let startProgram: MockInstance<typeof engine.startProgram>
let target: HTMLElement | null = null
let instance: ReturnType<typeof mount> | null = null

beforeEach(() => {
  localStorage.clear()
  stats.data = emptyData()
  stats.saveFailed = false
  startProgram = vi.spyOn(engine, 'startProgram').mockResolvedValue(undefined)
  closeMorning()
})

afterEach(() => {
  if (instance) void unmount(instance)
  target?.remove()
  instance = null
  target = null
  startProgram.mockRestore()
  vi.useRealTimers()
  tageszeitUi.now = Date.now()
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Stellt die Uhr des Tests (nur `Date`, die Timer laufen echt) und die Minuten-Uhr der App auf `at`. */
function setClock(at: Date): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(at)
  tageszeitUi.now = at.getTime()
}

/** Zeigt den Abschluss mit dem Eintrag `entry` (so, wie `nextStep` ihn im Zustand ablegt). */
function show(entry: MorningEntry | null): void {
  openMorning('kurz')
  morningUi.step = 'abschluss'
  morningUi.entry = entry
  target = document.createElement('div')
  document.body.append(target)
  instance = mount(MorningDone, { target })
  flushSync()
}

const entry = (rest: Partial<MorningEntry> = {}): MorningEntry => ({ day: '2026-10-28', at: '2026-10-28T06:10:00.000Z', variant: 'kurz', ...rest })
const buttons = () => [...target!.querySelectorAll('button')].map((b) => b.textContent!.trim())
const items = () => [...target!.querySelectorAll('dd')].map((d) => d.textContent!.trim())
const text = () => target!.textContent!.replace(/\s+/g, ' ')

test('it shows the saved entry with the sprint button and "Fertig"', () => {
  setClock(new Date(2026, 9, 28, 7, 30))
  show(entry({ intention: 'klar', domino: 'Konzept skizzieren', gratitude: 'ein ruhiger Kaffee' }))
  expect(items()).toEqual(['klar', 'Konzept skizzieren', 'ein ruhiger Kaffee'])
  expect(buttons()).toEqual(['Fokus-Sprint starten · 50 Min', 'Fertig'])
})

test('past midnight the summary keeps its entry and the sprint button', () => {
  setClock(new Date(2026, 9, 28, 23, 58))
  // Der Weg des Ablaufs selbst: Eintrag speichern, im Zustand festhalten, Abschluss zeigen.
  openMorning('kurz')
  Object.assign(morningUi.draft, { intention: 'klar', gratitude: 'ein ruhiger Kaffee', domino: 'Konzept skizzieren' })
  for (let i = 0; i < 5; i++) nextStep()
  expect(morningUi.step).toBe('abschluss')
  target = document.createElement('div')
  document.body.append(target)
  instance = mount(MorningDone, { target })
  flushSync()
  expect(items()).toEqual(['klar', 'Konzept skizzieren', 'ein ruhiger Kaffee'])

  // Die App blieb im Speicher: Die Minuten-Uhr rückt über Mitternacht.
  setClock(new Date(2026, 9, 29, 0, 2))
  flushSync()
  expect(items()).toEqual(['klar', 'Konzept skizzieren', 'ein ruhiger Kaffee'])
  expect(text()).not.toContain('Morgen-Start erledigt.')
  expect(buttons()).toEqual(['Fokus-Sprint starten · 50 Min', 'Fertig'])
})

test('the sprint button starts the sprint with the big domino and closes the flow', async () => {
  setClock(new Date(2026, 9, 28, 7, 30))
  show(entry({ domino: 'Konzept skizzieren' }))
  await wait(450) // die Sperre gegen den Doppeltipp (siehe `tapArming`)
  flushSync()
  const sprint = [...target!.querySelectorAll('button')].find((b) => b.textContent!.trim().startsWith('Fokus-Sprint starten'))!
  sprint.click()
  expect(morningUi.open).toBe(false)
  expect(startProgram).toHaveBeenCalledTimes(1)
  expect(startProgram.mock.calls[0][0].note).toBe('Konzept skizzieren')
})

test('with the big domino already done there is no sprint button, only "Fertig"', () => {
  setClock(new Date(2026, 9, 28, 7, 30))
  show(entry({ intention: 'klar', domino: 'Konzept skizzieren', dominoDone: '2026-10-28T06:00:00.000Z' }))
  expect(items()).toEqual(['klar', 'Konzept skizzieren'])
  expect(buttons()).toEqual(['Fertig'])
})

test('without a big domino there is no sprint button either', () => {
  setClock(new Date(2026, 9, 28, 7, 30))
  show(entry({ intention: 'klar' }))
  expect(buttons()).toEqual(['Fertig'])
})

test('an entry with nothing in it says it is done', () => {
  setClock(new Date(2026, 9, 28, 7, 30))
  show(entry())
  expect(text()).toContain('Morgen-Start erledigt.')
  expect(items()).toEqual([])
  expect(buttons()).toEqual(['Fertig'])
})
