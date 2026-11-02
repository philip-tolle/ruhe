// Das Wachstumsfeld zum 1-%-Satz (`FieldChoice`, Spec M12 §2.6): Chips in der Reihenfolge der Sammlung, kein Chip vorgewählt,
// ein Tipp wählt, ein zweiter nimmt zurück, eine Taste nimmt nicht zurück. Liegt unter browser/, weil die Komponente einen
// Svelte-Compiler braucht. Alle Einträge sind erfunden und neutral.
import { afterEach, beforeEach, expect, test } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import FieldChoice from '../../src/components/principles/FieldChoice.svelte'
import { emptyData } from '../../src/lib/stats/schema'
import { stats } from '../../src/lib/stats/store.svelte'
import { eveningUi } from '../../src/lib/ui/evening-ui.svelte'

let target: HTMLElement
let instance: ReturnType<typeof mount> | null = null

beforeEach(() => {
  localStorage.clear()
  stats.data = emptyData()
  eveningUi.draft.growthField = null // der Zustand des Moduls bleibt zwischen den Tests
})

afterEach(() => {
  if (instance) void unmount(instance)
  target?.remove()
  instance = null
})

function show(): void {
  target = document.createElement('div')
  document.body.append(target)
  instance = mount(FieldChoice, { target })
  flushSync()
}

const radios = () => [...target.querySelectorAll<HTMLButtonElement>('[role="radio"]')]

const F = { id: 's-0000000b', kind: 'feld' as const, text: 'Schach lernen' }
const F2 = { id: 's-0000000e', kind: 'feld' as const, text: 'Mehrweg im Alltag' }

test('ohne Felder nichts', () => {
  stats.data = { ...emptyData(), collection: [{ id: 's-0000000a', kind: 'prinzip', text: 'Mehrweg statt Einweg' }] }
  show()
  expect([target.textContent!.trim(), target.querySelector('[role="radiogroup"]')]).toEqual(['', null])
})

test('Chips in der Reihenfolge der Sammlung, kein Chip vorgewählt; die Gruppe heißt wie die sichtbare Beschriftung', () => {
  stats.data = { ...emptyData(), collection: [F2, F] }
  show()
  expect(target.querySelector('[role="radiogroup"]')!.getAttribute('aria-label')).toBe('Wachstumsfeld (freiwillig)')
  const label = target.querySelector('[aria-hidden="true"]')!
  expect(label.textContent).toBe('Wachstumsfeld (freiwillig)')
  expect(radios().map((r) => [r.textContent!.trim(), r.getAttribute('aria-checked')])).toEqual([
    ['Mehrweg im Alltag', 'false'],
    ['Schach lernen', 'false'],
  ])
})

test('ein Tipp wählt, ein zweiter nimmt zurück', () => {
  stats.data = { ...emptyData(), collection: [F] }
  show()
  radios()[0].click()
  flushSync()
  expect(eveningUi.draft.growthField).toBe(F.id)
  radios()[0].click()
  flushSync()
  expect(eveningUi.draft.growthField).toBeNull()
})

test('mit einem Feld nimmt eine Pfeiltaste die Wahl nicht zurück (Tastenschutz in ChoiceGroup)', () => {
  stats.data = { ...emptyData(), collection: [F] }
  show()
  radios()[0].click()
  flushSync()
  radios()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
  flushSync()
  expect(eveningUi.draft.growthField).toBe(F.id)
})
