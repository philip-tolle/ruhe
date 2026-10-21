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
  await wait(1200)
  expect(e.snapshot().state).toBe('idle')
  expect(e.voiceCount()).toBe(0)
  expect(out!.ctx.state).toBe('suspended')
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
  await wait(1200)
  expect(e.snapshot().volumes).toEqual({ wald: 0.7 })
  expect(e.voiceCount()).toBe(1)
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
  await wait(2000)
  expect(e.snapshot()).toMatchObject({ state: 'idle', remainingSec: null, volumes: {} })
  expect(e.voiceCount()).toBe(0)
  expect(out!.ctx.state).toBe('suspended')
})

test('changing sleep timer during fade restores volume', async () => {
  const e = make()
  e.setSleepTimer(0.05)                      // 3 s, Ausblenden ab 0 s
  await e.toggle('regen')
  await wait(2000)
  expect(out!.fade.gain.value).toBeLessThan(0.6)
  e.setSleepTimer(null)
  await wait(1500)
  expect(e.snapshot().state).toBe('playing')
  expect(out!.fade.gain.value).toBeGreaterThan(0.9)
})

test('external pause of the media element pauses the engine', async () => {
  const e = make()
  e.setSleepTimer(30)
  await e.toggle('wind')
  out!.element.pause()                       // simuliert Anruf / andere App
  await wait(100)
  expect(e.snapshot().state).toBe('paused')
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
