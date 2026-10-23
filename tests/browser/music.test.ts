import { test, expect, afterEach, beforeAll, beforeEach, vi, type MockInstance } from 'vitest'
import { createMusicVoice, type MusicVoice } from '../../src/lib/audio/music'
import { assetUrl } from '../../src/lib/sounds/catalog'
import { toneUrl } from './wav'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

// Ein Stück von 3 s mit 1 s Überblendung: Das zweite Element beginnt bei 2 s, die Rollen tauschen bei 3 s.
let tone = ''
beforeAll(async () => {
  tone = await toneUrl(3)
})

let ctx: AudioContext
let voice: MusicVoice | undefined
let play: MockInstance<HTMLMediaElement['play']>
let sources: MockInstance<AudioContext['createMediaElementSource']>
beforeEach(async () => {
  ctx = new AudioContext()
  await ctx.resume()
  play = vi.spyOn(HTMLMediaElement.prototype, 'play')
  sources = vi.spyOn(ctx, 'createMediaElementSource')
})
afterEach(async () => {
  voice?.stop()
  voice = undefined
  vi.restoreAllMocks()
  await ctx.close()
})

// Beide Elemente der Stimme, in der Reihenfolge ihrer Entstehung (das erste spielt zuerst).
const elements = () => sources.mock.calls.map(([element]) => element)
const played = () => play.mock.contexts as HTMLMediaElement[]

function make(url = tone): MusicVoice {
  voice = createMusicVoice(ctx, url, { crossfade: 1 })
  voice.output.connect(ctx.destination) // sonst verarbeitet der Graph die Zeitmarken nicht
  return voice
}

test('a music voice gets ready and plays its first element from the start', async () => {
  const v = make()
  await v.ready
  expect(elements()).toHaveLength(2)
  expect(played()).toEqual([elements()[0]])
  expect(elements()[0].currentTime).toBeLessThan(0.5)
  expect(elements()[1].paused).toBe(true)
})

test('the second element starts crossfade seconds before the end and the gains ramp over the crossfade', async () => {
  const ramp = vi.spyOn(AudioParam.prototype, 'linearRampToValueAtTime')
  const v = make()
  await v.ready
  const [first, second] = elements()
  await expect.poll(() => played().length, { timeout: 4000 }).toBe(2)
  expect(played()[1]).toBe(second)
  expect(first.currentTime).toBeGreaterThanOrEqual(1.7)
  const ends = ramp.mock.calls.map(([value, end]) => ({ value, end }))
  expect(ends.map(r => r.value).sort()).toEqual([0, 1])
  expect(ends[0].end).toBeCloseTo(ends[1].end, 6)
  const ahead = ends[0].end - ctx.currentTime
  expect(ahead).toBeGreaterThan(0.6)
  expect(ahead).toBeLessThanOrEqual(1)
})

test('after the crossfade the roles swap and the old element rewinds', async () => {
  const v = make()
  await v.ready
  const [first] = elements()
  await expect.poll(() => played().length, { timeout: 4000 }).toBe(2)
  // Das alte Element kann sein Ende kurz vor dem Tausch erreichen; danach steht es wieder am Anfang.
  await expect.poll(() => first.paused && first.currentTime === 0, { timeout: 2000 }).toBe(true)
  await expect.poll(() => played().length, { timeout: 4000 }).toBe(3)
  expect(played()[2]).toBe(first)
})

test('hold pauses only the sounding elements and resume continues them', async () => {
  const v = make()
  await v.ready
  const [first, second] = elements()
  await wait(300)

  // Außerhalb einer Überblendung klingt nur das erste.
  v.hold()
  expect(first.paused).toBe(true)
  const at = first.currentTime
  play.mockClear()
  await v.resume()
  expect(played()).toEqual([first])
  expect(first.paused).toBe(false)
  expect(second.paused).toBe(true)
  expect(first.currentTime).toBeGreaterThanOrEqual(at)

  // Mitten in der Überblendung: beide anhalten, mit ihnen die Audio-Uhr (wie die Engine), und beide fortsetzen.
  await expect.poll(() => played().length, { timeout: 4000 }).toBe(2)
  v.hold()
  await ctx.suspend()
  expect(first.paused).toBe(true)
  expect(second.paused).toBe(true)
  const positions = [first.currentTime, second.currentTime]
  play.mockClear()
  await ctx.resume()
  await v.resume()
  expect(new Set(played())).toEqual(new Set([first, second]))
  expect(first.paused).toBe(false)
  expect(second.paused).toBe(false)
  expect(first.currentTime).toBeGreaterThanOrEqual(positions[0])
  expect(second.currentTime).toBeGreaterThanOrEqual(positions[1])
  // Die Überblendung läuft zu Ende: Danach klingt nur noch das zweite.
  await expect.poll(() => first.paused, { timeout: 2000 }).toBe(true)
  expect(second.paused).toBe(false)
})

test('stop frees both elements', async () => {
  const v = make()
  await v.ready
  v.stop()
  for (const element of elements()) {
    expect(element.paused).toBe(true)
    expect(element.hasAttribute('src')).toBe(false)
  }
})

test('stop at a later time frees at that time', async () => {
  const v = make()
  await v.ready
  const [first] = elements()
  v.stop(ctx.currentTime + 0.3)
  await wait(100)
  expect(first.paused).toBe(false)
  await expect.poll(() => first.hasAttribute('src'), { timeout: 1000 }).toBe(false)
  expect(first.paused).toBe(true)
})

test('a file that does not load rejects ready', async () => {
  const v = make(assetUrl('audio/music/gibt-es-nicht.opus'))
  await expect(v.ready).rejects.toThrow(/^Konnte nicht geladen werden:/)
})
