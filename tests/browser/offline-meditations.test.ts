import { test, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  MEDITATION_CACHE,
  isSaved,
  saveMeditation,
  saveAll,
  requestPersistOnce,
  saveInBackground,
} from '../../src/lib/offline/meditations'

// Echte Cache Storage des Browsers; `fetch` ist ein Fake, der die Datei als Strom ausliefert.
// Nur für Fälle, die der echte Cache nicht zulässt (206-Antwort, Speicher voll), steht ein
// kleiner Fake-Cache bereit.

const url = (name: string) => new URL(`audio/meditations/${name}.mp3`, location.href).href

function bytes(length: number, seed = 1): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(length)
  for (let i = 0; i < length; i++) data[i] = (i * 31 + seed) & 0xff
  return data
}

interface Plan {
  data: Uint8Array
  status?: number
  chunk?: number
  // Der Strom bricht nach so vielen Bytes mit einem Fehler ab …
  errorAt?: number
  // … oder endet nach so vielen Bytes ohne Fehler, obwohl Content-Length mehr verspricht.
  endAt?: number
  noLength?: boolean
  reject?: boolean
}

function streamOf(plan: Plan): ReadableStream<Uint8Array> {
  const chunk = plan.chunk ?? 1000
  const limit = Math.min(plan.errorAt ?? Infinity, plan.endAt ?? Infinity, plan.data.length)
  let pos = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pos >= limit) {
        if (plan.errorAt !== undefined && pos >= plan.errorAt) controller.error(new TypeError('network error'))
        else controller.close()
        return
      }
      const end = Math.min(pos + chunk, limit)
      controller.enqueue(plan.data.slice(pos, end))
      pos = end
    },
  })
}

function fakeFetch(plans: Record<string, Plan>) {
  const calls: string[] = []
  const fn = async (input: string | URL | Request): Promise<Response> => {
    const address = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    calls.push(address)
    const plan = plans[address]
    if (!plan || plan.status === 404) return new Response(null, { status: 404 })
    if (plan.reject) throw new TypeError('Failed to fetch')
    const headers: Record<string, string> = { 'Content-Type': 'audio/mpeg' }
    if (!plan.noLength) headers['Content-Length'] = String(plan.data.length)
    return new Response(streamOf(plan), { status: plan.status ?? 200, headers })
  }
  return Object.assign(fn, { calls }) as unknown as typeof fetch & { calls: string[] }
}

// Cache im Speicher. `failPutAt` (1-basiert) lässt genau diesen put mit QuotaExceededError scheitern.
function fakeCaches(options: { failPutAt?: number } = {}) {
  const entries = new Map<string, Response>()
  let puts = 0
  const cache = {
    async match(request: string) {
      return entries.get(request)?.clone()
    },
    async put(request: string, response: Response) {
      puts++
      if (puts === options.failPutAt) throw new DOMException('Quota exceeded', 'QuotaExceededError')
      entries.set(request, response)
    },
    async keys() {
      return [...entries.keys()].map((address) => ({ url: address }))
    },
  }
  const storage = { open: async () => cache } as unknown as CacheStorage
  return { storage, entries }
}

async function cachedKeys(): Promise<string[]> {
  return (await (await caches.open(MEDITATION_CACHE)).keys()).map((r) => r.url)
}

beforeEach(async () => {
  await caches.delete(MEDITATION_CACHE)
})
afterEach(async () => {
  await caches.delete(MEDITATION_CACHE)
})

test('the cache is called ruhe-meditations', () => {
  expect(MEDITATION_CACHE).toBe('ruhe-meditations')
})

test('a complete download is saved', async () => {
  const a = url('a')
  const data = bytes(5000)
  const fetch = fakeFetch({ [a]: { data } })
  expect(await isSaved(a)).toBe(false)

  expect(await saveMeditation(a, undefined, { fetch })).toBe('saved')

  expect(await isSaved(a)).toBe(true)
  const cached = await (await caches.open(MEDITATION_CACHE)).match(a)
  expect(cached?.status).toBe(200)
  expect(cached?.headers.get('Content-Type')).toBe('audio/mpeg')
  expect(cached?.headers.get('Content-Length')).toBe('5000')
  expect(new Uint8Array(await cached!.arrayBuffer())).toEqual(data)
})

test('a relative address is stored under its absolute address', async () => {
  const relative = `audio/meditations/rel.mp3`
  const absolute = url('rel')
  const fetch = fakeFetch({ [absolute]: { data: bytes(1500) } })

  expect(await saveMeditation(relative, undefined, { fetch })).toBe('saved')

  expect(await cachedKeys()).toEqual([absolute])
  expect(await isSaved(relative)).toBe(true)
  expect(await isSaved(absolute)).toBe(true)
})

test('a partly streamed file does not count as saved', async () => {
  const a = url('a')
  const fetch = fakeFetch({ [a]: { data: bytes(5000), errorAt: 2000 } })

  expect(await saveMeditation(a, undefined, { fetch })).toBe('failed')

  expect(await isSaved(a)).toBe(false)
  expect(await cachedKeys()).toEqual([])
})

test('a stream that ends early without an error does not count as saved', async () => {
  const a = url('a')
  const fetch = fakeFetch({ [a]: { data: bytes(5000), endAt: 3000 } })

  expect(await saveMeditation(a, undefined, { fetch })).toBe('failed')

  expect(await isSaved(a)).toBe(false)
  expect(await cachedKeys()).toEqual([])
})

test('http errors, a refused connection and a partial answer fail without storing anything', async () => {
  const missing = url('missing')
  const down = url('down')
  const partial = url('partial')
  const fetch = fakeFetch({
    [down]: { data: bytes(100), reject: true },
    [partial]: { data: bytes(100), status: 206 },
  })

  expect(await saveMeditation(missing, undefined, { fetch })).toBe('failed')
  expect(await saveMeditation(down, undefined, { fetch })).toBe('failed')
  expect(await saveMeditation(partial, undefined, { fetch })).toBe('failed')

  expect(await cachedKeys()).toEqual([])
})

test('a quota error on put reports quota and stores nothing', async () => {
  const a = url('a')
  const { storage, entries } = fakeCaches({ failPutAt: 1 })
  const fetch = fakeFetch({ [a]: { data: bytes(2000) } })

  expect(await saveMeditation(a, undefined, { fetch, caches: storage })).toBe('quota')

  expect(entries.size).toBe(0)
})

test('quota error keeps what was saved and reports it', async () => {
  const names = ['a', 'b', 'c', 'd']
  const plans = Object.fromEntries(names.map((n, i) => [url(n), { data: bytes(2000, i + 1) }]))
  const { storage, entries } = fakeCaches({ failPutAt: 3 })
  const fetch = fakeFetch(plans)
  const progress = vi.fn()

  const result = await saveAll(names.map(url), progress, { fetch, caches: storage })

  expect(result).toEqual({ saved: 2, failed: 0, quota: true })
  expect([...entries.keys()]).toEqual([url('a'), url('b')])
  expect(await isSaved(url('a'), { caches: storage })).toBe(true)
  expect(await isSaved(url('b'), { caches: storage })).toBe(true)
  expect(await isSaved(url('c'), { caches: storage })).toBe(false)
  // Nach dem Abbruch wird nichts Weiteres geladen.
  expect(fetch.calls).toEqual([url('a'), url('b'), url('c')])
})

test('saveAll goes on after a failed file and counts it', async () => {
  const fetch = fakeFetch({
    [url('a')]: { data: bytes(1500) },
    [url('b')]: { data: bytes(1500), errorAt: 500 },
    [url('c')]: { data: bytes(1500) },
  })

  const result = await saveAll([url('a'), url('b'), url('c')], () => {}, { fetch })

  expect(result).toEqual({ saved: 2, failed: 1, quota: false })
  expect(await cachedKeys()).toEqual([url('a'), url('c')])
})

test('progress reports bytes', async () => {
  const a = url('a')
  const fetch = fakeFetch({ [a]: { data: bytes(4500), chunk: 1000 } })
  const progress: Array<[number, number]> = []

  await saveMeditation(a, (loaded, total) => progress.push([loaded, total]), { fetch })

  expect(progress.map(([loaded]) => loaded)).toEqual([1000, 2000, 3000, 4000, 4500])
  expect(progress.every(([, total]) => total === 4500)).toBe(true)
})

test('progress reports an unknown total as 0', async () => {
  const a = url('a')
  const fetch = fakeFetch({ [a]: { data: bytes(2500), noLength: true } })
  const progress: Array<[number, number]> = []

  expect(await saveMeditation(a, (loaded, total) => progress.push([loaded, total]), { fetch })).toBe('saved')

  expect(progress.at(-1)).toEqual([2500, 0])
  expect(await isSaved(a)).toBe(true) // ohne Content-Length zählt jede vollständig gespeicherte 200-Antwort
})

test('saveAll reports done, total and the bytes received so far', async () => {
  const fetch = fakeFetch({
    [url('a')]: { data: bytes(2000), chunk: 1000 },
    [url('b')]: { data: bytes(3000), chunk: 1000 },
  })
  const progress: Array<[number, number, number]> = []

  const result = await saveAll([url('a'), url('b')], (done, total, received) => progress.push([done, total, received]), { fetch })

  expect(result).toEqual({ saved: 2, failed: 0, quota: false })
  expect(progress[0]).toEqual([0, 2, 0])
  expect(progress.at(-1)).toEqual([2, 2, 5000])
  const received = progress.map(([, , b]) => b)
  expect(received).toEqual([...received].sort((x, y) => x - y)) // wächst nur
  expect(progress).toContainEqual([1, 2, 2000])
  expect(progress).toContainEqual([1, 2, 3000]) // mitten in der zweiten Datei
})

test('a failed file does not count its partial bytes', async () => {
  const fetch = fakeFetch({
    [url('a')]: { data: bytes(2000) },
    [url('b')]: { data: bytes(3000), errorAt: 1000 },
  })
  const progress: Array<[number, number, number]> = []

  await saveAll([url('a'), url('b')], (done, total, received) => progress.push([done, total, received]), { fetch })

  expect(progress.at(-1)).toEqual([2, 2, 2000])
})

test('a file that is already saved is not downloaded again', async () => {
  const a = url('a')
  const fetch = fakeFetch({ [a]: { data: bytes(2000) } })
  await saveMeditation(a, undefined, { fetch })
  expect(fetch.calls).toHaveLength(1)

  expect(await saveMeditation(a, undefined, { fetch })).toBe('saved')
  expect(await saveAll([a], () => {}, { fetch })).toEqual({ saved: 1, failed: 0, quota: false })

  expect(fetch.calls).toHaveLength(1)
})

test('a truncated entry in the cache is downloaded again', async () => {
  const a = url('a')
  const data = bytes(3000)
  const cache = await caches.open(MEDITATION_CACHE)
  // Antwort, die 3000 Byte verspricht, aber nur 1000 enthält (z. B. ein früher abgebrochener Abruf).
  await cache.put(a, new Response(data.slice(0, 1000), { status: 200, headers: { 'Content-Length': '3000' } }))
  expect(await isSaved(a)).toBe(false)

  expect(await saveMeditation(a, undefined, { fetch: fakeFetch({ [a]: { data } }) })).toBe('saved')

  expect(await isSaved(a)).toBe(true)
})

test('isSaved: a 200 without Content-Length counts, a 206 never does', async () => {
  const a = url('a')
  const b = url('b')
  const c = url('c')
  const { storage, entries } = fakeCaches()
  entries.set(a, new Response(bytes(500), { status: 200 }))
  entries.set(b, new Response(bytes(500), { status: 206, headers: { 'Content-Length': '500' } }))
  entries.set(c, new Response(bytes(400), { status: 200, headers: { 'Content-Length': '500' } }))

  expect(await isSaved(a, { caches: storage })).toBe(true)
  expect(await isSaved(b, { caches: storage })).toBe(false)
  expect(await isSaved(c, { caches: storage })).toBe(false)
  expect(await isSaved(url('absent'), { caches: storage })).toBe(false)
})

test('isSaved is false when Cache Storage refuses to open', async () => {
  const broken = { open: async () => { throw new Error('denied') } } as unknown as CacheStorage
  expect(await isSaved(url('a'), { caches: broken })).toBe(false)
})

test('persistent storage is requested once, at the first save', async () => {
  const persist = vi.fn(async () => true)
  const storage = { persist } as unknown as StorageManager
  const fetch = fakeFetch({ [url('a')]: { data: bytes(1500) }, [url('b')]: { data: bytes(1500) } })

  expect(persist).not.toHaveBeenCalled()
  await saveMeditation(url('a'), undefined, { fetch, storage })
  await saveMeditation(url('b'), undefined, { fetch, storage })
  await requestPersistOnce({ storage })

  expect(persist).toHaveBeenCalledTimes(1)
})

test('a failing persist request is silent and does not block saving', async () => {
  const storage = { persist: vi.fn(async () => { throw new Error('no') }) } as unknown as StorageManager
  const fetch = fakeFetch({ [url('a')]: { data: bytes(1500) } })

  await expect(requestPersistOnce({ storage: {} as StorageManager })).resolves.toBeUndefined()
  expect(await saveMeditation(url('a'), undefined, { fetch, storage })).toBe('saved')
})

test('saveInBackground returns at once and saves in the background', async () => {
  const a = url('a')
  const fetch = fakeFetch({ [a]: { data: bytes(3000) } })

  expect(saveInBackground(a, { fetch })).toBeUndefined()

  await vi.waitFor(async () => expect(await isSaved(a)).toBe(true))
})

test('saveInBackground stays silent when saving fails', async () => {
  const a = url('a')
  const unhandled = vi.fn()
  window.addEventListener('unhandledrejection', unhandled)
  try {
    const fetch = fakeFetch({ [a]: { data: bytes(100), reject: true } })
    saveInBackground(a, { fetch })
    await vi.waitFor(() => expect(fetch.calls).toEqual([a]))
    await new Promise((r) => setTimeout(r, 50))
    expect(unhandled).not.toHaveBeenCalled()
    expect(await isSaved(a)).toBe(false)
  } finally {
    window.removeEventListener('unhandledrejection', unhandled)
  }
})

test('a real file from the server is saved completely', async () => {
  const real = new URL('audio/meditations/drei-minuten-atempause.mp3', location.href).href
  const progress: Array<[number, number]> = []

  expect(await saveMeditation(real, (loaded, total) => progress.push([loaded, total]))).toBe('saved')

  expect(await isSaved(real)).toBe(true)
  const [loaded, total] = progress.at(-1)!
  expect(total).toBeGreaterThan(100_000)
  expect(loaded).toBe(total)
  const cached = await (await caches.open(MEDITATION_CACHE)).match(real)
  expect(cached?.headers.get('Content-Length')).toBe(String(total))
  expect((await cached!.arrayBuffer()).byteLength).toBe(total)
})
