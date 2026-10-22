import { afterEach, beforeEach, expect, test, vi } from 'vitest'
// Die echten Farbwerte samt 1,5-s-Überblendung: theme-color muss trotzdem sofort den Zielwert tragen.
import '../../src/app.css'
import { followTageszeit, tageszeitUi } from '../../src/lib/ui/tageszeit.svelte'

const root = document.documentElement

// Die Uhr der Tests: `now` liest sie, `advance` stellt sie und die Vitest-Timer gemeinsam vor.
// Ortszeit (new Date(y, m, d, h, …)), damit kein Test von der Zeitzone des Rechners abhängt.
let clock = new Date(2026, 9, 22, 20, 0)
const now = () => clock
const setClock = (hour: number, minute = 0, second = 0) => {
  clock = new Date(2026, 9, 22, hour, minute, second)
}
function advance(ms: number) {
  clock = new Date(clock.getTime() + ms)
  vi.advanceTimersByTime(ms)
}

const skyTop = () => getComputedStyle(root).getPropertyValue('--sky-top').trim()
/** Die Farbe, bei der die laufende Überblendung ankommt (ohne Überblendung: die jetzige). */
function settledSkyTop(): string {
  skyTop() // Stil berechnen, damit eine Überblendung schon läuft
  for (const animation of root.getAnimations()) animation.finish()
  return skyTop()
}

let meta: HTMLMetaElement
let attributeBefore: string | undefined
let stop: (() => void) | undefined

beforeEach(() => {
  vi.useFakeTimers()
  attributeBefore = root.dataset.tageszeit
  // Wie nach dem Inline-Skript in index.html am Abend.
  root.dataset.tageszeit = 'abend'
  meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = '#0B1026'
  document.head.append(meta)
  // Ruhender Abend als Ausgang: Von hier aus läuft eine Überblendung wie in der App.
  settledSkyTop()
})

afterEach(() => {
  stop?.()
  stop = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
  if (attributeBefore === undefined) delete root.dataset.tageszeit
  else root.dataset.tageszeit = attributeBefore
  settledSkyTop()
  meta.remove()
})

test('followTageszeit sets the attribute and theme-color at once', () => {
  const evening = skyTop()
  setClock(8)
  stop = followTageszeit(now)

  expect(root.dataset.tageszeit).toBe('morgen')
  expect(tageszeitUi.current).toBe('morgen')
  // Schon jetzt der Himmel des Morgens, nicht der Anfang der Überblendung vom Abend her.
  const content = meta.content
  expect(content).not.toBe(evening)
  expect(content).toBe(settledSkyTop())
})

test('theme-color is the computed --sky-top when nothing changes', () => {
  setClock(20)
  stop = followTageszeit(now)
  expect(root.dataset.tageszeit).toBe('abend')
  expect(meta.content).toBe(skyTop())
  expect(meta.content).toBe('rgb(11, 16, 38)')
})

test('switches at the next full minute after a boundary', () => {
  setClock(10, 59, 30)
  stop = followTageszeit(now)
  expect(root.dataset.tageszeit).toBe('morgen')
  const morning = meta.content

  advance(29_999) // 10:59:59.999
  expect(root.dataset.tageszeit).toBe('morgen')
  expect(tageszeitUi.current).toBe('morgen')

  advance(1) // 11:00:00
  expect(root.dataset.tageszeit).toBe('tag')
  expect(tageszeitUi.current).toBe('tag')
  expect(meta.content).not.toBe(morning)
  expect(meta.content).toBe(settledSkyTop())

  // Der Takt läuft weiter: um 17:00 wird es Abend.
  setClock(16, 59, 0)
  advance(59_999)
  expect(root.dataset.tageszeit).toBe('tag')
  advance(1)
  expect(root.dataset.tageszeit).toBe('abend')
  expect(tageszeitUi.current).toBe('abend')
})

test('switches immediately on visibilitychange', () => {
  setClock(16)
  stop = followTageszeit(now)
  expect(root.dataset.tageszeit).toBe('tag')

  // Stunden später zurück in die App: Kein Timer hat gefeuert, der Wechsel kommt sofort.
  setClock(18)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(root.dataset.tageszeit).toBe('abend')
  expect(tageszeitUi.current).toBe('abend')
  expect(meta.content).toBe(settledSkyTop())
})

test('a hidden page does not switch on visibilitychange', () => {
  setClock(16)
  stop = followTageszeit(now)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

  setClock(18)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(root.dataset.tageszeit).toBe('tag')
})

test('cleanup removes the timer and the listener', () => {
  setClock(16, 59, 30)
  const cleanup = followTageszeit(now)
  expect(vi.getTimerCount()).toBe(1)

  cleanup()
  expect(vi.getTimerCount()).toBe(0)

  advance(120_000) // 17:01:30, ohne Takt
  expect(root.dataset.tageszeit).toBe('tag')
  document.dispatchEvent(new Event('visibilitychange'))
  expect(root.dataset.tageszeit).toBe('tag')
  expect(tageszeitUi.current).toBe('tag')
})
