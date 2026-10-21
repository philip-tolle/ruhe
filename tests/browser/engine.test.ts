import { test, expect, afterEach } from 'vitest'
import { AudioEngine } from '../../src/lib/audio/engine'
import { createOutput, type Output } from '../../src/lib/audio/output'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
let out: Output | undefined
let engine: AudioEngine
function make(load?: (ctx: BaseAudioContext, url: string) => Promise<AudioBuffer>) {
  engine = new AudioEngine({ createOutput: () => (out = createOutput()), load })
  return engine
}
afterEach(async () => { await engine?.stopAll(); await out?.ctx.close() })

test('toggle starts and stops a live sound', async () => {
  const e = make()
  await e.toggle('regen')
  expect(e.snapshot()).toMatchObject({ state: 'playing', volumes: { regen: 0.7 } })
  expect(out!.ctx.state).toBe('running')
  await e.toggle('regen')
  await expect.poll(() => e.voiceCount(), { timeout: 3000 }).toBe(0)
  await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended')
  expect(e.snapshot().state).toBe('idle')
})

test('loop sound loads and plays alongside a live sound', async () => {
  const e = make()
  await Promise.all([e.toggle('regen'), e.toggle('wald')])
  expect(Object.keys(e.snapshot().volumes).sort()).toEqual(['regen', 'wald'])
  expect(e.voiceCount()).toBe(2)
})

test('rapid toggles never duplicate a voice', async () => {
  const e = make()
  await Promise.all([e.toggle('wald'), e.toggle('wald'), e.toggle('wald')])
  await expect.poll(() => e.voiceCount(), { timeout: 3000 }).toBe(1)
  expect(e.snapshot().volumes).toEqual({ wald: 0.7 })
})

test('sleep timer counts down and pause freezes it', async () => {
  const e = make()
  e.setSleepTimer(15)
  await e.toggle('meer')
  expect(e.snapshot().remainingSec).toBeGreaterThan(898)
  await e.pause()
  const frozen = e.snapshot().remainingSec!
  await wait(500)
  expect(e.snapshot().remainingSec).toBeCloseTo(frozen, 1)
  expect(e.snapshot().state).toBe('paused')
})

test('sleep timer end returns to idle', async () => {
  const e = make()
  e.setSleepTimer(0.02)                      // 1,2 s
  await e.toggle('regen')
  await expect.poll(() => e.snapshot().state, { timeout: 3000 }).toBe('idle')
  expect(e.snapshot()).toMatchObject({ state: 'idle', remainingSec: null, volumes: {} })
  expect(e.voiceCount()).toBe(0)
  await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended')
})

test('changing sleep timer during fade restores volume', async () => {
  const e = make()
  e.setSleepTimer(0.05)                      // 3 s, Ausblenden ab 0 s
  await e.toggle('regen')
  await expect.poll(() => out!.fade.gain.value, { timeout: 3000 }).toBeLessThan(0.6)
  const oldEnd = out!.ctx.currentTime + e.snapshot().remainingSec!
  e.setSleepTimer(null)
  await expect.poll(() => out!.fade.gain.value, { timeout: 3000 }).toBeGreaterThan(0.9)
  // Bis über das alte Ende hinaus (Audio-Uhr): Der verworfene Plan darf nichts mehr beenden.
  // Endet die Sitzung doch, steht die Uhr; dann sofort weiter zur Prüfung des Zustands.
  const passedOldEnd = () => e.snapshot().state !== 'playing' || out!.ctx.currentTime > oldEnd + 0.3
  await expect.poll(passedOldEnd, { timeout: 5000 }).toBe(true)
  expect(e.snapshot().state).toBe('playing')
  expect(out!.fade.gain.value).toBeGreaterThan(0.9)
})

test('external pause of the media element pauses the engine', async () => {
  const e = make()
  e.setSleepTimer(30)
  await e.toggle('wind')
  out!.element.pause()                       // simuliert Anruf / andere App
  await expect.poll(() => e.snapshot().state, { timeout: 3000 }).toBe('paused')
  await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended')
  const frozen = e.snapshot().remainingSec!
  await wait(400)
  expect(e.snapshot().remainingSec).toBeCloseTo(frozen, 1)
  await e.resume()
  expect(e.snapshot().state).toBe('playing')
})

test('failed loop load marks only that sound as error', async () => {
  const e = make(async () => { throw new Error('Konnte nicht geladen werden: x') })
  await e.toggle('regen')
  await e.toggle('wald')
  expect(e.snapshot()).toMatchObject({ state: 'playing', volumes: { regen: 0.7 }, errors: ['wald'], loading: [] })
  await e.toggle('wald')                     // neuer Versuch, schlägt wieder fehl
  expect(e.snapshot().errors).toEqual(['wald'])
})

test('setVolume changes only that sound and notifies subscribers', async () => {
  const e = make()
  const seen: number[] = []
  const off = e.subscribe(s => { if (s.volumes.regen !== undefined) seen.push(s.volumes.regen) })
  await e.toggle('regen')
  e.setVolume('regen', 0.3)
  off()
  expect(e.snapshot().volumes.regen).toBe(0.3)
  expect(seen.at(-1)).toBe(0.3)
})

test('switching sounds keeps the output running', async () => {
  const e = make()
  await e.toggle('regen')
  await e.toggle('regen')                    // einziger Klang aus: Engine ist idle
  await wait(200)
  await e.toggle('wind')                     // neuer Klang, bevor der alte ausgeklungen ist
  await expect.poll(() => e.voiceCount(), { timeout: 3000 }).toBe(1) // Marke nach dem Stopp ist gelaufen
  await wait(300)                            // ein irrtümliches Anhalten hätte jetzt gegriffen
  expect(out!.ctx.state).toBe('running')
  expect(out!.element.paused).toBe(false)
  expect(e.snapshot()).toMatchObject({ state: 'playing', volumes: { wind: 0.7 } })
})

test('long sleep timer does not fade before its last minute', async () => {
  const e = make()
  e.setSleepTimer(1.05)                      // 63 s, Ausblenden erst ab 3 s
  await e.toggle('regen')
  await wait(2500)
  expect(out!.fade.gain.value).toBeCloseTo(1, 3)
})

test('sleep end, then a new session starts at full fade', async () => {
  const e = make()
  e.setSleepTimer(0.02)                      // 1,2 s
  await e.toggle('regen')
  await expect.poll(() => e.snapshot().state, { timeout: 3000 }).toBe('idle')
  expect(e.snapshot().sleepMinutes).toBe(0.02)
  expect(out!.fade.gain.value).toBe(1)
  e.setSleepTimer(null)
  await e.toggle('regen')
  expect(e.snapshot()).toMatchObject({ state: 'playing', remainingSec: null })
  await wait(300)                            // eine Rückführung von 0 auf 1 wäre jetzt bei etwa 0,3
  expect(out!.fade.gain.value).toBe(1)
})

test('stopAll while paused tears down at once', async () => {
  const e = make()
  await e.toggle('regen')
  await e.toggle('meer')
  await e.pause()
  await e.stopAll()
  expect(e.snapshot()).toMatchObject({ state: 'idle', volumes: {}, remainingSec: null })
  expect(e.voiceCount()).toBe(0)
  await e.toggle('wind')
  expect(e.snapshot().state).toBe('playing')
  expect(out!.ctx.state).toBe('running')
  await wait(1200)                           // auch nach Ablauf der Ausklingzeit bleibt es bei einer Stimme
  expect(e.voiceCount()).toBe(1)
  expect(e.snapshot().state).toBe('playing')
})
