// Das Vibrieren des Hack-Players: nur bei eingeschalteter Einstellung und sichtbarer Seite, sonst still.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { emptyData } from '../../src/lib/stats/schema'
import { stats } from '../../src/lib/stats/store.svelte'
import { vibrate } from '../../src/lib/ui/vibrate'

const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'vibrate')
const visibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')!

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

beforeEach(() => {
  stats.data = emptyData()
  stats.data.settings.vibration = true
  setVisibility('visible')
})

afterEach(() => {
  delete (document as { visibilityState?: unknown }).visibilityState
  Object.defineProperty(Document.prototype, 'visibilityState', visibility)
  if (original) Object.defineProperty(Navigator.prototype, 'vibrate', original)
  else delete (navigator as { vibrate?: unknown }).vibrate
})

function stub(impl: (ms: number) => boolean = () => true) {
  const spy = vi.fn(impl)
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: spy })
  return spy
}

test('it vibrates for the given time when vibration is on and the page is visible', () => {
  const spy = stub()
  vibrate(60)
  vibrate(200)
  expect(spy.mock.calls).toEqual([[60], [200]])
})

test('it stays quiet when vibration is off', () => {
  const spy = stub()
  stats.data.settings.vibration = false
  vibrate(60)
  expect(spy).not.toHaveBeenCalled()
})

test('it stays quiet when the page is not visible', () => {
  const spy = stub()
  setVisibility('hidden')
  vibrate(60)
  expect(spy).not.toHaveBeenCalled()
})

test('a missing or failing interface does not throw', () => {
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined })
  expect(() => vibrate(60)).not.toThrow()
  stub(() => {
    throw new Error('gesperrt')
  })
  expect(() => vibrate(60)).not.toThrow()
})
