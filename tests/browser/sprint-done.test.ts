// Das Ende eines Fokus-Sprints (SprintDone): „Sprint geschafft“ mit der tatsächlichen Zeit, der Pausen-Vorschlag mit
// „Starten“, „Check-in“ und „Fertig“. Liegt unter browser/, weil die Komponente einen Svelte-Compiler und die Runen der
// Oberfläche braucht; die Engine ist gemockt. Die Pause selbst (ein Hack-Lauf) prüft der Test hier statt in Playwright:
// Ein dritter 5-Minuten-Sprint im Browser wäre zu teuer.
import { afterEach, beforeEach, expect, test, vi, type MockInstance } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SprintDone from '../../src/components/player/SprintDone.svelte'
import { engine } from '../../src/lib/audio/engine'
import { hackProgram, type ProgramSpec } from '../../src/lib/audio/program'
import { hackById } from '../../src/lib/energy/hacks'
import { emptyData } from '../../src/lib/stats/schema'
import { stats } from '../../src/lib/stats/store.svelte'
import { energyUi } from '../../src/lib/ui/energy-ui.svelte'
import { sessionUi, type SessionDoneInfo } from '../../src/lib/ui/session-ui.svelte'

let startProgram: MockInstance<typeof engine.startProgram>
let target: HTMLElement | null = null
let instance: ReturnType<typeof mount> | null = null

beforeEach(() => {
  localStorage.clear()
  stats.data = emptyData()
  stats.saveFailed = false
  sessionUi.done = null
  energyUi.checkInOpen = false
  startProgram = vi.spyOn(engine, 'startProgram').mockResolvedValue(undefined)
})

afterEach(() => {
  if (instance) void unmount(instance)
  target?.remove()
  instance = null
  target = null
  startProgram.mockRestore()
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Eine Spec ohne ihre `schedule`-Funktion (jede Spec hat eine eigene) zum Vergleichen.
const plain = ({ schedule, ...rest }: ProgramSpec) => rest

/** Zeigt das Ende eines Sprints mit dem Stand wie nach einem Sprint von `planned` Minuten und `seconds` Sekunden. */
function show(planned: 25 | 50 | 90, seconds = 1500): SessionDoneInfo {
  const done: SessionDoneInfo = { kind: 'focus', ref: `focus-${planned}`, seconds, counted: true, sessionId: 's-1' }
  sessionUi.done = done
  target = document.createElement('div')
  document.body.append(target)
  instance = mount(SprintDone, { target, props: { done } })
  flushSync()
  return done
}

const button = (name: string) => [...target!.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)!
const text = () => target!.textContent!.replace(/\s+/g, ' ')

test('it says what was done and suggests the eye break after a 25 minute sprint without a check-in', () => {
  show(25, 1500)
  expect(target!.querySelector('h2')!.textContent).toBe('Sprint geschafft')
  expect(text()).toContain('25 Min Fokus')
  expect(text()).toContain('Pausen-Vorschlag')
  expect(text()).toContain('Augen-Pause')
  expect(text()).toContain('Geist · 2 Min')
  expect(button('Starten')).toBeTruthy()
  expect(button('Check-in')).toBeTruthy()
  expect(button('Fertig')).toBeTruthy()
})

test('the minutes are the real time, rounded down', () => {
  show(50, 305)
  expect(text()).toContain('5 Min Fokus')
  expect(text()).not.toContain('50 Min Fokus')
})

test('after 50 or 90 minutes it suggests the movement snack', () => {
  show(90, 5400)
  expect(text()).toContain('90 Min Fokus')
  expect(text()).toContain('Bewegungs-Snack')
  expect(text()).toContain('Körper · 2 Min')
})

test('the heading takes the focus, the decorative parts stay hidden from assistive technology', () => {
  show(25)
  const heading = target!.querySelector('h2')!
  expect(document.activeElement).toBe(heading)
  for (const img of target!.querySelectorAll('img')) expect(img.getAttribute('alt')).toBe('')
})

test('the buttons take taps only a moment after the view appears', async () => {
  show(25)
  for (const name of ['Starten', 'Check-in', 'Fertig']) expect(button(name).disabled, name).toBe(true)
  await wait(550)
  for (const name of ['Starten', 'Check-in', 'Fertig']) expect(button(name).disabled, name).toBe(false)
})

test('"Starten" closes the end view and starts the suggested break as a hack', async () => {
  show(25)
  await wait(550)
  button('Starten').click()
  expect(sessionUi.done).toBeNull()
  expect(startProgram).toHaveBeenCalledTimes(1)
  expect(plain(startProgram.mock.calls[0][0])).toEqual(plain(hackProgram(hackById('augen-pause')!)))
  expect(energyUi.checkInOpen).toBe(false)
})

test('"Check-in" closes the end view and opens the check-in sheet, without starting anything', async () => {
  show(25)
  await wait(550)
  button('Check-in').click()
  expect(sessionUi.done).toBeNull()
  expect(energyUi.checkInOpen).toBe(true)
  expect(startProgram).not.toHaveBeenCalled()
})

test('"Fertig" only closes the end view', async () => {
  show(25)
  await wait(550)
  button('Fertig').click()
  expect(sessionUi.done).toBeNull()
  expect(energyUi.checkInOpen).toBe(false)
  expect(startProgram).not.toHaveBeenCalled()
})

test('the suggestion stays while the view is open, even if a fresh check-in arrives', async () => {
  show(50)
  expect(text()).toContain('Bewegungs-Snack')
  // Ein frischer Check-in mit niedrigem Geist würde den Vorschlag auf einen Geist-Hack drehen (hier: Kopf leeren).
  stats.data = {
    ...stats.data,
    energyCheckins: [{ id: 'c-1', at: new Date().toISOString(), levels: { koerper: 5, gefuehl: 5, geist: 1, sinn: 5 } }],
  }
  flushSync()
  expect(text()).toContain('Bewegungs-Snack')
  expect(text()).not.toContain('Kopf leeren')
  await wait(550)
  button('Starten').click()
  expect(plain(startProgram.mock.calls[0][0])).toEqual(plain(hackProgram(hackById('bewegungs-snack')!)))
})
