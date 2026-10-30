// Die Klangschale im Abschluss des Morgen-Starts (`playChime`): „Feuer und vergiss“ mit eigenem Audio-Kontext, den
// die Tests als Ersatz einreichen. Fetch ist ersetzt, damit kein Test ans Netz geht.
import { afterEach, beforeEach, expect, test, vi, type MockInstance } from 'vitest'
import { CHIME_EVENING, playChime, resetChimeForTests } from '../../src/lib/audio/chime'
import { EFFECTS } from '../../src/lib/sounds/catalog'

let fetchMock: MockInstance<typeof fetch>

beforeEach(() => {
  resetChimeForTests()
  fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(new ArrayBuffer(8)))
})

afterEach(() => {
  fetchMock.mockRestore()
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Ein Ersatz-Kontext, der aufzeichnet, was mit ihm geschieht. */
function fakeContext(decode: () => Promise<unknown> = async () => ({ fake: 'buffer' }), state: AudioContextState = 'running') {
  const gain = { gain: { value: 1 }, connect: vi.fn() }
  const source = { buffer: null as unknown, connect: vi.fn(), start: vi.fn(), onended: null as (() => void) | null }
  const ctx = {
    state: state as AudioContextState,
    destination: { fake: 'destination' },
    // Wie ein echter Kontext: Der Zustand wechselt mit dem Versprechen.
    resume: vi.fn(async () => {
      ctx.state = 'running'
    }),
    suspend: vi.fn(async () => {
      ctx.state = 'suspended'
    }),
    decodeAudioData: vi.fn(decode),
    createBufferSource: vi.fn(() => source),
    createGain: vi.fn(() => gain),
  }
  return { ctx: ctx as unknown as AudioContext, raw: ctx, source, gain }
}

test('playChime lädt die Klangschale, dekodiert sie und spielt einen Anschlag mit Lautstärke 0,8', async () => {
  const { ctx, raw, source, gain } = fakeContext()
  const make = vi.fn(() => ctx)
  playChime(make)
  // Der Kontext entsteht noch im Aufruf, vor jedem `await`: nur dort gilt die Geste des Tipps (Autoplay-Regel).
  expect(make).toHaveBeenCalledTimes(1)
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(1))
  expect(raw.decodeAudioData).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(String(fetchMock.mock.calls[0][0])).toContain(EFFECTS[0].file)
  expect(source.buffer).toEqual({ fake: 'buffer' })
  // Quelle → Verstärkung (0,8) → Ausgang.
  expect(source.connect).toHaveBeenCalledWith(gain)
  expect(gain.gain.value).toBe(0.8)
  expect(gain.connect).toHaveBeenCalledWith(raw.destination)
})

test('der Kontext wird einmal erzeugt und behalten; die Aufnahme wird nur einmal geladen', async () => {
  const { ctx, raw, source } = fakeContext()
  const make = vi.fn(() => ctx)
  playChime(make)
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(1))
  playChime(make)
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(2))
  expect(make).toHaveBeenCalledTimes(1)
  expect(raw.decodeAudioData).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('scheitert das Laden (Netz), wirft playChime nicht, und der nächste Aufruf versucht es erneut', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('offline'))
  const { ctx, source } = fakeContext()
  expect(() => playChime(() => ctx)).not.toThrow()
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  await wait(30) // Ein unbehandelter Fehler käme hier zum Vorschein und ließe den Test scheitern.
  expect(source.start).not.toHaveBeenCalled()

  playChime(() => ctx)
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(1))
})

test('eine Antwort mit Fehlerstatus (404) und eine nicht dekodierbare Datei bleiben still', async () => {
  fetchMock.mockResolvedValueOnce(new Response('nicht da', { status: 404 }))
  const first = fakeContext()
  expect(() => playChime(() => first.ctx)).not.toThrow()
  await wait(30)
  expect(first.raw.decodeAudioData).not.toHaveBeenCalled()
  expect(first.source.start).not.toHaveBeenCalled()

  resetChimeForTests()
  const second = fakeContext(async () => {
    throw new DOMException('kaputt', 'EncodingError')
  })
  expect(() => playChime(() => second.ctx)).not.toThrow()
  await vi.waitFor(() => expect(second.raw.decodeAudioData).toHaveBeenCalledTimes(1))
  await wait(30)
  expect(second.source.start).not.toHaveBeenCalled()
})

test('kann der Audio-Kontext nicht erzeugt werden, bleibt es still', async () => {
  const make = vi.fn(() => {
    throw new Error('kein Audio')
  })
  expect(() => playChime(make)).not.toThrow()
  await wait(30)
  expect(fetchMock).not.toHaveBeenCalled()
})

test('ein vom System angehaltener Kontext wird fortgesetzt, und der Anschlag klingt trotzdem', async () => {
  const { ctx, raw, source } = fakeContext(undefined, 'suspended')
  playChime(() => ctx)
  expect(raw.resume).toHaveBeenCalledTimes(1) // noch im Aufruf, in der Geste
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(1))
})

test('ein laufender Kontext wird nicht angefasst; scheitert das Fortsetzen, bleibt es still', async () => {
  const running = fakeContext()
  playChime(() => running.ctx)
  await vi.waitFor(() => expect(running.source.start).toHaveBeenCalledTimes(1))
  expect(running.raw.resume).not.toHaveBeenCalled()

  resetChimeForTests()
  const suspended = fakeContext(undefined, 'suspended')
  suspended.raw.resume.mockRejectedValueOnce(new DOMException('abgelehnt', 'NotAllowedError'))
  expect(() => playChime(() => suspended.ctx)).not.toThrow()
  await vi.waitFor(() => expect(suspended.source.start).toHaveBeenCalledTimes(1))
  await wait(30) // Ein unbehandelter Fehler käme hier zum Vorschein.
})

// ── Der Kontext ruht, wenn nichts klingt (Akku: die Engine hält ihre Ausgabe im Leerlauf ebenfalls an) ────────────────

test('nach dem Anschlag (onended) wird der Kontext angehalten, und der nächste Aufruf setzt ihn fort', async () => {
  const { ctx, raw, source } = fakeContext()
  playChime(() => ctx)
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(1))
  // Solange der Anschlag klingt, läuft der Kontext.
  expect(raw.suspend).not.toHaveBeenCalled()
  source.onended!()
  expect(raw.suspend).toHaveBeenCalledTimes(1)

  playChime(() => ctx)
  expect(raw.resume).toHaveBeenCalledTimes(1) // noch im Aufruf, in der Geste
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(2))
})

test('scheitert das Laden, wird der Kontext angehalten, und der nächste Aufruf setzt ihn fort', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('offline'))
  const { ctx, raw, source } = fakeContext()
  playChime(() => ctx)
  await vi.waitFor(() => expect(raw.suspend).toHaveBeenCalledTimes(1))
  expect(source.start).not.toHaveBeenCalled()

  playChime(() => ctx)
  expect(raw.resume).toHaveBeenCalledTimes(1)
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(1))
})

test('ein Anschlag, der noch klingt, hält den Kontext offen; erst der letzte hält ihn an', async () => {
  const { ctx, raw, source } = fakeContext()
  playChime(() => ctx)
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(1))
  const first = source.onended!
  playChime(() => ctx)
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(2))
  const second = source.onended!
  first()
  expect(raw.suspend).not.toHaveBeenCalled()
  second()
  expect(raw.suspend).toHaveBeenCalledTimes(1)
})

test('ein Anhalten, das scheitert, bleibt still', async () => {
  const { ctx, raw, source } = fakeContext()
  raw.suspend.mockRejectedValueOnce(new DOMException('geschlossen', 'InvalidStateError'))
  playChime(() => ctx)
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(1))
  expect(() => source.onended!()).not.toThrow()
  await wait(30) // Ein unbehandelter Fehler käme hier zum Vorschein.
})

test('playChime mit eigener Lautstärke: der Abend-Anschlag ist halb so laut (0,4)', async () => {
  const { ctx, source, gain } = fakeContext()
  playChime(() => ctx, CHIME_EVENING)
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(1))
  expect(CHIME_EVENING).toBe(0.4)
  expect(gain.gain.value).toBe(0.4)
})
