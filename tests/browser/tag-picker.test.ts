// Die Stichwort-Auswahl des Abend-Logbuchs (`TagPicker`, Spec M11 §2.3): Umschalter, „+ Eigenes“ mit Feld, keine Doppelten,
// höchstens 20 gewählte. Liegt unter browser/, weil die Komponente einen Svelte-Compiler braucht. Alle Wörter sind ausgedacht.
import { afterEach, expect, test, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import TagPicker from '../../src/components/evening/TagPicker.svelte'
import TagPickerHarness from './harness/TagPickerHarness.svelte'

let target: HTMLElement
let instance: Record<string, unknown>
let onChange: ReturnType<typeof vi.fn<(selected: string[]) => void>>

const TAGS = ['Bewegung', 'Draußen', 'Musik']

function show(selected: string[] = [], own: string[] = [], tags: readonly string[] = TAGS): void {
  target = document.createElement('div')
  document.body.append(target)
  onChange = vi.fn<(selected: string[]) => void>()
  instance = mount(TagPicker, { target, props: { own, tags, selected, onChange } })
  flushSync()
}

afterEach(() => {
  unmount(instance)
  target.remove()
})

const button = (name: string) => [...target.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.replace('✓', '').trim() === name)
const field = () => target.querySelector<HTMLInputElement>('input')

/** Tippt `text` ins Feld, wie der Browser: erst `beforeinput`, dann der neue Wert und `input`. */
function type(text: string): void {
  const input = field()!
  input.focus()
  input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, cancelable: true }))
  input.value = text
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true }))
}

test('ein Tipp schaltet um und meldet die neue Auswahl', () => {
  show(['Musik'])
  expect(button('Musik')!.getAttribute('aria-pressed')).toBe('true')
  expect(button('Bewegung')!.getAttribute('aria-pressed')).toBe('false')
  button('Bewegung')!.click()
  expect(onChange).toHaveBeenLastCalledWith(['Musik', 'Bewegung'])
  button('Musik')!.click()
  expect(onChange).toHaveBeenLastCalledWith([])
})

test('„Deine Stichworte“ erscheint nur mit eigenen', () => {
  show([], [])
  expect(target.querySelector('[role="group"][aria-label="Deine Stichworte"]')).toBeNull()
  unmount(instance)
  target.remove()
  show([], ['Kochen'])
  expect(target.querySelector('[role="group"][aria-label="Deine Stichworte"]')?.textContent).toContain('Kochen')
  expect(target.querySelector('[role="group"][aria-label="Vorschläge"]')?.textContent).toContain('Bewegung')
})

test('„+ Eigenes“: Eingabe und Enter fügen hinzu und wählen; ein vorhandenes Wort wird gewählt, nicht verdoppelt', () => {
  show(['Musik'])
  button('+ Eigenes')!.click()
  flushSync()
  expect(field()?.getAttribute('aria-label') ?? target.querySelector('label')?.textContent).toContain('Eigenes Stichwort')
  type('Kochen')
  field()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  expect(onChange).toHaveBeenLastCalledWith(['Musik', 'Kochen'])
  flushSync()
  expect(field()).toBeNull() // das Feld schließt nach dem Hinzufügen

  onChange.mockClear()
  button('+ Eigenes')!.click()
  flushSync()
  type('bewegung')
  button('Hinzufügen')!.click()
  expect(onChange).toHaveBeenLastCalledWith(['Musik', 'Bewegung'])
})

test('nur Leerzeichen fügt nichts hinzu; zu Langes wird auf 30 Zeichen gekürzt', () => {
  show([])
  button('+ Eigenes')!.click()
  flushSync()
  type('   ')
  button('Hinzufügen')!.click()
  expect(onChange).not.toHaveBeenCalled()
  type('x'.repeat(35))
  expect(field()!.value).toBe('x'.repeat(30))
  button('Hinzufügen')!.click()
  expect(onChange).toHaveBeenLastCalledWith(['x'.repeat(30)])
})

test('mit 20 gewählten sind übrige Stichworte und „+ Eigenes“ gesperrt, gewählte lassen sich abwählen', () => {
  const twenty = Array.from({ length: 20 }, (_, i) => `Eigen ${i}`)
  show(twenty, twenty)
  expect(button('Bewegung')!.disabled).toBe(true)
  expect(button('+ Eigenes')!.disabled).toBe(true)
  expect(button('Eigen 3')!.disabled).toBe(false)
  button('Eigen 3')!.click()
  expect(onChange).toHaveBeenLastCalledWith(twenty.filter((t) => t !== 'Eigen 3'))
})

test('ein eben hinzugefügtes Stichwort bleibt nach dem Abwählen stehen und lässt sich wieder wählen', () => {
  target = document.createElement('div')
  document.body.append(target)
  instance = mount(TagPickerHarness, { target, props: { tags: TAGS } })
  flushSync()
  button('+ Eigenes')!.click()
  flushSync()
  type('Kochen')
  field()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  flushSync()
  expect(button('Kochen')!.getAttribute('aria-pressed')).toBe('true')

  button('Kochen')!.click() // abwählen: der Knopf bleibt an seiner Stelle, ein zweiter Tipp trifft wieder ihn
  flushSync()
  expect(button('Kochen')?.getAttribute('aria-pressed')).toBe('false')
  expect(target.querySelector('[role="group"][aria-label="Deine Stichworte"]')).not.toBeNull()

  button('Kochen')!.click()
  flushSync()
  expect(button('Kochen')!.getAttribute('aria-pressed')).toBe('true')
  expect(button('Bewegung')!.getAttribute('aria-pressed')).toBe('false')
})
