import { test, expect, afterEach, vi } from 'vitest'
import { AudioEngine } from '../../src/lib/audio/engine'
import { createOutput, type Output } from '../../src/lib/audio/output'
import { BREATH_BACKGROUND_VOLUME, HACK_TAIL, breathProgram, focusProgram, hackProgram, timerProgram, type ProgramSpec } from '../../src/lib/audio/program'
import { scheduleBreath, type BreathBuffers } from '../../src/lib/audio/breath-sound'
import { scheduleCue } from '../../src/lib/audio/cue'
import { customToPattern } from '../../src/lib/breath/custom'
import { hackById } from '../../src/lib/energy/hacks'
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
  kind: 'timer', ref: 'timer', title: 'Meditation · 1 Min', lead: 0.2, length: 1, finish: 1.5, background: null, assets: ['strike'],
  schedule: vi.fn(() => vi.fn()), ...over,
})

// Eine echte (lautlose) Quelle als Programm-Klang: zeigt, wann sie verstummt und wie laut der
// Gain des Programms gerade ist.
function liveTone() {
  const tone = { gain: null as GainNode | null, playing: false, stops: [] as (number | undefined)[] }
  const schedule: ProgramSpec['schedule'] = (ctx, destination, t0) => {
    tone.gain = destination as GainNode
    const source = ctx.createConstantSource()
    source.offset.value = 0
    source.connect(destination)
    source.onended = () => { tone.playing = false }
    source.start(t0)
    tone.playing = true
    return when => { tone.stops.push(when); source.stop(when) }
  }
  return { tone, schedule }
}

test('program stops running sounds and reports its title', async () => {
  const urls: string[] = []
  const e = make((ctx, url) => { urls.push(url); return synthetic(ctx, url) })
  await e.toggle('regen')
  const s = spec()
  await e.startProgram(s)
  expect(e.snapshot().volumes).toEqual({})
  expect(e.snapshot()).toMatchObject({ state: 'playing', program: { title: 'Meditation · 1 Min', ended: false, noBowl: false } })
  expect(navigator.mediaSession.metadata?.title).toBe('Meditation · 1 Min')
  // Die Klangschale kommt über den Loader; eingeplant wird auf einem eigenen Gain.
  expect(urls).toContain(assetUrl('audio/sounds/klangschale.ogg'))
  expect(s.schedule).toHaveBeenCalledTimes(1)
  expect(s.schedule).toHaveBeenCalledWith(out!.ctx, expect.any(GainNode), expect.any(Number), { strike: expect.any(AudioBuffer), breath: null })
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

// Nach dem gezählten Ende klingt das Programm noch aus (Timer 12 s, Atmen 1 s). Eine Pause darin,
// eigene (Sperrbildschirm) oder von außen (Anruf), beendet die Sitzung: Sie ließe sonst ein schon
// gemeldetes Programm pausiert stehen, mit Benachrichtigung und „Weiter“, das die Schalen wiederholt.
const tail = () => spec({ lead: 0, length: 0.3, finish: 5 })

async function ringingOut(e: AudioEngine) {
  await expect.poll(() => e.snapshot().program?.ended, { timeout: 4000 }).toBe(true)
  expect(e.snapshot().state).toBe('playing')
}

test('pausing while the program rings out ends the session without a second result', async () => {
  const e = make()
  const seen = results(e)
  await e.startProgram(tail())
  await e.pause()                            // in der gezählten Zeit: eine gewöhnliche Pause
  expect(e.snapshot()).toMatchObject({ state: 'paused', program: { ended: false } })
  await e.resume()
  await ringingOut(e)
  expect(seen).toHaveLength(1)
  await e.pause()
  expect(e.snapshot()).toMatchObject({ state: 'idle', program: null })
  expect(navigator.mediaSession.playbackState).toBe('none')
  expect(seen).toHaveLength(1)
  await wait(300)
  expect(seen).toHaveLength(1)
})

test('an interruption of the media element while the program rings out ends the session', async () => {
  const e = make()
  const seen = results(e)
  await e.startProgram(tail())
  await ringingOut(e)
  out!.element.dispatchEvent(new Event('pause')) // simuliert Anruf / andere App
  expect(e.snapshot()).toMatchObject({ state: 'idle', program: null })
  expect(seen).toHaveLength(1)
})

test('a suspension of the audio context while the program rings out ends the session', async () => {
  const e = make()
  const seen = results(e)
  await e.startProgram(tail())
  await ringingOut(e)
  await out!.ctx.suspend()                   // simuliert das System
  await expect.poll(() => e.snapshot().state, { timeout: 3000 }).toBe('idle')
  expect(e.snapshot().program).toBeNull()
  expect(out!.element.paused).toBe(true)
  expect(seen).toHaveLength(1)
})

test('a count that ends just after a pause ends the session instead of leaving it paused', async () => {
  // Das Ende der gezählten Zeit kommt erst nach der Pause an: Hier hält das Anhalten die Uhr nicht an.
  engine = new AudioEngine({
    createOutput: () => {
      const o = (out = createOutput())
      o.suspend = async () => { o.element.pause() }
      return o
    },
    load: synthetic,
  })
  const e = engine
  const seen = results(e)
  await e.startProgram(tail())
  await e.pause()
  expect(e.snapshot()).toMatchObject({ state: 'paused', program: { ended: false } })
  await expect.poll(() => seen.length, { timeout: 4000 }).toBe(1)
  expect(e.snapshot()).toMatchObject({ state: 'idle', program: null })
  expect(seen[0].seconds).toBe(0.3)
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
  const stop = vi.fn()
  const s = spec({ background: 'regen', schedule: vi.fn(() => stop) })
  await e.startProgram(s)
  const gain = vi.mocked(s.schedule).mock.calls[0][1] as GainNode
  expect(e.snapshot().volumes).toEqual({ regen: 0.7 })
  expect(e.voiceCount()).toBe(1)
  await expect.poll(() => e.snapshot().program, { timeout: 4000 }).toBeNull()
  expect(e.snapshot()).toMatchObject({ state: 'idle', volumes: {} })
  expect(e.voiceCount()).toBe(1)             // blendet noch aus
  expect(stop).toHaveBeenCalledWith(expect.any(Number)) // auch die Schalen klingen aus statt abzubrechen
  await expect.poll(() => e.voiceCount(), { timeout: 3000 }).toBe(0)
  await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended')
  expect(gain.gain.value).toBe(0)
})

test('a program background plays at the volume the program asks for', async () => {
  const e = make()
  await e.startProgram(spec({ background: 'regen', backgroundVolume: 0.35 }))
  expect(e.snapshot().volumes).toEqual({ regen: 0.35 })
  expect(e.voiceCount()).toBe(1)
})

test('ending a program fades its sounds out instead of cutting them', async () => {
  const e = make()
  const seen = results(e)
  const { tone, schedule } = liveTone()
  await e.startProgram(spec({ lead: 0, length: 10, finish: 11, schedule }))
  await wait(200)
  const now = out!.ctx.currentTime
  await e.endProgram()
  expect(e.snapshot()).toMatchObject({ state: 'idle', program: null }) // Zustand und Ergebnis sofort, wie bisher
  expect(seen).toHaveLength(1)
  expect(tone.stops).toHaveLength(1)
  expect(tone.stops[0]).toBeCloseTo(now + 0.9, 1)
  await wait(400)
  expect(tone.playing).toBe(true)            // klingt noch, aber leiser
  expect(tone.gain!.gain.value).toBeGreaterThan(0.1)
  expect(tone.gain!.gain.value).toBeLessThan(0.9)
  await expect.poll(() => tone.playing, { timeout: 1500 }).toBe(false)
  expect(tone.gain!.gain.value).toBe(0)
})

test('ending a paused program silences it at once', async () => {
  const e = make()
  const seen = results(e)
  const { tone, schedule } = liveTone()
  await e.startProgram(spec({ lead: 0, length: 10, finish: 11, schedule }))
  await e.pause()
  await e.endProgram()
  expect(e.snapshot()).toMatchObject({ state: 'idle', program: null })
  expect(seen).toHaveLength(1)
  expect(tone.stops).toEqual([undefined])    // sofort: Eine Rampe auf der stehenden Uhr käme erst später
  await e.toggle('regen')                    // die Audio-Uhr läuft wieder: Der Klang kehrt nicht zurück
  await expect.poll(() => tone.playing, { timeout: 1500 }).toBe(false)
})

test('a program runs on without bowl and background when they fail to load', async () => {
  const e = make(async (_ctx, url) => { throw new Error('Konnte nicht geladen werden: ' + url) })
  const s = spec({ background: 'regen' })
  await e.startProgram(s)
  expect(s.schedule).toHaveBeenCalledWith(out!.ctx, expect.any(GainNode), expect.any(Number), { strike: null, breath: null })
  expect(e.snapshot()).toMatchObject({ state: 'playing', errors: ['regen'], volumes: {}, program: { title: 'Meditation · 1 Min' } })
})

test('a timer whose bowl fails to load says so and still runs to its end; a breath program never does', async () => {
  const bowl = assetUrl('audio/sounds/klangschale.ogg')
  const e = make(async (ctx, url) => {
    if (url === bowl) throw new Error('Konnte nicht geladen werden: ' + url)
    return synthetic(ctx, url)
  })
  const seen = results(e)
  const starting = e.startProgram(spec())
  expect(e.snapshot().program).toMatchObject({ noBowl: false }) // lädt noch: noch nicht bekannt
  await starting
  expect(e.snapshot()).toMatchObject({ state: 'playing', program: { kind: 'timer', noBowl: true } })
  await expect.poll(() => seen.length, { timeout: 4000 }).toBe(1)
  expect(seen[0].seconds).toBe(1)
  await e.startProgram(spec({ kind: 'breath', ref: '478', assets: [] })) // eine Atemübung verlangt die Schale nie
  expect(e.snapshot().program).toMatchObject({ kind: 'breath', noBowl: false })
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
    expect(p).toMatchObject({ kind: 'timer', ref: 'timer', title: 'Meditation · 1 Min', lead: 10, length: 60, finish: 85, background: null })
    const stop = p.schedule(ctx, ctx.destination, 2, { strike: buffer, breath: null })
    expect(start.mock.calls.map(c => c[0])).toEqual([12, 72, 75, 78])
    stop()
    stop()                                   // schon gestoppte Knoten stören nicht
    start.mockClear()
    p.schedule(ctx, ctx.destination, 0, { strike: null, breath: null })()
    expect(start).not.toHaveBeenCalled()     // ohne Klangschale läuft der Timer still
    expect(timerProgram({ minutes: 10, intervalMin: 5, lead: false, sound: 'regen' }))
      .toMatchObject({ title: 'Meditation · 10 Min', lead: 0, length: 600, background: 'regen' })
  } finally {
    start.mockRestore()
  }
})

test('stopping a program lets a ringing strike end on time and drops those still to come', async () => {
  const rate = 8000
  const ctx = new OfflineAudioContext(1, rate * 80, rate)
  const strike = ctx.createBuffer(1, rate * 5, rate)
  strike.getChannelData(0).fill(1)           // 5 s Gleichpegel 1: leicht nachzumessen
  const stop = timerProgram({ minutes: 1, intervalMin: null, lead: true, sound: null })
    .schedule(ctx, ctx.destination, 0, { strike, breath: null })
  // Schalen bei 10, 70, 73 und 76 s. Bei 72,5 s endet das Programm und klingt bis 74 s aus.
  void ctx.suspend(72.5).then(() => { stop(74); return ctx.resume() })
  const data = (await ctx.startRendering()).getChannelData(0)
  const peak = (from: number, to: number) => {
    let max = 0
    for (let i = Math.round(from * rate); i < Math.round(to * rate); i++) max = Math.max(max, Math.abs(data[i]))
    return max
  }
  expect(peak(70.1, 72.4)).toBe(1)
  expect(peak(73.1, 73.9)).toBe(1)           // klingt weiter, allein: Die Schale bei 73 s setzt nicht mehr ein
  expect(peak(74.1, 80)).toBe(0)             // ab 74 s still, auch keine Schale bei 76 s
})

// Atemgeräusche zum Nachmessen: Gleichpegel 1, Einatmen 3,6 s, Ausatmen 6,3 s.
function breathBuffers(ctx: BaseAudioContext): BreathBuffers {
  const filled = (seconds: number) => {
    const buffer = ctx.createBuffer(1, Math.round(seconds * ctx.sampleRate), ctx.sampleRate)
    buffer.getChannelData(0).fill(1)
    return buffer
  }
  return { ein: filled(3.6), aus: filled(6.3) }
}

function peakOf(data: Float32Array, rate: number) {
  return (from: number, to: number) => {
    let max = 0
    for (let i = Math.round(from * rate); i < Math.min(data.length, Math.round(to * rate)); i++) max = Math.max(max, Math.abs(data[i]))
    return max
  }
}

test('a breath sound rises to its gain and is silent at the end of its phase', async () => {
  const rate = 48000
  async function render(kind: 'ein' | 'aus', length: number) {
    const ctx = new OfflineAudioContext(1, rate * 10, rate)
    const source = scheduleBreath(ctx, ctx.destination, 0.1, kind, length, breathBuffers(ctx))
    const peak = peakOf((await ctx.startRendering()).getChannelData(0), rate)
    return { rate: source!.playbackRate.value, peak }
  }
  const inhale = await render('ein', 4)
  expect(inhale.rate).toBeCloseTo(0.9, 5)
  expect(inhale.peak(0.1, 4.1)).toBeCloseTo(0.25, 2)
  expect(inhale.peak(4.1, 10)).toBe(0)

  const sigh = await render('ein', 1)                 // Nachatmen
  expect(sigh.rate).toBeCloseTo(1.25, 5)
  expect(sigh.peak(0.1, 1.1)).toBeCloseTo(0.25, 2)
  expect(sigh.peak(1.1, 10)).toBe(0)

  const long = await render('ein', 5.5)               // langsamer geht es nicht: endet nach 4,8 s
  expect(long.rate).toBeCloseTo(0.75, 5)
  expect(long.peak(0.1, 4.9)).toBeCloseTo(0.25, 2)
  expect(long.peak(4.9, 10)).toBe(0)

  const exhale = await render('aus', 8)
  expect(exhale.rate).toBeCloseTo(0.7875, 4)
  expect(exhale.peak(0.1, 8.1)).toBeCloseTo(0.21, 2)
  expect(exhale.peak(8.1, 10)).toBe(0)

  const ctx = new OfflineAudioContext(1, rate, rate)
  expect(scheduleBreath(ctx, ctx.destination, 0, 'halten', 7, breathBuffers(ctx))).toBeNull()
})

test('breathProgram plays a breath sound at every in and out phase', async () => {
  const ctx = new OfflineAudioContext(1, 44100, 44100)
  const start = vi.spyOn(AudioBufferSourceNode.prototype, 'start')
  try {
    const p = breathProgram('478', 1, { sound: true, background: null })
    expect(p).toMatchObject({ kind: 'breath', ref: '478', title: 'Atmen · 4-7-8', lead: 0, length: 76, finish: 77, background: null, assets: ['breath'] })
    p.schedule(ctx, ctx.destination, 0, { strike: null, breath: breathBuffers(ctx) })
    expect(start.mock.calls.map(c => c[0])).toEqual([0, 11, 19, 30, 38, 49, 57, 68])
    const rates = (start.mock.contexts as AudioBufferSourceNode[]).map(s => Math.round(s.playbackRate.value * 10000) / 10000)
    expect(rates).toEqual([0.9, 0.7875, 0.9, 0.7875, 0.9, 0.7875, 0.9, 0.7875])
  } finally {
    start.mockRestore()
  }
})

test('the sigh gives its 1 s Nachatmen a short sound of its own', async () => {
  const ctx = new OfflineAudioContext(1, 44100, 44100)
  const start = vi.spyOn(AudioBufferSourceNode.prototype, 'start')
  try {
    breathProgram('seufzer', 1, { sound: true, background: null }).schedule(ctx, ctx.destination, 0, { strike: null, breath: breathBuffers(ctx) })
    expect(start.mock.calls.slice(0, 3).map(c => c[0])).toEqual([0, 3, 4])
    const rates = (start.mock.contexts as AudioBufferSourceNode[]).slice(0, 3).map(s => Math.round(s.playbackRate.value * 10000) / 10000)
    expect(rates).toEqual([1.2, 1.25, 1.05])
  } finally {
    start.mockRestore()
  }
})

test('with the breath sound off a breath program loads and schedules nothing', async () => {
  const ctx = new OfflineAudioContext(1, 44100, 44100)
  const start = vi.spyOn(AudioBufferSourceNode.prototype, 'start')
  try {
    const p = breathProgram('box', 1, { sound: false, background: null })
    expect(p.assets).toEqual([])
    p.schedule(ctx, ctx.destination, 0, { strike: null, breath: null })()
    // Auch mit Atemgeräusch, aber ohne geladene Dateien bleibt es still.
    breathProgram('box', 1, { sound: true, background: null }).schedule(ctx, ctx.destination, 0, { strike: null, breath: null })()
    expect(start).not.toHaveBeenCalled()
  } finally {
    start.mockRestore()
  }
})

test('ending a breath program mid-exhale stops the sounding breath at the fade and drops the ones to come', async () => {
  const rate = 8000
  const ctx = new OfflineAudioContext(1, rate * 30, rate)
  const stop = breathProgram('478', 1, { sound: true, background: null }).schedule(ctx, ctx.destination, 0, { strike: null, breath: breathBuffers(ctx) })
  // Ausatmen ab 11 s (8 s lang). Bei 13 s endet das Programm und klingt bis 13,5 s aus.
  void ctx.suspend(13).then(() => { stop(13.5); return ctx.resume() })
  const peak = peakOf((await ctx.startRendering()).getChannelData(0), rate)
  expect(peak(12, 12.9)).toBeGreaterThan(0.2)
  expect(peak(13.5, 30)).toBe(0)                     // still ab 13,5 s, auch kein Einatmen bei 19 s
})

test('a breath program never loads the bowl and runs on silently when its breath files fail', async () => {
  const urls: string[] = []
  const e = make(async (_ctx, url) => {
    urls.push(url)
    throw new Error('Konnte nicht geladen werden: ' + url)
  })
  const seen = results(e)
  const p = breathProgram('box', 1, { sound: true, background: null })
  const schedule = vi.spyOn(p, 'schedule')
  await e.startProgram({ ...p, length: 1, finish: 1.5, schedule })
  expect(urls.sort()).toEqual([assetUrl('audio/breath/aus.ogg'), assetUrl('audio/breath/ein.ogg')])
  expect(schedule).toHaveBeenCalledWith(out!.ctx, expect.any(GainNode), expect.any(Number), { strike: null, breath: null })
  await expect.poll(() => seen.length, { timeout: 4000 }).toBe(1)
  expect(seen[0]).toMatchObject({ kind: 'breath', ref: 'box', seconds: 1 })
})

test('a breath program carries its background, quieter under the breath sound and as usual without it', () => {
  expect(BREATH_BACKGROUND_VOLUME).toBe(0.35)
  expect(breathProgram('box', 3, { sound: true, background: 'regen' })).toMatchObject({ background: 'regen', backgroundVolume: 0.35, assets: ['breath'] })
  expect(breathProgram('478', 1, { sound: true, background: 'klavier' })).toMatchObject({ background: 'klavier', backgroundVolume: 0.35 })
  const silent = breathProgram('box', 3, { sound: false, background: 'meer' })
  expect(silent).toMatchObject({ background: 'meer', assets: [] })
  expect(silent.backgroundVolume).toBeUndefined()
  expect(breathProgram('box', 3, { sound: true, background: null }).background).toBeNull()
})

test('a breath exercise with a background plays it under the breath, and at the usual volume without breath sound', async () => {
  const e = make()
  await e.startProgram(breathProgram('box', 1, { sound: true, background: 'regen' }))
  expect(e.snapshot()).toMatchObject({ state: 'playing', program: { title: 'Atmen · Box-Atmung' }, volumes: { regen: 0.35 } })
  await e.startProgram(breathProgram('box', 1, { sound: false, background: 'wald' }))
  expect(e.snapshot().volumes).toEqual({ wald: 0.7 })
})

test('breathProgram with an own pattern: its id as ref, its name in the title, whole cycles', () => {
  const pattern = customToPattern({ id: 'eigen-0123abcd', name: 'Abendruhe', inhale: 4, holdIn: 2, exhale: 6, holdOut: 0 })
  const p = breathProgram(pattern, 1, { sound: true, background: null })
  expect([p.kind, p.ref, p.title, p.length, p.finish]).toEqual(['breath', 'eigen-0123abcd', 'Atmen · Abendruhe', 60, 61])
})

// Brain Hacks und Fokus-Sprints: Hinweistöne (Oszillator) und Klangschalen (Aufnahme) lassen sich
// über ihre Quellen auseinanderhalten.
const hack = (id: string) => hackById(id)!

test('scheduleCue plays a short quiet sine at 660 Hz and is silent before and after', async () => {
  const rate = 8000
  const ctx = new OfflineAudioContext(1, rate, rate)
  const node = scheduleCue(ctx, ctx.destination, 0.2)
  expect(node).toBeInstanceOf(OscillatorNode)
  expect(node.type).toBe('sine')
  expect(node.frequency.value).toBe(660)
  const peak = peakOf((await ctx.startRendering()).getChannelData(0), rate)
  expect(peak(0, 0.2)).toBe(0)
  expect(peak(0.2, 0.2 + 0.25)).toBeGreaterThan(0.06)
  expect(peak(0.2, 0.2 + 0.25)).toBeLessThanOrEqual(0.08)
  expect(peak(0.2, 0.2 + 0.002)).toBeLessThan(0.01)     // 20 ms Anstieg: kein Knacken zu Beginn
  expect(peak(0.2 + 0.26, 1)).toBe(0)
})

test('hackProgram plays a cue at every step change and a bowl at the end', () => {
  const ctx = new OfflineAudioContext(1, 44100, 44100)
  const cues = vi.spyOn(OscillatorNode.prototype, 'start')
  const bowls = vi.spyOn(AudioBufferSourceNode.prototype, 'start')
  try {
    const p = hackProgram(hack('bewegungs-snack'))
    expect(p).toMatchObject({ kind: 'hack', ref: 'bewegungs-snack', title: 'Bewegungs-Snack', lead: 0, length: 120, finish: 128, background: null, assets: ['strike'] })
    expect(HACK_TAIL).toBe(8)
    expect(p.note).toBeUndefined()
    p.schedule(ctx, ctx.destination, 2, { strike: ctx.createBuffer(1, 4410, 44100), breath: null })
    expect(cues.mock.calls.map(c => c[0])).toEqual([32, 62, 92])
    expect(bowls.mock.calls.map(c => c[0])).toEqual([122])
  } finally {
    cues.mockRestore()
    bowls.mockRestore()
  }
})

test('hackProgram of a breathing hack has no cues, only the bowl, and whole cycles as length', () => {
  const ctx = new OfflineAudioContext(1, 44100, 44100)
  const cues = vi.spyOn(OscillatorNode.prototype, 'start')
  const bowls = vi.spyOn(AudioBufferSourceNode.prototype, 'start')
  try {
    const p = hackProgram(hack('seufzer'))
    expect(p).toMatchObject({ kind: 'hack', ref: 'seufzer', length: 64, finish: 72 })
    p.schedule(ctx, ctx.destination, 0, { strike: ctx.createBuffer(1, 4410, 44100), breath: null })
    expect(cues).not.toHaveBeenCalled()
    expect(bowls.mock.calls.map(c => c[0])).toEqual([64])
  } finally {
    cues.mockRestore()
    bowls.mockRestore()
  }
})

test('hackProgram still plays its cues when the bowl is missing', () => {
  const ctx = new OfflineAudioContext(1, 44100, 44100)
  const cues = vi.spyOn(OscillatorNode.prototype, 'start')
  const bowls = vi.spyOn(AudioBufferSourceNode.prototype, 'start')
  try {
    hackProgram(hack('bewegungs-snack')).schedule(ctx, ctx.destination, 0, { strike: null, breath: null })()
    expect(cues.mock.calls.map(c => c[0])).toEqual([30, 60, 90])
    expect(bowls).not.toHaveBeenCalled()
  } finally {
    cues.mockRestore()
    bowls.mockRestore()
  }
})

test('stopping a hack program drops the cues still to come', async () => {
  const rate = 8000
  const ctx = new OfflineAudioContext(1, rate * 100, rate)
  const stop = hackProgram(hack('bewegungs-snack')).schedule(ctx, ctx.destination, 0, { strike: null, breath: null })
  // Hinweistöne bei 30, 60 und 90 s. Bei 45 s endet das Programm: Der bei 60 s und der bei 90 s entfallen.
  void ctx.suspend(45).then(() => { stop(46); return ctx.resume() })
  const peak = peakOf((await ctx.startRendering()).getChannelData(0), rate)
  expect(peak(30, 30.3)).toBeGreaterThan(0.06)
  expect(peak(60, 100)).toBe(0)
})

test('focusProgram carries sprint length, note and bowls at the end', () => {
  const ctx = new OfflineAudioContext(1, 44100, 44100)
  const bowls = vi.spyOn(AudioBufferSourceNode.prototype, 'start')
  const cues = vi.spyOn(OscillatorNode.prototype, 'start')
  try {
    const p = focusProgram(25, 'regen', 'X')
    expect(p).toMatchObject({ kind: 'focus', ref: 'focus-25', title: 'Fokus-Sprint · 25 Min', lead: 0, length: 1500, finish: 1515, background: 'regen', assets: ['strike'], note: 'X' })
    expect(p.backgroundVolume).toBeUndefined()
    p.schedule(ctx, ctx.destination, 2, { strike: ctx.createBuffer(1, 4410, 44100), breath: null })
    expect(bowls.mock.calls.map(c => c[0])).toEqual([1502, 1505, 1508])
    expect(cues).not.toHaveBeenCalled()
    bowls.mockClear()
    p.schedule(ctx, ctx.destination, 0, { strike: null, breath: null })()
    expect(bowls).not.toHaveBeenCalled()     // ohne Klangschale läuft der Sprint still
    expect(focusProgram(90, null, 'Konzept')).toMatchObject({ ref: 'focus-90', title: 'Fokus-Sprint · 90 Min', length: 5400, finish: 5415, background: null, note: 'Konzept' })
  } finally {
    bowls.mockRestore()
    cues.mockRestore()
  }
})

test('an early ended sprint reports its kind, ref and note; other programs carry no note', async () => {
  const e = make()
  const seen = results(e)
  await e.startProgram(focusProgram(25, 'regen', 'X'))
  expect(e.snapshot()).toMatchObject({ state: 'playing', program: { kind: 'focus', title: 'Fokus-Sprint · 25 Min', noBowl: false, note: 'X' }, volumes: { regen: 0.7 } })
  await wait(200)
  await e.endProgram()
  expect(seen).toHaveLength(1)
  expect(seen[0]).toMatchObject({ kind: 'focus', ref: 'focus-25', note: 'X' })
  expect(seen[0].seconds).toBeGreaterThan(0)
  expect(seen[0].seconds).toBeLessThan(25 * 60)
  await e.startProgram(spec())
  expect('note' in e.snapshot().program!).toBe(false) // die Notiz im Snapshot (der Sprint-Player zeigt sie) gibt es nur mit Notiz
  await e.endProgram()
  expect(seen).toHaveLength(2)
  expect(seen[1]).toMatchObject({ kind: 'timer', ref: 'timer' })
  expect('note' in seen[1]).toBe(false)
})

test('a hack and a sprint whose bowl fails to load say so and still run', async () => {
  const bowl = assetUrl('audio/sounds/klangschale.ogg')
  const e = make(async (ctx, url) => {
    if (url === bowl) throw new Error('Konnte nicht geladen werden: ' + url)
    return synthetic(ctx, url)
  })
  await e.startProgram(hackProgram(hack('bewegungs-snack')))
  expect(e.snapshot()).toMatchObject({ state: 'playing', program: { kind: 'hack', ref: 'bewegungs-snack', noBowl: true } })
  await e.startProgram(focusProgram(50, null, ''))
  expect(e.snapshot()).toMatchObject({ state: 'playing', program: { kind: 'focus', noBowl: true } })
  const ok = make()
  await ok.startProgram(hackProgram(hack('seufzer')))
  expect(ok.snapshot().program).toMatchObject({ kind: 'hack', noBowl: false })
})
