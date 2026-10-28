// Das Ende eines Hacks im Morgen-Start (HackEffect, Spec M10 §2.3): Wartet der Ablauf auf die Übung, steht statt „Fertig“
// und „Noch einmal“ ein „Weiter“, das den Ablauf zum nächsten Schritt führt. Außerhalb des Ablaufs bleibt alles wie in M9.
// Liegt unter browser/, weil die Komponente einen Svelte-Compiler und die Runen der Oberfläche braucht; die Engine ist gemockt.
import { afterEach, beforeEach, expect, test, vi, type MockInstance } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import HackEffect from '../../src/components/player/HackEffect.svelte'
import { engine } from '../../src/lib/audio/engine'
import { emptyData } from '../../src/lib/stats/schema'
import { recordResult, saveCheckin, stats } from '../../src/lib/stats/store.svelte'
import { closeMorning, morningUi, openMorning } from '../../src/lib/ui/morning-ui.svelte'
import { sessionUi, type SessionDoneInfo } from '../../src/lib/ui/session-ui.svelte'

let startProgram: MockInstance<typeof engine.startProgram>
let target: HTMLElement | null = null
let instance: ReturnType<typeof mount> | null = null

beforeEach(() => {
  localStorage.clear()
  stats.data = emptyData()
  stats.saveFailed = false
  sessionUi.done = null
  closeMorning()
  startProgram = vi.spyOn(engine, 'startProgram').mockResolvedValue(undefined)
})

afterEach(() => {
  if (instance) void unmount(instance)
  target?.remove()
  instance = null
  target = null
  startProgram.mockRestore()
  closeMorning()
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Zeigt das Ende eines gezählten Hacks „Strecken“ (Körper), so wie main.ts es nach dem Erfassen setzt. */
function show(): SessionDoneInfo {
  // Eine Minute später als ein Check-in „von jetzt“, damit dieser als Vorher-Wert zählt (wie in stats-store.test.ts).
  const id = recordResult({ kind: 'hack', ref: 'strecken', start: new Date(Date.now() + 60_000), seconds: 64 })
  const done: SessionDoneInfo = { kind: 'hack', ref: 'strecken', seconds: 64, counted: true, sessionId: id }
  sessionUi.done = done
  target = document.createElement('div')
  document.body.append(target)
  instance = mount(HackEffect, { target, props: { done } })
  flushSync()
  return done
}

const buttons = () => [...target!.querySelectorAll('button')].filter((b) => !b.closest('[role="radiogroup"]')).map((b) => b.textContent?.trim())
const button = (name: string) => [...target!.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)!
const text = () => target!.textContent!.replace(/\s+/g, ' ')

test('outside the morning flow it keeps "Fertig" and "Noch einmal" and the hint about "Fertig"', () => {
  show()
  expect(buttons()).toContain('Fertig')
  expect(buttons()).toContain('Noch einmal')
  expect(buttons()).not.toContain('Weiter')
  expect(text()).toContain('Ohne Antwort einfach „Fertig“.')
})

test('while the flow waits for the exercise it shows one "Weiter" instead, with the hint about "Weiter"', () => {
  openMorning('kurz')
  morningUi.step = 'aktivieren'
  morningUi.awaiting = 'hack'
  show()
  expect(buttons()).toContain('Weiter')
  expect(buttons()).not.toContain('Fertig')
  expect(buttons()).not.toContain('Noch einmal')
  expect(text()).toContain('Ohne Antwort einfach „Weiter“.')
  expect(text()).not.toContain('„Fertig“')
})

test('"Weiter" takes a tap only a moment after the view appears, then closes the end view and moves the flow on', async () => {
  openMorning('kurz')
  morningUi.step = 'aktivieren'
  morningUi.awaiting = 'hack'
  show()
  expect(button('Weiter').disabled).toBe(true)
  await wait(550)
  expect(button('Weiter').disabled).toBe(false)
  button('Weiter').click()
  flushSync()
  expect(sessionUi.done).toBeNull()
  expect(morningUi.awaiting).toBeNull()
  expect(morningUi.step).toBe('intention')
  // Der Hack ist erfasst und bleibt es; „Weiter“ startet nichts.
  expect(stats.data.hackRuns).toHaveLength(1)
  expect(startProgram).not.toHaveBeenCalled()
})

test('in the flow the question about the effect stays: two rows without a check-in', () => {
  openMorning('kurz')
  morningUi.awaiting = 'hack'
  show()
  expect(text()).toContain('vorher')
  expect(text()).toContain('jetzt')
})

test('in the flow the check-in of step 1 provides the "before" value, so there is one row "Körper jetzt?"', () => {
  openMorning('kurz')
  morningUi.awaiting = 'hack'
  saveCheckin({ koerper: 2, gefuehl: 3, geist: 3, sinn: 4 })
  show()
  expect(text()).toContain('Körper jetzt?')
  expect(text()).not.toContain('vorher')
  expect(stats.data.hackRuns![0].before).toBe(2)
})
