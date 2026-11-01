// Die Chip-Auswahl (`ChoiceGroup`, Spec M12 §2.6, §2.10): Tastatur wie eine Radiogruppe; eine Taste auf die gewählte Option
// wählt nicht neu (sonst nähme eine Taste auf ein gewähltes Wachstumsfeld nichts zurück, ein Tipp aber schon). Lange Wörter
// brechen im Chip um. Liegt unter browser/, weil die Komponente einen Svelte-Compiler und echtes Layout braucht.
import { afterEach, expect, test, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import ChoiceGroup from '../../src/components/ChoiceGroup.svelte'

let target: HTMLElement
let instance: Record<string, unknown>
let onSelect: ReturnType<typeof vi.fn<(value: string | null) => void>>

function show(options: { value: string | null; label: string }[], value: string | null, width?: string): void {
  target = document.createElement('div')
  if (width) target.style.width = width
  document.body.append(target)
  onSelect = vi.fn<(value: string | null) => void>()
  instance = mount(ChoiceGroup<string | null>, { target, props: { label: 'Wachstumsfeld', options, value, onSelect } })
  flushSync()
}

afterEach(() => {
  unmount(instance)
  target.remove()
})

const radios = () => [...target.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
const keydown = (key: string) => new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })

test('eine Pfeiltaste auf die gewählte Option bewegt nur den Fokus', () => {
  show([{ value: 's-0000000b', label: 'Schach lernen' }], 's-0000000b')
  radios()[0].focus()
  radios()[0].dispatchEvent(keydown('ArrowRight'))
  expect(onSelect).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(radios()[0])
})

test('ohne Wahl ist die erste Option erreichbar; eine Pfeiltaste auf eine andere wählt sie', () => {
  show([{ value: 'a', label: 'Schach lernen' }, { value: 'b', label: 'Mehrweg im Alltag' }], null)
  expect(radios().map((r) => r.tabIndex)).toEqual([0, -1])
  radios()[0].dispatchEvent(keydown('ArrowRight'))
  expect(onSelect).toHaveBeenCalledWith('b')
})

test('ein langes Wort ohne Leerzeichen bricht im Chip um; ein einzeiliger Chip bleibt 48 px hoch', () => {
  show([{ value: 'a', label: 'x'.repeat(40) }, { value: 'b', label: 'Kurz' }], null, '200px') // Breite des Behälters
  const [long, short] = radios()
  expect(long.getBoundingClientRect().width).toBeLessThanOrEqual(200)
  expect(long.scrollWidth).toBeLessThanOrEqual(long.clientWidth)
  expect(short.getBoundingClientRect().height).toBe(48)
})
