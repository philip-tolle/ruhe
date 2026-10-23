import { test, expect, afterEach, beforeAll, beforeEach, vi, type MockInstance } from 'vitest'
import { AudioEngine, type GuidedSpec } from '../../src/lib/audio/engine'
import { createOutput, type Output } from '../../src/lib/audio/output'
import type { ProgramSpec } from '../../src/lib/audio/program'
import type { SessionResult } from '../../src/lib/stats/schema'
import { toneUrl } from './wav'

type Loader = (ctx: BaseAudioContext, url: string) => Promise<AudioBuffer>

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
// Für die Klänge (Hintergrund, Klangschale) reicht 1 s Stille statt Laden und Dekodieren.
const synthetic: Loader = async ctx => ctx.createBuffer(2, ctx.sampleRate, ctx.sampleRate)

// Die Stimme: 3 s Sinuston 440 Hz, im Test gerendert und als 16-Bit-PCM-WAV gestreamt.
const SECONDS = 3
let tone = ''
beforeAll(async () => {
  tone = await toneUrl(SECONDS)
})

let out: Output | undefined
let engine: AudioEngine | undefined
function make(load: Loader = synthetic) {
  engine = new AudioEngine({ createOutput: () => (out = createOutput()), load })
  return engine
}

// Das Stimm-Element erzeugt die Engine selbst; der Test findet es über sein play().
const realPlay = HTMLMediaElement.prototype.play
let play: MockInstance<HTMLMediaElement['play']>
beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, 'play')
})
function voice(): HTMLAudioElement {
  const elements = (play.mock.contexts as HTMLAudioElement[]).filter(el => el !== out?.element)
  expect(elements.length).toBeGreaterThan(0)
  return elements[elements.length - 1]
}

afterEach(async () => {
  await engine?.stopAll()
  await out?.ctx.close()
  play.mockRestore()
  engine = undefined
  out = undefined
})

function results(e: AudioEngine): SessionResult[] {
  const seen: SessionResult[] = []
  e.onSessionEnd(r => seen.push(r))
  return seen
}

const spec = (over: Partial<GuidedSpec> = {}): GuidedSpec => ({
  id: 'probe', title: 'Probe', url: tone, background: null, backgroundVolume: 0.35, ...over,
})

const timer = (): ProgramSpec => ({
  kind: 'timer', ref: 'timer', title: 'Meditation · 1 Min', lead: 0, length: 10, finish: 11, background: null,
  schedule: vi.fn(() => vi.fn()),
})

// Wartet, bis die Stimme mindestens `seconds` gespielt hat (Position des Elements).
async function heard(e: AudioEngine, seconds: number) {
  await expect.poll(() => e.programElapsed() ?? 0, { timeout: 4000 }).toBeGreaterThan(seconds)
}

async function lengthKnown(e: AudioEngine): Promise<number> {
  await expect.poll(() => e.snapshot().program?.length ?? 0, { timeout: 4000 }).toBeGreaterThan(SECONDS - 0.1)
  return e.snapshot().program!.length
}

test('guided session plays through the mixer and reports once', async () => {
  const e = make()
  const seen = results(e)
  const states: string[] = []
  const off = e.subscribe(s => states.push(s.state))
  await e.startGuided(spec())
  expect(e.snapshot()).toMatchObject({
    state: 'playing', volumes: {},
    program: { kind: 'guided', ref: 'probe', title: 'Probe', lead: 0, ended: false, noBowl: false, error: false },
  })
  const element = voice()
  expect(element.preload).toBe('auto')
  expect(element.isConnected).toBe(false)    // nicht im DOM
  const length = await lengthKnown(e)
  expect(length).toBeCloseTo(SECONDS, 1)
  expect(e.snapshot().program!.finish).toBe(length)

  // Der Ton kommt im Mischpult an (Eingang des Outputs), nicht direkt aus dem Element.
  const analyser = out!.ctx.createAnalyser()
  out!.input.connect(analyser)
  const data = new Float32Array(analyser.fftSize)
  const level = () => {
    analyser.getFloatTimeDomainData(data)
    return data.reduce((max, v) => Math.max(max, Math.abs(v)), 0)
  }
  await expect.poll(level, { timeout: 3000 }).toBeGreaterThan(0.1)
  expect(e.programElapsed()).toBe(element.currentTime)

  await expect.poll(() => seen.length, { timeout: 6000 }).toBe(1)
  off()
  expect(seen[0]).toMatchObject({ kind: 'guided', ref: 'probe' })
  expect(seen[0].start).toBeInstanceOf(Date)
  expect(seen[0].seconds).toBeGreaterThan(SECONDS - 0.2)
  expect(seen[0].seconds).toBeLessThanOrEqual(length)
  expect(e.snapshot()).toMatchObject({ state: 'idle', program: null })
  expect(e.programElapsed()).toBeNull()
  // Am Ende hält das Element selbst an: Das ist keine Unterbrechung.
  expect(states).not.toContain('paused')
  expect(element.getAttribute('src')).toBeNull() // Stream freigegeben
  await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended')
  await wait(300)
  expect(seen).toHaveLength(1)
}, 15000)

test('result counts the played ranges, not wall time', async () => {
  const e = make()
  const seen = results(e)
  const t0 = performance.now()
  await e.startGuided(spec())
  await heard(e, 0.8)
  await e.pause()                            // Wanduhr läuft weiter, gehört wird nichts
  await wait(1000)
  await e.resume()
  await heard(e, 2.4)
  // Gesperrter Bildschirm: JS hängt, das ended-Ereignis kommt erst lange nach dem Ende an.
  const until = performance.now() + 1500
  while (performance.now() < until) { /* blockiert */ }
  await expect.poll(() => seen.length, { timeout: 4000 }).toBe(1)
  expect(performance.now() - t0).toBeGreaterThan(SECONDS + 2)
  expect(seen[0].seconds).toBeGreaterThan(SECONDS - 0.2)
  expect(seen[0].seconds).toBeLessThanOrEqual(SECONDS + 0.01)
}, 15000)

test('seeking clamps and skipped parts do not count', async () => {
  const e = make()
  const seen = results(e)
  e.seek(15)                                 // ohne Sitzung: nichts
  await e.startProgram(timer())
  e.seek(15)                                 // während eines Programms: nichts
  expect(e.programElapsed()!).toBeLessThan(1)
  await e.startGuided(spec())
  expect(seen).toHaveLength(1)               // das Programm hat gemeldet
  const length = await lengthKnown(e)
  await heard(e, 0.5)
  const before = e.programElapsed()!
  e.seek(-15)
  expect(e.programElapsed()).toBe(0)         // nicht vor den Anfang
  expect(e.snapshot().program!.elapsed).toBe(0)
  e.seek(15)
  e.seek(15)
  e.seek(15)                                 // mehrfach schnell: nie über das Ende
  expect(e.programElapsed()!).toBeCloseTo(length - 0.25, 2)
  expect(e.snapshot().program!.elapsed).toBeCloseTo(length - 0.25, 2)
  await expect.poll(() => seen.length, { timeout: 3000 }).toBe(2)
  // Gehört: der Anfang bis zum Zurückspulen und die letzten 0,25 s.
  expect(seen[1]).toMatchObject({ kind: 'guided', ref: 'probe' })
  expect(seen[1].seconds).toBeGreaterThan(before + 0.2)
  expect(seen[1].seconds).toBeLessThan(before + 0.6)
  e.seek(-15)                                // nach dem Ende: nichts
  expect(e.snapshot().program).toBeNull()
  await wait(300)
  expect(seen).toHaveLength(2)
}, 15000)

test('pause pauses the voice element and the clock', async () => {
  const e = make()
  const seen = results(e)
  await e.startGuided(spec())
  await heard(e, 0.3)
  const element = voice()
  await e.pause()
  expect(element.paused).toBe(true)
  expect(e.snapshot()).toMatchObject({ state: 'paused', program: { ended: false } })
  await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended')
  const frozen = e.programElapsed()!
  await wait(500)
  expect(e.programElapsed()).toBe(frozen)
  await e.resume()
  expect(element.paused).toBe(false)
  await wait(300)                            // das eigene pause-Ereignis ist keine Unterbrechung
  expect(e.snapshot().state).toBe('playing')
  expect(e.programElapsed()!).toBeGreaterThan(frozen + 0.1)

  element.pause()                            // das System hält die Stimme an (Anruf)
  await expect.poll(() => e.snapshot().state, { timeout: 3000 }).toBe('paused')
  await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended')
  expect(out!.element.paused).toBe(true)
  await e.resume()
  expect(e.snapshot().state).toBe('playing')
  expect(element.paused).toBe(false)

  out!.element.pause()                       // Unterbrechung über den Anker: auch die Stimme steht
  await expect.poll(() => e.snapshot().state, { timeout: 3000 }).toBe('paused')
  expect(element.paused).toBe(true)
  const held = e.programElapsed()!
  await wait(300)
  expect(e.programElapsed()).toBe(held)
  await e.resume()
  expect(element.paused).toBe(false)
  expect(seen).toHaveLength(0)
}, 15000)

test('starting a sound ends the guided session', async () => {
  const e = make()
  const seen = results(e)
  await e.startGuided(spec())
  await heard(e, 0.3)
  const first = voice()
  await e.toggle('regen')
  expect(e.snapshot()).toMatchObject({ state: 'playing', program: null, volumes: { regen: 0.7 } })
  expect(seen).toHaveLength(1)
  expect(seen[0]).toMatchObject({ kind: 'guided', ref: 'probe' })
  expect(seen[0].seconds).toBeGreaterThan(0.2)
  expect(seen[0].seconds).toBeLessThan(1.5)
  // Die Stimme blendet aus (Audio-Uhr), danach ist ihr Element angehalten und freigegeben.
  await expect.poll(() => first.getAttribute('src'), { timeout: 3000 }).toBeNull()
  expect(first.paused).toBe(true)

  // Jede neue Sitzung beendet die laufende, mit genau einem Ergebnis.
  await e.startGuided(spec({ id: 'zwei' }))
  expect(e.snapshot()).toMatchObject({ volumes: {}, program: { ref: 'zwei' } })
  await e.startProgram(timer())
  await e.startGuided(spec({ id: 'drei' }))
  await e.startGuided(spec({ id: 'vier' }))
  expect(seen.map(r => r.ref)).toEqual(['probe', 'zwei', 'timer', 'drei'])
  await e.endProgram()
  expect(seen.map(r => r.ref)).toEqual(['probe', 'zwei', 'timer', 'drei', 'vier'])
  expect(e.snapshot()).toMatchObject({ state: 'idle', program: null })
  await wait(300)
  expect(seen).toHaveLength(5)
}, 15000)

test('ending a guided session fades the voice out and then frees it', async () => {
  const e = make()
  await e.startGuided(spec())
  await heard(e, 0.3)
  const first = voice()
  await e.endProgram()
  expect(e.snapshot()).toMatchObject({ state: 'idle', program: null })
  expect(first.paused).toBe(false)           // klingt auf der Audio-Uhr aus, statt abzubrechen …
  expect(first.getAttribute('src')).not.toBeNull()
  await expect.poll(() => first.getAttribute('src'), { timeout: 3000 }).toBeNull() // … dann frei
  expect(first.paused).toBe(true)

  // Pausiert beendet: sofort frei (eine Rampe auf der stehenden Uhr käme erst nach dem Fortsetzen).
  await e.startGuided(spec({ id: 'zwei' }))
  await heard(e, 0.3)
  const second = voice()
  await e.pause()
  await e.endProgram()
  expect(second.paused).toBe(true)
  expect(second.getAttribute('src')).toBeNull()

  // Hält die Uhr an, bevor das Ausblenden durch ist, käme die Marke nie: Das Element ist trotzdem frei.
  await e.startGuided(spec({ id: 'drei' }))
  await heard(e, 0.3)
  const third = voice()
  await e.endProgram()
  await out!.ctx.suspend()
  await expect.poll(() => third.getAttribute('src'), { timeout: 600 }).toBeNull()
  expect(third.paused).toBe(true)
}, 15000)

test('a refused voice start pauses with a tap hint, and resume plays the voice', async () => {
  let refuse = true                          // play() der Stimme wird einmal abgelehnt (Autoplay-Regel)
  play.mockImplementation(function (this: HTMLMediaElement) {
    if (this === out?.element || !refuse) return realPlay.call(this)
    refuse = false
    return Promise.reject(new DOMException('blockiert', 'NotAllowedError'))
  })
  const e = make()
  const seen = results(e)
  await expect(e.startGuided(spec())).rejects.toThrow('blockiert')
  expect(e.snapshot()).toMatchObject({ state: 'paused', needsTap: true, program: { kind: 'guided', error: false } })
  await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended')
  expect(out!.element.paused).toBe(true)
  await e.resume()                           // „Weiter“
  expect(e.snapshot()).toMatchObject({ state: 'playing', needsTap: false })
  expect(voice().paused).toBe(false)
  await heard(e, 0.3)
  expect(seen).toHaveLength(0)
}, 15000)

test('a load error is reported in the snapshot', async () => {
  const e = make()
  const seen = results(e)
  await expect(e.startGuided(spec({ url: '/__missing__.mp3', background: 'regen' }))).resolves.toBeUndefined()
  await expect.poll(() => e.snapshot().program?.error, { timeout: 5000 }).toBe(true)
  expect(e.snapshot()).toMatchObject({ state: 'paused', needsTap: false, program: { kind: 'guided', length: 0, elapsed: 0, ended: false } })
  await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended') // auch der Hintergrund steht
  expect(seen).toHaveLength(0)

  const retrying = e.retryGuided()            // „Erneut versuchen“
  expect(e.snapshot()).toMatchObject({ state: 'playing', program: { error: false } })
  await retrying
  await expect.poll(() => e.snapshot().program?.error, { timeout: 5000 }).toBe(true) // wieder 404
  expect(e.snapshot().state).toBe('paused')
  const resuming = e.resume()                 // „Weiter“ (auch aus der Benachrichtigung) versucht es ebenso neu
  expect(e.snapshot()).toMatchObject({ state: 'playing', program: { error: false } })
  await resuming
  await expect.poll(() => e.snapshot().program?.error, { timeout: 5000 }).toBe(true)

  await e.endProgram()
  expect(seen).toHaveLength(1)
  expect(seen[0]).toMatchObject({ kind: 'guided', ref: 'probe', seconds: 0 })
  expect(e.snapshot()).toMatchObject({ state: 'idle', program: null })
}, 20000)

test('retry after a load error continues at the last position and keeps what was heard', async () => {
  const e = make()
  const seen = results(e)
  await e.startGuided(spec())
  await heard(e, 1)
  const element = voice()
  element.dispatchEvent(new Event('error'))  // Netz weg mitten im Stream
  expect(e.snapshot()).toMatchObject({ state: 'paused', program: { error: true } })
  expect(element.paused).toBe(true)
  const at = e.programElapsed()!
  await e.retryGuided()
  expect(e.snapshot()).toMatchObject({ state: 'playing', program: { error: false } })
  expect(e.programElapsed()!).toBeGreaterThanOrEqual(at - 0.05) // kein Sprung an den Anfang
  await expect.poll(() => element.readyState, { timeout: 3000 }).toBeGreaterThanOrEqual(1)
  expect(element.currentTime).toBeGreaterThanOrEqual(at - 0.05)
  await expect.poll(() => seen.length, { timeout: 5000 }).toBe(1)
  // Vor und nach dem Neuladen Gehörtes zählt zusammen.
  expect(seen[0].seconds).toBeGreaterThan(SECONDS - 0.3)
  expect(seen[0].seconds).toBeLessThanOrEqual(SECONDS + 0.01)
}, 15000)

test('after a retry in the same task as the error, a pause from outside is still an interruption', async () => {
  const e = make()
  await e.startGuided(spec())
  await heard(e, 0.3)
  const element = voice()
  // Fehler und „Erneut versuchen“ in einer Aufgabe: Das pause-Ereignis des eigenen Anhaltens steht noch
  // aus, und load() verwirft es. Es darf nicht als ausstehend gezählt bleiben.
  element.dispatchEvent(new Event('error'))
  await e.retryGuided()
  await expect.poll(() => element.readyState, { timeout: 3000 }).toBeGreaterThanOrEqual(1)
  expect(element.paused).toBe(false)
  await wait(300)
  expect(e.snapshot().state).toBe('playing')

  element.pause()                            // das System hält die Stimme an (Anruf)
  await expect.poll(() => e.snapshot().state, { timeout: 3000 }).toBe('paused')
}, 15000)

test('background plays at the given volume and fades at the end', async () => {
  const ramp = vi.spyOn(AudioParam.prototype, 'linearRampToValueAtTime')
  try {
    const e = make()
    const seen = results(e)
    e.setBackground('wald', 0.5)             // ohne Sitzung: nichts
    await e.startGuided(spec({ background: 'regen', backgroundVolume: 0.35 }))
    expect(e.snapshot().volumes).toEqual({ regen: 0.35 })
    expect(e.voiceCount()).toBe(1)
    expect(ramp.mock.calls.some(([value]) => value === 0.35)).toBe(true) // eingeblendet auf 0,35, nicht 0,7
    e.setBackground('regen', 0.2)            // gleicher Klang: nur die Lautstärke
    expect(e.snapshot().volumes).toEqual({ regen: 0.2 })
    e.setBackground('wald', 0.3)             // anderer Klang: löst ab
    await expect.poll(() => e.snapshot().volumes, { timeout: 2000 }).toEqual({ wald: 0.3 })
    e.setBackground(null, 0.3)               // keiner: die Sitzung läuft weiter
    expect(e.snapshot()).toMatchObject({ state: 'playing', volumes: {}, program: { ref: 'probe' } })
    e.setBackground('regen', 0.35)
    await expect.poll(() => e.snapshot().volumes, { timeout: 2000 }).toEqual({ regen: 0.35 })

    await expect.poll(() => seen.length, { timeout: 6000 }).toBe(1)
    expect(e.snapshot()).toMatchObject({ state: 'idle', volumes: {}, program: null })
    expect(e.voiceCount()).toBeGreaterThan(0) // blendet noch aus
    await expect.poll(() => e.voiceCount(), { timeout: 3000 }).toBe(0)
    await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended')
  } finally {
    ramp.mockRestore()
  }
}, 15000)

test('media session has seek actions and position during a guided session', async () => {
  const setHandler = vi.spyOn(navigator.mediaSession, 'setActionHandler')
  const setPosition = vi.spyOn(navigator.mediaSession, 'setPositionState')
  try {
    const e = make()
    await e.startGuided(spec({ title: 'Abendruhe' }))
    expect(navigator.mediaSession.metadata?.title).toBe('Abendruhe')
    expect(navigator.mediaSession.playbackState).toBe('playing')
    const handlers = new Map(setHandler.mock.calls)
    expect([...handlers.keys()]).toEqual(['play', 'pause', 'stop', 'seekbackward', 'seekforward'])
    const length = await lengthKnown(e)
    const position = () => setPosition.mock.lastCall?.[0]
    expect(position()).toEqual({ duration: length, position: expect.any(Number), playbackRate: 1 })
    await heard(e, 0.5)
    handlers.get('seekbackward')!({ action: 'seekbackward' })
    expect(e.programElapsed()).toBe(0)
    expect(position()).toEqual({ duration: length, position: 0, playbackRate: 1 })
    handlers.get('seekforward')!({ action: 'seekforward' })
    expect(e.programElapsed()!).toBeCloseTo(length - 0.25, 2)
    expect(position()!.position).toBeCloseTo(length - 0.25, 2)
    await e.pause()
    expect(position()!.position).toBeCloseTo(e.programElapsed()!, 2)

    setHandler.mockClear()
    await e.stopAll()
    expect(navigator.mediaSession.metadata).toBeNull()
    expect(navigator.mediaSession.playbackState).toBe('none')
    expect(setHandler.mock.calls).toEqual([['play', null], ['pause', null], ['stop', null], ['seekbackward', null], ['seekforward', null]])
    expect(setPosition.mock.lastCall).toEqual([])  // Positionsanzeige entfernt

    // Ein Klang danach bekommt keine Spul-Aktionen.
    setHandler.mockClear()
    await e.toggle('regen')
    expect(setHandler.mock.calls.map(([action]) => action)).toEqual(['play', 'pause', 'stop'])
  } finally {
    setHandler.mockRestore()
    setPosition.mockRestore()
  }
}, 15000)
