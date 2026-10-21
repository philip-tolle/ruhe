import { test, expect, afterEach, vi } from 'vitest'
import { AudioEngine } from '../../src/lib/audio/engine'
import { createOutput, type Output } from '../../src/lib/audio/output'
import { breathProgram, timerProgram, type ProgramSpec } from '../../src/lib/audio/program'
import { scheduleCue } from '../../src/lib/audio/cue'
import { assetUrl } from '../../src/lib/sounds/catalog'
import type { SessionResult } from '../../src/lib/stats/schema'

type Loader = (ctx: BaseAudioContext, url: string) => Promise<AudioBuffer>

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
// Für Tests, in denen der Inhalt egal ist: 1 s Stille statt Laden und Dekodieren der Aufnahme.
const synthetic: Loader = async ctx => ctx.createBuffer(2, ctx.sampleRate, ctx.sampleRate)
let out: Output | undefined
let engine: AudioEngine | undefined
function make(load: Loader = synthetic) {
  engine = new AudioEngine({ createOutput: () => (out = createOutput()), load })
  return engine
}
// Zurücksetzen, damit Tests ohne Engine (OfflineAudioContext) nichts doppelt schließen.
afterEach(async () => {
  await engine?.stopAll()
  await out?.ctx.close()
  engine = undefined
  out = undefined
})

// Sammelt die gemeldeten Sitzungsergebnisse.
function results(e: AudioEngine): SessionResult[] {
  const seen: SessionResult[] = []
  e.onSessionEnd(r => seen.push(r))
  return seen
}

const spec = (over: Partial<ProgramSpec> = {}): ProgramSpec => ({
  kind: 'timer', ref: 'timer', title: 'Meditation · 1 Min', lead: 0.2, length: 1, finish: 1.5, background: null,
  schedule: vi.fn(() => vi.fn()), ...over,
})

test('program stops running sounds and reports its title', async () => {
  const urls: string[] = []
  const e = make((ctx, url) => { urls.push(url); return synthetic(ctx, url) })
  await e.toggle('regen')
  const s = spec()
  await e.startProgram(s)
  expect(e.snapshot().volumes).toEqual({})
  expect(e.snapshot()).toMatchObject({ state: 'playing', program: { title: 'Meditation · 1 Min', ended: false } })
  expect(navigator.mediaSession.metadata?.title).toBe('Meditation · 1 Min')
  // Die Klangschale kommt über den Loader; eingeplant wird auf einem eigenen Gain.
  expect(urls).toContain(assetUrl('audio/sounds/klangschale.ogg'))
  expect(s.schedule).toHaveBeenCalledTimes(1)
  expect(s.schedule).toHaveBeenCalledWith(out!.ctx, expect.any(GainNode), expect.any(Number), { strike: expect.any(AudioBuffer) })
})

test('natural end reports the planned length', async () => {
  const e = make()
  const seen = results(e)
  let endedSeen = false
  const off = e.subscribe(s => { if (s.program?.ended) endedSeen = true })
  await e.startProgram(spec())
  await expect.poll(() => seen.length, { timeout: 4000 }).toBe(1)
  expect(seen[0]).toMatchObject({ kind: 'timer', ref: 'timer', seconds: 1 })
  expect(seen[0].start).toBeInstanceOf(Date)
  await expect.poll(() => e.snapshot().state, { timeout: 4000 }).toBe('idle')
  off()
  expect(e.snapshot().program).toBeNull()
  expect(endedSeen).toBe(true)              // zwischen gezähltem Ende und Ausklingen: ended
  expect(seen).toHaveLength(1)
})

test('pause freezes the program clock and is not counted', async () => {
  const e = make()
  const seen = results(e)
  await e.startProgram(spec({ lead: 0, length: 10, finish: 11 }))
  await wait(400)
  await e.pause()
  const frozen = e.programElapsed()!
  await wait(600)
  expect(e.programElapsed()).toBeCloseTo(frozen, 2)
  await e.resume()
  await wait(300)
  await e.endProgram()
  expect(seen).toHaveLength(1)
  expect(seen[0].seconds).toBeGreaterThan(0.5)
  expect(seen[0].seconds).toBeLessThan(0.95)
})

test('early end inside the lead counts nothing', async () => {
  const e = make()
  const seen = results(e)
  const stop = vi.fn()
  await e.startProgram(spec({ lead: 0.5, schedule: vi.fn(() => stop) }))
  await wait(200)
  await e.endProgram()
  expect(seen).toHaveLength(1)
  expect(seen[0].seconds).toBe(0)
  expect(stop).toHaveBeenCalled()            // eingeplante Klänge verstummen sofort
  expect(e.snapshot()).toMatchObject({ state: 'idle', program: null })
  expect(e.programElapsed()).toBeNull()
})

test('starting a sound ends the running program', async () => {
  const e = make()
  const seen = results(e)
  await e.startProgram(spec())
  await e.toggle('wald')
  expect(e.snapshot().program).toBeNull()
  expect(seen).toHaveLength(1)
  expect(e.snapshot()).toMatchObject({ state: 'playing', volumes: { wald: 0.7 } })
})

test('double start keeps exactly one program', async () => {
  const e = make()
  const seen = results(e)
  const stopA = vi.fn()
  const a = spec({ schedule: vi.fn(() => stopA) }), b = spec({ title: 'B' })
  await Promise.all([e.startProgram(a), e.startProgram(b)])
  expect(e.snapshot().program?.title).toBe('B')
  expect(b.schedule).toHaveBeenCalledTimes(1)
  if (vi.mocked(a.schedule).mock.calls.length > 0) expect(stopA).toHaveBeenCalled()
  expect(seen.length).toBeLessThanOrEqual(1)  // B läuft noch: höchstens A hat gemeldet
})

test('stopAll ends the program and reports once', async () => {
  const e = make()
  const seen = results(e)
  await e.startProgram(spec())
  const finish = out!.ctx.currentTime + 1.6
  await e.stopAll()
  expect(e.snapshot()).toMatchObject({ state: 'idle', program: null })
  expect(seen).toHaveLength(1)
  await e.toggle('regen')                    // die Audio-Uhr läuft über das geplante Ende hinaus weiter
  await expect.poll(() => out!.ctx.currentTime, { timeout: 4000 }).toBeGreaterThan(finish)
  expect(seen).toHaveLength(1)
  expect(e.snapshot()).toMatchObject({ state: 'playing', volumes: { regen: 0.7 } })
})

test('program ignores the sleep timer', async () => {
  const e = make()
  e.setSleepTimer(0.02)                      // 1,2 s
  await e.startProgram(spec({ length: 3, finish: 3.5 }))
  e.setSleepTimer(0.03)                      // während des Programms: nur die Auswahl
  expect(e.snapshot()).toMatchObject({ sleepMinutes: 0.03, remainingSec: null })
  await wait(2000)
  expect(e.snapshot()).toMatchObject({ state: 'playing', remainingSec: null })
  expect(out!.fade.gain.value).toBeCloseTo(1, 3)
})

test('a program resets a running sleep fade', async () => {
  const e = make()
  e.setSleepTimer(0.05)                      // 3 s, Ausblenden ab 0 s
  await e.toggle('regen')
  await expect.poll(() => out!.fade.gain.value, { timeout: 3000 }).toBeLessThan(0.9)
  const oldEnd = out!.ctx.currentTime + e.snapshot().remainingSec!
  await e.startProgram(spec({ length: 5, finish: 5.5 }))
  expect(out!.fade.gain.value).toBe(1)
  // Bis über das alte Sleep-Ende hinaus (Audio-Uhr): Der verworfene Countdown beendet nichts.
  const passedOldEnd = () => e.snapshot().state !== 'playing' || out!.ctx.currentTime > oldEnd + 0.3
  await expect.poll(passedOldEnd, { timeout: 5000 }).toBe(true)
  expect(e.snapshot()).toMatchObject({ state: 'playing', program: { ended: false } })
  expect(out!.fade.gain.value).toBeCloseTo(1, 3)
})

test('background sound plays and fades at finish', async () => {
  const e = make()
  await e.startProgram(spec({ background: 'regen' }))
  expect(e.snapshot().volumes).toEqual({ regen: 0.7 })
  expect(e.voiceCount()).toBe(1)
  await expect.poll(() => e.snapshot().program, { timeout: 4000 }).toBeNull()
  expect(e.snapshot()).toMatchObject({ state: 'idle', volumes: {} })
  expect(e.voiceCount()).toBe(1)             // blendet noch aus
  await expect.poll(() => e.voiceCount(), { timeout: 3000 }).toBe(0)
  await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended')
})

test('a program runs on without bowl and background when they fail to load', async () => {
  const e = make(async (_ctx, url) => { throw new Error('Konnte nicht geladen werden: ' + url) })
  const s = spec({ background: 'regen' })
  await e.startProgram(s)
  expect(s.schedule).toHaveBeenCalledWith(out!.ctx, expect.any(GainNode), expect.any(Number), { strike: null })
  expect(e.snapshot()).toMatchObject({ state: 'playing', errors: ['regen'], volumes: {}, program: { title: 'Meditation · 1 Min' } })
})

test('a failed start keeps the program, and resume plays it from its start', async () => {
  let blocked = true                         // play() wird einmal abgelehnt (Autoplay-Regel)
  engine = new AudioEngine({
    createOutput: () => {
      const o = (out = createOutput())
      const start = o.start
      o.start = () => {
        if (!blocked) return start()
        blocked = false
        return Promise.reject(new DOMException('blockiert', 'NotAllowedError'))
      }
      return o
    },
    load: synthetic,
  })
  const e = engine
  const seen = results(e)
  const s = spec()
  await expect(e.startProgram(s)).rejects.toThrow('blockiert')
  expect(e.snapshot()).toMatchObject({ state: 'paused', needsTap: true, program: { title: 'Meditation · 1 Min' } })
  expect(s.schedule).toHaveBeenCalledTimes(1)
  await e.resume()                           // „Weiter“
  expect(e.snapshot().state).toBe('playing')
  await expect.poll(() => seen.length, { timeout: 4000 }).toBe(1)
  expect(seen[0].seconds).toBe(1)
})

test('timerProgram schedules strikes at the planned times', async () => {
  const ctx = new OfflineAudioContext(1, 44100, 44100)
  const buffer = ctx.createBuffer(1, 4410, 44100)
  const start = vi.spyOn(AudioBufferSourceNode.prototype, 'start')
  try {
    const p = timerProgram({ minutes: 1, intervalMin: null, lead: true, sound: null })
    expect(p).toMatchObject({ kind: 'timer', ref: 'timer', title: 'Meditation · 1 Min', lead: 10, length: 60, finish: 82, background: null })
    const stop = p.schedule(ctx, ctx.destination, 2, { strike: buffer })
    expect(start.mock.calls.map(c => c[0])).toEqual([12, 72, 75, 78])
    stop()
    stop()                                   // schon gestoppte Knoten stören nicht
    start.mockClear()
    p.schedule(ctx, ctx.destination, 0, { strike: null })()
    expect(start).not.toHaveBeenCalled()     // ohne Klangschale läuft der Timer still
    expect(timerProgram({ minutes: 10, intervalMin: 5, lead: false, sound: 'regen' }))
      .toMatchObject({ title: 'Meditation · 10 Min', lead: 0, length: 600, background: 'regen' })
  } finally {
    start.mockRestore()
  }
})

test('breathProgram schedules a cue at every phase', async () => {
  const ctx = new OfflineAudioContext(1, 44100, 44100)
  const start = vi.spyOn(OscillatorNode.prototype, 'start')
  try {
    const p = breathProgram('478', 1)
    p.schedule(ctx, ctx.destination, 0, { strike: null })
    expect(start.mock.calls.map(c => c[0])).toEqual([0, 4, 11, 19, 23, 30, 38, 42, 49, 57, 61, 68])
    const frequencies = (start.mock.contexts as OscillatorNode[]).map(o => o.frequency.value)
    expect(frequencies.slice(0, 3)).toEqual([528, 440, 396]) // ein, halten, aus
    expect(p).toMatchObject({ kind: 'breath', ref: '478', title: 'Atmen · 4-7-8', lead: 0, length: 76, finish: 77, background: null })
  } finally {
    start.mockRestore()
  }
})

test('a cue is a short soft sine tone', async () => {
  const rate = 48000
  const ctx = new OfflineAudioContext(1, rate, rate)
  const osc = scheduleCue(ctx, ctx.destination, 0.1, 'aus')
  expect(osc.type).toBe('sine')
  const data = (await ctx.startRendering()).getChannelData(0)
  const peak = (from: number, to: number) => {
    let max = 0
    for (let i = Math.round(from * rate); i < Math.round(to * rate); i++) max = Math.max(max, Math.abs(data[i]))
    return max
  }
  expect(peak(0, 0.099)).toBe(0)
  expect(peak(0.1, 0.7)).toBeCloseTo(0.15, 2)  // Spitze nach 0,06 s Anstieg
  expect(peak(0.5, 0.52)).toBeLessThan(0.005)  // exponentiell abgeklungen (linear wären es noch etwa 0,05)
  expect(peak(0.71, 1)).toBe(0)                // nach 0,6 s vorbei
})
