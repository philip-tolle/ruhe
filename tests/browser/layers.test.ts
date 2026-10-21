import { test, expect, afterEach, vi } from 'vitest'
import { openLayer } from '../../src/lib/ui/layers.svelte'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
// Tiefe des aktuellen History-Eintrags laut Marke; 0 = Ausgangseintrag.
const depth = () => (history.state as { ruheLayer?: number } | null)?.ruheLayer ?? 0

// Zählt alle Schritte durch die History, die die Ebenen von sich aus anstoßen.
const watchNavigation = () => {
  const spies = [vi.spyOn(history, 'back'), vi.spyOn(history, 'go'), vi.spyOn(history, 'forward')]
  return () => spies.reduce((sum, spy) => sum + spy.mock.calls.length, 0)
}

// Jeder Test räumt seine History-Einträge selbst weg, damit die Tests unabhängig bleiben.
const handles: Array<() => void> = []
const open = (onBack: () => void) => {
  const close = openLayer(onBack)
  handles.push(close)
  return close
}
afterEach(async () => {
  vi.restoreAllMocks()
  for (const close of handles.splice(0)) close()
  await expect.poll(depth).toBe(0)
})

test('back closes the top layer first', async () => {
  const closed: string[] = []
  open(() => closed.push('a')); open(() => closed.push('b'))
  history.back(); await expect.poll(() => closed).toEqual(['b'])
  history.back(); await expect.poll(() => closed).toEqual(['b', 'a'])
})

test('closing programmatically does not trigger onBack', async () => {
  const closed: string[] = []
  const close = open(() => closed.push('a')); close()
  await new Promise(r => setTimeout(r, 200)); expect(closed).toEqual([])
  expect(depth()).toBe(0)
})

test('close then open in one go keeps the new layer', async () => {
  const closed: string[] = []
  const close = open(() => closed.push('sheet')); close(); open(() => closed.push('player'))
  await new Promise(r => setTimeout(r, 200)); expect(closed).toEqual([])
  history.back(); await expect.poll(() => closed).toEqual(['player'])
})

test('closing after the back gesture already closed the layer does nothing', async () => {
  const closed: string[] = []
  const close = open(() => closed.push('a'))
  history.back(); await expect.poll(() => closed).toEqual(['a'])
  const navigations = watchNavigation()
  close(); close()
  await wait(100)
  expect(navigations()).toBe(0)
  expect(closed).toEqual(['a'])
})

test('closing twice removes the entry only once and leaves other layers alone', async () => {
  const closed: string[] = []
  const navigations = watchNavigation()
  open(() => closed.push('a')); const closeB = open(() => closed.push('b'))
  closeB(); closeB()
  await expect.poll(depth).toBe(1)
  await wait(100)
  expect(navigations()).toBe(1)
  history.back(); await expect.poll(() => closed).toEqual(['a'])
})

test('closing two layers in one go removes both entries and keeps a layer opened right after', async () => {
  const closed: string[] = []
  const closeBottom = open(() => closed.push('player'))
  const closeTop = open(() => closed.push('dialog'))
  closeTop(); closeBottom(); open(() => closed.push('result'))
  await wait(200)
  expect(closed).toEqual([])
  expect(depth()).toBe(1)
  history.back(); await expect.poll(() => closed).toEqual(['result'])
})

test('closing the lower layer first, then the upper one, removes both entries', async () => {
  const closed: string[] = []
  const closeBottom = open(() => closed.push('player'))
  const closeTop = open(() => closed.push('dialog'))
  closeBottom(); closeTop(); open(() => closed.push('result'))
  await wait(200)
  expect(closed).toEqual([])
  expect(depth()).toBe(1)
  history.back(); await expect.poll(() => closed).toEqual(['result'])
})

test('closing a layer below the top leaves the top layer reachable by back and frees both entries', async () => {
  const closed: string[] = []
  const closeBottom = open(() => closed.push('a')); open(() => closed.push('b'))
  closeBottom()
  expect(depth()).toBe(2)
  history.back(); await expect.poll(() => closed).toEqual(['b'])
  // Der Eintrag der unteren Ebene wird gleich mit frei, die Zurück-Geste läuft nicht ins Leere.
  await expect.poll(depth).toBe(0)
  expect(closed).toEqual(['b'])
})

test('jumping several entries back closes every layer above, top first', async () => {
  const closed: string[] = []
  open(() => closed.push('a')); open(() => closed.push('b')); open(() => closed.push('c'))
  history.go(-2); await expect.poll(() => closed).toEqual(['c', 'b'])
  history.back(); await expect.poll(() => closed).toEqual(['c', 'b', 'a'])
})

test('a layer closed in the middle is not reported when back jumps over its entry', async () => {
  const closed: string[] = []
  open(() => closed.push('a')); const closeMiddle = open(() => closed.push('b')); open(() => closed.push('c'))
  closeMiddle()
  history.go(-2); await expect.poll(() => closed).toEqual(['c'])
  await wait(100)
  expect(closed).toEqual(['c'])
  history.back(); await expect.poll(() => closed).toEqual(['c', 'a'])
})
