// Der gemeinsame Rahmen geführter Abläufe (`FlowFrame`, Spec M11 §5): Dialog, Fortschritt, „Überspringen“, Rückfrage beim
// Beenden (Escape, „×“), Fokus auf die Überschrift je Schritt. Liegt unter browser/, weil die Komponente einen
// Svelte-Compiler und echte Fokus- und History-Ereignisse braucht.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { flushSync, mount, tick, unmount } from 'svelte'
import FlowFrameHarness from './harness/FlowFrameHarness.svelte'

let target: HTMLElement
let instance: { go: (step: string) => void; isConfirming: () => boolean } & Record<string, unknown>
let onSkip: ReturnType<typeof vi.fn<() => void>>
let onClose: ReturnType<typeof vi.fn<() => void>>

function open(initial = 'b'): void {
  target = document.createElement('div')
  document.body.append(target)
  onSkip = vi.fn<() => void>()
  onClose = vi.fn<() => void>()
  instance = mount(FlowFrameHarness, { target, props: { onSkip, onClose, initial } }) as typeof instance
  flushSync()
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="Test-Ablauf"]')
const title = () => document.querySelector<HTMLElement>('[data-step-title]')
const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name)
const escape = () => dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

beforeEach(() => {
  history.replaceState(null, '')
})

afterEach(() => {
  unmount(instance)
  target.remove()
})

test('Dialog mit Namen, Fortschritt „Schritt 2 von 3“, „×“ und „Überspringen“', () => {
  open('b')
  expect(dialog()).not.toBeNull()
  expect(document.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Schritt 2 von 3')
  expect(button('Test-Ablauf beenden')).toBeDefined()
  expect(button('Überspringen')).toBeDefined()
})

test('im Abschluss (Schritt nicht in der Liste) weder Fortschritt noch „Überspringen“', () => {
  open('ende')
  expect(document.querySelector('[role="img"]')).toBeNull()
  expect(button('Überspringen')).toBeUndefined()
  expect(button('Test-Ablauf beenden')).toBeDefined()
})

test('Escape vor dem Abschluss fragt nach; „Beenden“ ruft onClose', () => {
  open('b')
  escape()
  flushSync()
  expect(instance.isConfirming()).toBe(true)
  expect(document.body.textContent).toContain('Test-Ablauf beenden?')
  expect(onClose).not.toHaveBeenCalled()
  button('Beenden')!.click()
  flushSync()
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('„Weiter machen“ schließt die Rückfrage und fokussiert die Überschrift', async () => {
  open('b')
  button('Test-Ablauf beenden')!.click()
  flushSync()
  expect(instance.isConfirming()).toBe(true)
  button('Weiter machen')!.click()
  flushSync()
  await tick()
  expect(instance.isConfirming()).toBe(false)
  expect(document.body.textContent).not.toContain('Test-Ablauf beenden?')
  expect(document.activeElement).toBe(title())
})

test('Escape im Abschluss schließt ohne Rückfrage', () => {
  open('ende')
  escape()
  flushSync()
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(instance.isConfirming()).toBe(false)
})

test('ein Schrittwechsel fokussiert die neue Überschrift', async () => {
  open('a')
  instance.go('b')
  flushSync()
  await tick()
  await tick()
  expect(title()?.textContent).toBe('Schritt b')
  expect(document.activeElement).toBe(title())
})

test('„Überspringen“ nimmt Tipps erst nach kurzer Zeit an und ruft dann onSkip', async () => {
  open('a')
  expect(button('Überspringen')!.disabled).toBe(true)
  await vi.waitFor(() => expect(button('Überspringen')!.disabled).toBe(false))
  button('Überspringen')!.click()
  expect(onSkip).toHaveBeenCalledTimes(1)
})
