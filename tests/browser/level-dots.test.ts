// Die Punkte einer Stufe (LevelDots) als Radiogruppe: Pfeile, Pos1 und Ende bewegen den Fokus und wählen; zeigt die Taste
// auf die Stufe, die schon gewählt ist, bewegt sie nur den Fokus. Wer die Punkte einsetzt, darf dieselbe Stufe nämlich
// als „zurücknehmen“ deuten (der Brain Hack, Spec M9 §3.5): Pos1 auf einer gewählten 1 würde die Antwort sonst löschen.
// Liegt unter browser/, weil die Komponente einen Svelte-Compiler braucht.
import { afterEach, expect, test, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import LevelDots from '../../src/components/energy/LevelDots.svelte'
import type { EnergyLevel } from '../../src/lib/energy/areas'

let target: HTMLElement | null = null
let instance: ReturnType<typeof mount> | null = null

afterEach(() => {
  if (instance) void unmount(instance)
  target?.remove()
  instance = null
  target = null
})

function dots(value: EnergyLevel | null) {
  const onPick = vi.fn()
  target = document.createElement('div')
  document.body.append(target)
  instance = mount(LevelDots, { target, props: { area: 'geist', value, onPick } })
  const radios = [...target.querySelectorAll<HTMLElement>('[role="radio"]')]
  return { onPick, radios }
}

function press(radio: HTMLElement, key: string) {
  radio.focus()
  radio.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

test('Home on the chosen first dot and End on the chosen last dot only move the focus', () => {
  const first = dots(1)
  press(first.radios[0], 'Home')
  expect(first.onPick).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(first.radios[0])
  press(first.radios[2], 'Home') // von einem anderen Punkt aus zeigt Pos1 auf die gewählte 1
  expect(first.onPick).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(first.radios[0])
  instance && void unmount(instance)
  target?.remove()

  const last = dots(5)
  press(last.radios[4], 'End')
  expect(last.onPick).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(last.radios[4])
})

test('arrows, Home and End on another dot choose it and take the focus along', () => {
  const { onPick, radios } = dots(3)
  press(radios[2], 'Home')
  expect(onPick).toHaveBeenLastCalledWith(1)
  expect(document.activeElement).toBe(radios[0])
  press(radios[2], 'End')
  expect(onPick).toHaveBeenLastCalledWith(5)
  expect(document.activeElement).toBe(radios[4])
  press(radios[2], 'ArrowRight')
  expect(onPick).toHaveBeenLastCalledWith(4)
  press(radios[2], 'ArrowLeft')
  expect(onPick).toHaveBeenLastCalledWith(2)
  expect(onPick).toHaveBeenCalledTimes(4)
})

test('without a choice, every key chooses', () => {
  const { onPick, radios } = dots(null)
  press(radios[0], 'End')
  expect(onPick).toHaveBeenCalledWith(5)
  press(radios[0], 'ArrowLeft') // vom ersten Punkt zum letzten
  expect(onPick).toHaveBeenLastCalledWith(5)
})
