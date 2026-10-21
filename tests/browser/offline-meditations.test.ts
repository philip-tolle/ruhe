import { test, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  MEDITATION_CACHE,
  isSaved,
  saveMeditation,
  saveAll,
  removeStale,
  requestPersistOnce,
  saveInBackground,
} from '../../src/lib/offline/meditations'

// Echte Cache Storage des Browsers; `fetch` ist ein Fake, der die Datei als Strom ausliefert.
// Nur für Fälle, die der echte Cache nicht zulässt (206-Antwort, Speicher voll), steht ein
// kleiner Fake-Cache bereit.

// Eine gespeicherte Datei trägt einen Audio-Typ; ohne ihn zählt ein Eintrag nicht (siehe `isSaved`).
const AUDIO = { 'Content-Type': 'audio/mpeg' }

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
  // Content-Length, die der Server meldet, wenn sie von der Länge des Inhalts abweicht (Kompression).
  lengthHeader?: number
  // Content-Encoding des Servers, z. B. 'gzip': Dann ist Content-Length die Länge vor dem Entpacken.
  encoding?: string
  // Content-Type des Servers; null lässt ihn weg. Standard: audio/mpeg.
  contentType?: string | null
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
    const headers: Record<string, string> = {}
    if (plan.contentType !== null) headers['Content-Type'] = plan.contentType ?? 'audio/mpeg'
    if (!plan.noLength) headers['Content-Length'] = String(plan.lengthHeader ?? plan.data.length)
    if (plan.encoding) headers['Content-Encoding'] = plan.encoding
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
    async delete(request: string) {
      return entries.delete(request)
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
  await cache.put(a, new Response(data.slice(0, 1000), { status: 200, headers: { ...AUDIO, 'Content-Length': '3000' } }))
  expect(await isSaved(a)).toBe(false)

  expect(await saveMeditation(a, undefined, { fetch: fakeFetch({ [a]: { data } }) })).toBe('saved')

  expect(await isSaved(a)).toBe(true)
})

test('isSaved: a 200 without Content-Length counts, a 206 never does', async () => {
  const a = url('a')
  const b = url('b')
  const c = url('c')
  const { storage, entries } = fakeCaches()
  entries.set(a, new Response(bytes(500), { status: 200, headers: AUDIO }))
  entries.set(b, new Response(bytes(500), { status: 206, headers: { ...AUDIO, 'Content-Length': '500' } }))
  entries.set(c, new Response(bytes(400), { status: 200, headers: { ...AUDIO, 'Content-Length': '500' } }))

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

test('an incomplete entry is removed before the download, so a failed download leaves nothing behind', async () => {
  const a = url('a')
  const cache = await caches.open(MEDITATION_CACHE)
  // Ein früher abgebrochener Abruf: 3000 Byte versprochen, 1000 vorhanden. Der Service Worker würde
  // diese Antwort beim Abspielen ausliefern (CacheFirst), also darf sie nicht stehen bleiben.
  await cache.put(a, new Response(bytes(1000), { status: 200, headers: { ...AUDIO, 'Content-Length': '3000' } }))
  expect(await cachedKeys()).toEqual([a])

  const fetch = fakeFetch({ [a]: { data: bytes(3000), errorAt: 500 } })
  expect(await saveMeditation(a, undefined, { fetch })).toBe('failed')

  expect(await cachedKeys()).toEqual([])
  expect(await isSaved(a)).toBe(false)
})

test('an incomplete entry is removed even when the server has the file no more', async () => {
  const a = url('a')
  const cache = await caches.open(MEDITATION_CACHE)
  await cache.put(a, new Response(bytes(1000), { status: 200, headers: { ...AUDIO, 'Content-Length': '3000' } }))

  expect(await saveMeditation(a, undefined, { fetch: fakeFetch({}) })).toBe('failed') // 404

  expect(await cachedKeys()).toEqual([])
})

test('a complete entry is left alone', async () => {
  const a = url('a')
  const data = bytes(2000)
  const fetch = fakeFetch({ [a]: { data } })
  await saveMeditation(a, undefined, { fetch })

  // Der zweite Aufruf löscht nichts und lädt nichts; mit einem Netz, das ausfiele, bliebe 'saved'.
  const down = fakeFetch({ [a]: { data, reject: true } })
  expect(await saveMeditation(a, undefined, { fetch: down })).toBe('saved')

  expect(down.calls).toEqual([])
  expect(await isSaved(a)).toBe(true)
})

test('a compressed response is counted by the bytes received, not compared with Content-Length', async () => {
  const a = url('a')
  const data = bytes(5000)
  // Content-Length gilt vor dem Entpacken (1234), der Strom liefert die entpackten 5000 Byte.
  const fetch = fakeFetch({ [a]: { data, encoding: 'gzip', lengthHeader: 1234 } })
  const progress: Array<[number, number]> = []

  expect(await saveMeditation(a, (loaded, total) => progress.push([loaded, total]), { fetch })).toBe('saved')

  expect(progress.at(-1)).toEqual([5000, 0]) // Gesamtlänge unbekannt
  expect(await isSaved(a)).toBe(true)
  const cached = await (await caches.open(MEDITATION_CACHE)).match(a)
  expect(cached?.headers.get('Content-Length')).toBe('5000') // die gespeicherte Antwort trägt die echte Länge
  expect(cached?.headers.get('Content-Encoding')).toBeNull()
  expect(new Uint8Array(await cached!.arrayBuffer())).toEqual(data)
})

test('a compressed response that delivers nothing still fails', async () => {
  const a = url('a')
  const fetch = fakeFetch({ [a]: { data: new Uint8Array(0), encoding: 'br', lengthHeader: 10 } })

  expect(await saveMeditation(a, undefined, { fetch })).toBe('failed')

  expect(await cachedKeys()).toEqual([])
})

test('isSaved does not compare the Content-Length of an entry that has a Content-Encoding', async () => {
  const a = url('a')
  const b = url('b')
  const { storage, entries } = fakeCaches()
  // Länge vor dem Entpacken (200) ≠ Länge des Inhalts (500): nicht prüfbar, also zählt die 200-Antwort.
  const gzip = { ...AUDIO, 'Content-Encoding': 'gzip', 'Content-Length': '200' }
  entries.set(a, new Response(bytes(500), { status: 200, headers: gzip }))
  // Eine Teilantwort zählt trotzdem nie.
  entries.set(b, new Response(bytes(500), { status: 206, headers: gzip }))

  expect(await isSaved(a, { caches: storage })).toBe(true)
  expect(await isSaved(b, { caches: storage })).toBe(false)
})

test('a response that is not audio is rejected and nothing is stored', async () => {
  const page = url('page')
  const octets = url('octets')
  const untyped = url('untyped')
  const fetch = fakeFetch({
    // z. B. die Startseite als Ersatz für eine fehlende Datei (200 mit text/html)
    [page]: { data: bytes(3000), contentType: 'text/html; charset=utf-8' },
    [octets]: { data: bytes(3000), contentType: 'application/octet-stream' },
    [untyped]: { data: bytes(3000), contentType: null },
  })

  expect(await saveMeditation(page, undefined, { fetch })).toBe('failed')
  expect(await saveMeditation(octets, undefined, { fetch })).toBe('failed')
  expect(await saveMeditation(untyped, undefined, { fetch })).toBe('failed')

  expect(await cachedKeys()).toEqual([])
})

test('any audio type is accepted, in any case', async () => {
  const a = url('a')
  const b = url('b')
  const fetch = fakeFetch({
    [a]: { data: bytes(2000), contentType: 'audio/mp3' },
    [b]: { data: bytes(2000), contentType: 'Audio/MPEG' },
  })

  expect(await saveMeditation(a, undefined, { fetch })).toBe('saved')
  expect(await saveMeditation(b, undefined, { fetch })).toBe('saved')
})

test('removeStale deletes the entries that are not a current address and keeps the others', async () => {
  const current = [url('a') + '?v=new', url('b') + '?v=new']
  const old = [url('a') + '?v=old', url('c') + '?v=old', url('b')]
  const cache = await caches.open(MEDITATION_CACHE)
  for (const address of [...current, ...old]) await cache.put(address, new Response(bytes(100), { status: 200 }))

  expect(await removeStale(current)).toBe(3)

  expect((await cachedKeys()).sort()).toEqual([...current].sort())
})

test('removeStale compares against absolute addresses and does nothing when nothing is stale', async () => {
  const cache = await caches.open(MEDITATION_CACHE)
  const address = url('a') + '?v=v1'
  await cache.put(address, new Response(bytes(100), { status: 200 }))

  // relativ übergeben: gilt wie die absolute Adresse
  expect(await removeStale([`audio/meditations/a.mp3?v=v1`])).toBe(0)

  expect(await cachedKeys()).toEqual([address])
})

test('removeStale stays silent when Cache Storage refuses to open', async () => {
  const broken = { open: async () => { throw new Error('denied') } } as unknown as CacheStorage
  expect(await removeStale([url('a')], { caches: broken })).toBe(0)
})

test('saveAll tells which files were saved, also the one that was already there', async () => {
  const fetch = fakeFetch({
    [url('a')]: { data: bytes(1500) },
    [url('b')]: { data: bytes(1500), errorAt: 500 },
    [url('c')]: { data: bytes(1500) },
  })
  await saveMeditation(url('a'), undefined, { fetch })
  const saved: string[] = []

  await saveAll([url('a'), url('b'), url('c')], () => {}, { fetch }, (address) => saved.push(address))

  expect(saved).toEqual([url('a'), url('c')])
})

test('saveAll does not call onSaved for the file that hit the storage limit', async () => {
  const names = ['a', 'b', 'c']
  const plans = Object.fromEntries(names.map((n, i) => [url(n), { data: bytes(1500, i + 1) }]))
  const { storage } = fakeCaches({ failPutAt: 2 })
  const saved: string[] = []

  const result = await saveAll(names.map(url), () => {}, { fetch: fakeFetch(plans), caches: storage }, (a) => saved.push(a))

  expect(result).toEqual({ saved: 1, failed: 0, quota: true })
  expect(saved).toEqual([url('a')])
})

// Der Service Worker schreibt jede 200-Antwort in den Cache (cacheableResponse prüft nur den Status),
// auch die Startseite, die der Server statt einer fehlenden Datei liefert.
const PAGE = new TextEncoder().encode('<!doctype html><title>Ruhe</title><p>Nicht gefunden</p>')
const htmlResponse = (type: string | null = 'text/html; charset=utf-8') =>
  new Response(PAGE, { status: 200, headers: { ...(type ? { 'Content-Type': type } : {}), 'Content-Length': String(PAGE.length) } })

test('a cached 200 that is not audio does not count as saved', async () => {
  const a = url('a')
  const b = url('b')
  const { storage, entries } = fakeCaches()
  entries.set(a, htmlResponse())
  entries.set(b, htmlResponse(null)) // ganz ohne Content-Type
  entries.set(url('c'), new Response(bytes(500), { status: 200, headers: { 'Content-Type': 'audio/mp3' } }))

  expect(await isSaved(a, { caches: storage })).toBe(false)
  expect(await isSaved(b, { caches: storage })).toBe(false)
  expect(await isSaved(url('c'), { caches: storage })).toBe(true) // jeder audio/*-Typ zählt
})

test('a cached page instead of the file is replaced by the next save', async () => {
  const a = url('a')
  const data = bytes(3000)
  const cache = await caches.open(MEDITATION_CACHE)
  await cache.put(a, htmlResponse())
  expect(await isSaved(a)).toBe(false)

  const fetch = fakeFetch({ [a]: { data } })
  expect(await saveMeditation(a, undefined, { fetch })).toBe('saved')

  expect(fetch.calls).toEqual([a]) // nicht als „schon gespeichert“ übersprungen
  expect(await isSaved(a)).toBe(true)
  const cached = await cache.match(a)
  expect(cached?.headers.get('Content-Type')).toBe('audio/mpeg')
  expect(new Uint8Array(await cached!.arrayBuffer())).toEqual(data)
})

test('a cached page is gone even when the new download fails', async () => {
  const a = url('a')
  const cache = await caches.open(MEDITATION_CACHE)
  await cache.put(a, htmlResponse())

  expect(await saveMeditation(a, undefined, { fetch: fakeFetch({ [a]: { data: bytes(3000), errorAt: 500 } }) })).toBe('failed')

  expect(await cachedKeys()).toEqual([])
})
