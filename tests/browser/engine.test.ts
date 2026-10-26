import { test, expect, afterEach, beforeAll, vi } from 'vitest'
import { AudioEngine } from '../../src/lib/audio/engine'
import { loadBuffer } from '../../src/lib/audio/loops'
import { createOutput, type Output } from '../../src/lib/audio/output'
import { assetUrl } from '../../src/lib/sounds/catalog'
import { createMusicVoice, type MusicVoice } from '../../src/lib/audio/music'
import { breathProgram } from '../../src/lib/audio/program'
import { toneUrl } from './wav'

type Loader = (ctx: BaseAudioContext, url: string) => Promise<AudioBuffer>

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
// Für Tests, in denen der Inhalt egal ist: 1 s Stille statt Laden und Dekodieren der Aufnahme.
const synthetic: Loader = async ctx => ctx.createBuffer(2, ctx.sampleRate, ctx.sampleRate)
let out: Output | undefined
let engine: AudioEngine
function make(load: Loader = synthetic) {
  engine = new AudioEngine({ createOutput: () => (out = createOutput()), load })
  return engine
}
afterEach(async () => { await engine?.stopAll(); await out?.ctx.close() })

test('toggle starts and stops a sound from its recording', async () => {
  const urls: string[] = []
  const e = make((ctx, url) => { urls.push(url); return loadBuffer(ctx, url) })
  await e.toggle('regen')
  expect(urls).toEqual([assetUrl('audio/sounds/regen.ogg')])
  expect(e.snapshot()).toMatchObject({ state: 'playing', volumes: { regen: 0.7 } })
  expect(e.voiceCount()).toBe(1)
  expect(out!.ctx.state).toBe('running')
  await e.toggle('regen')
  await expect.poll(() => e.voiceCount(), { timeout: 3000 }).toBe(0)
  await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended')
  expect(e.snapshot().state).toBe('idle')
})

test('switching to another sound stops the previous one', async () => {
  const e = make()
  await e.toggle('regen')
  const states: string[] = []
  const off = e.subscribe(s => states.push(s.state))
  await e.toggle('wald')
  off()
  expect(e.snapshot().volumes).toEqual({ wald: 0.7 })
  expect(states.every(s => s === 'playing')).toBe(true) // der Wechsel führt nicht über idle
  await expect.poll(() => e.voiceCount(), { timeout: 3000 }).toBe(1) // Regen ist ausgeblendet und abgebaut
  await wait(300)                            // ein irrtümliches Anhalten hätte jetzt gegriffen
  expect(e.snapshot().state).toBe('playing')
  expect(out!.ctx.state).toBe('running')
  expect(out!.element.paused).toBe(false)
})

test('sleep countdown keeps running across a switch', async () => {
  const e = make()
  e.setSleepTimer(15)
  await e.toggle('regen')
  await wait(1000)
  await e.toggle('meer')
  expect(e.snapshot().volumes).toEqual({ meer: 0.7 })
  expect(e.snapshot().remainingSec).toBeLessThan(899.5) // kein Neustart des Countdowns
})

test('after a switch the session still ends at the original sleep end', async () => {
  const e = make()
  e.setSleepTimer(0.05)                      // 3 s
  await e.toggle('regen')
  const end = out!.ctx.currentTime + e.snapshot().remainingSec!
  let endedAt: number | null = null
  const off = e.subscribe(s => { if (s.state === 'idle' && endedAt === null) endedAt = out!.ctx.currentTime })
  await expect.poll(() => out!.ctx.currentTime, { timeout: 3000 }).toBeGreaterThan(end - 2) // etwa 1 s später
  await e.toggle('meer')
  await expect.poll(() => endedAt, { timeout: 5000 }).not.toBeNull()
  off()
  // Ein neu gestarteter Countdown endete erst rund 1 s später (Audio-Uhr).
  expect(endedAt!).toBeGreaterThan(end - 0.05)
  expect(endedAt!).toBeLessThan(end + 0.3)
  expect(e.voiceCount()).toBe(0)
})

test('switching while the previous sound still loads discards that load', async () => {
  const finish: (() => void)[] = []
  const e = make((ctx, url) => new Promise(resolve => finish.push(() => resolve(synthetic(ctx, url)))))
  const first = e.toggle('wald')
  const second = e.toggle('regen')
  expect(e.snapshot()).toMatchObject({ state: 'playing', loading: ['regen'] })
  for (const done of finish) done()          // auch der Wald wird noch fertig, aber zu spät
  await Promise.all([first, second])
  expect(e.snapshot().volumes).toEqual({ regen: 0.7 })
  expect(e.voiceCount()).toBe(1)
})

test('switching while paused resumes with only the new sound', async () => {
  const e = make()
  await e.toggle('regen')
  await e.pause()
  await e.toggle('wald')
  expect(e.snapshot().state).toBe('playing')
  expect(e.snapshot().volumes).toEqual({ wald: 0.7 })
  expect(e.voiceCount()).toBe(1)             // der angehaltene Regen ist sofort abgebaut
  expect(out!.ctx.state).toBe('running')
})

test('switching while paused also ends a sound still fading out from an earlier switch', async () => {
  const e = make()
  await e.toggle('kaminfeuer')
  await e.toggle('regen')                    // Kaminfeuer blendet aus …
  await e.pause()                            // … und bleibt dabei mit der Audio-Uhr stehen
  expect(e.voiceCount()).toBe(2)
  await e.toggle('wald')
  expect(e.snapshot().volumes).toEqual({ wald: 0.7 })
  expect(e.voiceCount()).toBe(1)             // nichts Ausklingendes läuft nach dem Fortsetzen weiter
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

test('a failed load marks that sound as error and ends the session', async () => {
  const e = make(async (ctx, url) => {
    if (url.endsWith('/wald.ogg')) throw new Error('Konnte nicht geladen werden: ' + url)
    return synthetic(ctx, url)
  })
  await e.toggle('regen')
  await e.toggle('wald')                     // Wechsel: Regen blendet aus, Wald scheitert
  expect(e.snapshot()).toMatchObject({ state: 'idle', errors: ['wald'], loading: [], remainingSec: null })
  expect(e.snapshot().volumes).toEqual({})
  await expect.poll(() => e.voiceCount(), { timeout: 3000 }).toBe(0)
  await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended')
  await e.toggle('wald')                     // neuer Versuch, schlägt wieder fehl
  expect(e.snapshot()).toMatchObject({ state: 'idle', errors: ['wald'] })
  await e.toggle('regen')                    // ein anderer Klang startet wie gewohnt
  expect(e.snapshot().state).toBe('playing')
  expect(e.snapshot().volumes).toEqual({ regen: 0.7 })
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

test('a new sound right after stopping keeps the output running', async () => {
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

test('a failed start pauses with a tap hint, and resume starts again', async () => {
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
  })
  const e = engine
  await expect(e.toggle('regen')).rejects.toThrow('blockiert')
  expect(e.snapshot()).toMatchObject({ state: 'paused', needsTap: true, volumes: { regen: 0.7 } })
  expect(out!.element.paused).toBe(true)
  await expect.poll(() => out!.ctx.state, { timeout: 3000 }).toBe('suspended') // Restzeit steht
  await e.resume()                           // „Weiter“
  expect(e.snapshot()).toMatchObject({ state: 'playing', needsTap: false })
  expect(out!.ctx.state).toBe('running')
  expect(out!.element.paused).toBe(false)
})

test('ending a session clears the media session and releases its controls', async () => {
  const setHandler = vi.spyOn(navigator.mediaSession, 'setActionHandler')
  try {
    const e = make()
    await e.toggle('regen')
    expect(navigator.mediaSession.metadata?.title).toBe('Regen')
    expect(navigator.mediaSession.playbackState).toBe('playing')
    expect(setHandler.mock.calls.map(([action, handler]) => [action, typeof handler]))
      .toEqual([['play', 'function'], ['pause', 'function'], ['stop', 'function']])
    setHandler.mockClear()
    e.setVolume('regen', 0.4)                // weitere Änderung ohne Übergang
    await e.pause()
    await e.resume()
    expect(setHandler).not.toHaveBeenCalled()
    await e.stopAll()
    expect(navigator.mediaSession.metadata).toBeNull()
    expect(navigator.mediaSession.playbackState).toBe('none')
    expect(setHandler.mock.calls).toEqual([['play', null], ['pause', null], ['stop', null]])
  } finally {
    setHandler.mockRestore()
  }
})

test('a switch keeps the media session and shows only the new title', async () => {
  const setHandler = vi.spyOn(navigator.mediaSession, 'setActionHandler')
  const setMetadata = vi.spyOn(navigator.mediaSession, 'metadata', 'set')
  try {
    const e = make()
    await e.toggle('regen')
    setHandler.mockClear()
    setMetadata.mockClear()
    await e.toggle('wald')
    // Schon während der Wald lädt, steht er im Titel: kein Zwischenstand „Ruhe“.
    expect(setMetadata.mock.calls.map(([m]) => m?.title)).toEqual(['Wald mit Vögeln'])
    expect(navigator.mediaSession.metadata?.title).toBe('Wald mit Vögeln')
    expect(navigator.mediaSession.playbackState).toBe('playing')
    expect(setHandler).not.toHaveBeenCalled()
  } finally {
    setHandler.mockRestore()
    setMetadata.mockRestore()
  }
})

test('a suspension of the audio context from outside pauses the engine', async () => {
  const e = make()
  e.setSleepTimer(30)
  await e.toggle('wind')
  await out!.ctx.suspend()                   // simuliert das System
  await expect.poll(() => e.snapshot().state, { timeout: 3000 }).toBe('paused')
  expect(out!.element.paused).toBe(true)
  const frozen = e.snapshot().remainingSec!
  await wait(300)
  expect(e.snapshot().remainingSec).toBeCloseTo(frozen, 1)
  await e.resume()
  expect(e.snapshot().state).toBe('playing')
  expect(out!.ctx.state).toBe('running')
})

test('own pause followed by quick resume is not taken for an interruption', async () => {
  const e = make()
  await e.toggle('regen')
  const paused = e.pause()
  await e.resume()
  await paused
  await wait(300)                            // Ereignisse des eigenen Anhaltens sind jetzt durch
  expect(e.snapshot().state).toBe('playing')
  expect(out!.ctx.state).toBe('running')
  expect(out!.element.paused).toBe(false)
})

test('pausing right after a start is not a failed start', async () => {
  const e = make()
  const started = e.toggle('regen')
  await e.pause()                            // löst das noch laufende play() ab (AbortError)
  await expect(started).resolves.toBeUndefined()
  expect(e.snapshot()).toMatchObject({ state: 'paused', needsTap: false, volumes: { regen: 0.7 } })
  await e.resume()
  expect(e.snapshot().state).toBe('playing')
  expect(out!.element.paused).toBe(false)
})

// Musik: ein gestreamter Ton von 10 s mit 1 s Überblendung statt der echten Datei.
type MusicFactory = (ctx: AudioContext, url: string, opts?: { crossfade?: number }) => MusicVoice
let tone = ''
beforeAll(async () => {
  tone = await toneUrl(10)
})
const streamed: MusicFactory = ctx => createMusicVoice(ctx, tone, { crossfade: 1 })
function makeMusic(music: MusicFactory = streamed) {
  engine = new AudioEngine({ createOutput: () => (out = createOutput()), load: synthetic, music })
  return engine
}
// Die Elemente aller Musik-Stimmen, in der Reihenfolge ihrer Entstehung (je Stimme zwei).
function musicElements(spy: { mock: { calls: [HTMLMediaElement][] } }): HTMLMediaElement[] {
  return spy.mock.calls.map(([element]) => element)
}
// Eine Stimme ohne Datei, deren `ready` der Test selbst auflöst oder ablehnt.
function fakeMusic() {
  const made: { stop: ReturnType<typeof vi.fn>; settle: (ok: boolean) => void }[] = []
  const factory: MusicFactory = ctx => {
    let settle!: (ok: boolean) => void
    const ready = new Promise<void>((resolve, reject) => {
      settle = ok => (ok ? resolve() : reject(new Error('Konnte nicht geladen werden: probe')))
    })
    ready.catch(() => {})
    const stop = vi.fn()
    made.push({ stop, settle })
    return { output: ctx.createGain(), ready, stop, hold: vi.fn(), resume: vi.fn(async () => {}) }
  }
  return { made, factory }
}

test('toggle plays a music piece as a streamed voice and stops it', async () => {
  const sources = vi.spyOn(AudioContext.prototype, 'createMediaElementSource')
  try {
    const e = makeMusic()
    await e.toggle('klavier')
    expect(e.snapshot()).toMatchObject({ state: 'playing', volumes: { klavier: 0.7 } })
    expect(e.voiceCount()).toBe(1)
    const [first] = musicElements(sources)
    expect(first.paused).toBe(false)
    expect(first.currentTime).toBeLessThan(1) // ein Stück beginnt am Anfang
    await e.toggle('klavier')
    await expect.poll(() => e.voiceCount(), { timeout: 3000 }).toBe(0)
    expect(e.snapshot().state).toBe('idle')
    expect(first.hasAttribute('src')).toBe(false)
  } finally {
    sources.mockRestore()
  }
})

test('switching between music and nature keeps exactly one voice', async () => {
  const e = makeMusic()
  await e.toggle('regen')
  await e.toggle('klavier')
  expect(e.snapshot().volumes).toEqual({ klavier: 0.7 })
  await e.toggle('regen')
  expect(e.snapshot().volumes).toEqual({ regen: 0.7 })
  await expect.poll(() => e.voiceCount(), { timeout: 3000 }).toBe(1)
  expect(e.snapshot().state).toBe('playing')
})

test('a program creates its music background at once, still in the tap, at the program volume', async () => {
  const { made, factory } = fakeMusic()
  const e = makeMusic(factory)
  const starting = e.startProgram(breathProgram('box', 1, { sound: true, background: 'klavier' }))
  // Vor dem ersten `await`: Das Element startet noch in der Nutzergeste, nicht erst nach dem Laden des Atemgeräuschs.
  expect(made).toHaveLength(1)
  made[0].settle(true)
  await starting
  expect(e.snapshot()).toMatchObject({ state: 'playing', program: { title: 'Atmen · Box-Atmung' }, volumes: { klavier: 0.35 } })
})

test('a program superseded before its music is ready drops the music', async () => {
  const { made, factory } = fakeMusic()
  const e = makeMusic(factory)
  const first = e.startProgram(breathProgram('box', 1, { sound: true, background: 'klavier' }))
  const second = e.startProgram(breathProgram('478', 1, { sound: true, background: null }))
  made[0].settle(true)
  await Promise.all([first, second])
  expect(made[0].stop).toHaveBeenCalled()
  expect(e.snapshot()).toMatchObject({ program: { title: 'Atmen · 4-7-8' }, volumes: {}, loading: [] })
})

test('a lofi piece passes its own crossfade to the music voice, meditation music keeps the default', async () => {
  const seen: (number | undefined)[] = []
  const factory: MusicFactory = (ctx, _url, opts) => {
    seen.push(opts?.crossfade)
    return { output: ctx.createGain(), ready: Promise.resolve(), stop: vi.fn(), hold: vi.fn(), resume: vi.fn(async () => {}) }
  }
  const e = makeMusic(factory)
  await e.toggle('kaffee-und-notizen')
  await e.toggle('klavier')
  expect(seen).toEqual([3, undefined])
})

test('tapping a second piece before the first is ready stops the first', async () => {
  const { made, factory } = fakeMusic()
  const e = makeMusic(factory)
  const first = e.toggle('klavier')
  const second = e.toggle('obertoene')
  for (const voice of made) voice.settle(true)
  await Promise.all([first, second])
  expect(e.snapshot().volumes).toEqual({ obertoene: 0.7 })
  expect(made[0].stop).toHaveBeenCalled()
  expect(made[1].stop).not.toHaveBeenCalled()
  expect(e.voiceCount()).toBe(1)
})

test('pause and an interruption hold the music and resume continues where it was', async () => {
  const sources = vi.spyOn(AudioContext.prototype, 'createMediaElementSource')
  try {
    const e = makeMusic()
    await e.toggle('klavier')
    const [first] = musicElements(sources)
    await wait(300)
    await e.pause()
    expect(first.paused).toBe(true)
    const at = first.currentTime
    await e.resume()
    expect(first.paused).toBe(false)
    expect(first.currentTime).toBeGreaterThanOrEqual(at)

    out!.element.pause() // Unterbrechung von außen, am Anker erkannt
    await expect.poll(() => e.snapshot().state, { timeout: 2000 }).toBe('paused')
    expect(first.paused).toBe(true)
    const held = first.currentTime
    await e.resume()
    expect(e.snapshot().state).toBe('playing')
    expect(first.paused).toBe(false)
    expect(first.currentTime).toBeGreaterThanOrEqual(held)
  } finally {
    sources.mockRestore()
  }
})

test('a music piece that fails to load is marked', async () => {
  const { made, factory } = fakeMusic()
  const e = makeMusic(factory)
  const toggled = e.toggle('klavier')
  made[0].settle(false)
  await toggled
  expect(e.snapshot().errors).toContain('klavier')
  expect(e.snapshot().state).toBe('idle')
  expect(e.voiceCount()).toBe(0)
  expect(made[0].stop).toHaveBeenCalled()
})

test('the sleep end stops the music', async () => {
  const sources = vi.spyOn(AudioContext.prototype, 'createMediaElementSource')
  try {
    const e = makeMusic()
    e.setSleepTimer(0.05) // 3 s
    await e.toggle('klavier')
    const [first] = musicElements(sources)
    await expect.poll(() => e.snapshot().state, { timeout: 5000 }).toBe('idle')
    expect(first.hasAttribute('src')).toBe(false)
    expect(e.voiceCount()).toBe(0)
  } finally {
    sources.mockRestore()
  }
})
