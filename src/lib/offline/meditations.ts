// Offline-Speicher der geführten Meditationen (Spec 6.5).
//
// Die MP3-Dateien sind zu groß für den Precache. Beim Streamen fragt der Browser nur Teilstücke
// (206) an, und die lassen sich nicht cachen; deshalb lädt `saveMeditation` die Datei zusätzlich
// vollständig und legt sie erst nach vollem Empfang in den Cache `ruhe-meditations`. Aus diesem
// Cache liefert der Service Worker mit Range-Unterstützung aus (vite.config.ts → runtimeCaching),
// sodass Spulen auch offline geht. Der Offline-Status einer Meditation kommt allein aus dem Cache.
//
// Cache Storage, fetch und StorageManager sind für Tests austauschbar (`OfflineDeps`);
// ohne Angabe gelten die globalen. Adressen werden gegen `location.href` aufgelöst, damit der
// Schlüssel im Cache genau die Adresse ist, die auch die Workbox-Route sieht.

export const MEDITATION_CACHE = 'ruhe-meditations'

export interface OfflineDeps {
  caches?: CacheStorage
  fetch?: typeof fetch
  storage?: StorageManager
}

export type SaveResult = 'saved' | 'quota' | 'failed'

function absolute(url: string): string {
  return new URL(url, location.href).href
}

function openCache(deps: OfflineDeps): Promise<Cache> {
  return (deps.caches ?? caches).open(MEDITATION_CACHE)
}

// Speicher voll: Chrome und Firefox werfen eine DOMException mit diesem Namen.
function isQuotaError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'QuotaExceededError'
}

// Ganzzahlige Content-Length, sonst `undefined`: fehlt sie, ist sie unlesbar, oder die Antwort hat
// ein Content-Encoding (dann gilt die Länge vor dem Entpacken, der Strom liefert aber entpackte Bytes).
function declaredLength(response: Response): number | undefined {
  if (response.headers.has('Content-Encoding')) return undefined
  const header = response.headers.get('Content-Length')
  return header !== null && /^\d+$/.test(header) ? Number(header) : undefined
}

function isAudio(response: Response): boolean {
  return /^audio\//i.test(response.headers.get('Content-Type') ?? '')
}

async function bodyLength(response: Response): Promise<number> {
  const reader = response.body?.getReader()
  if (!reader) return 0
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return length
    length += value.byteLength
  }
}

async function savedIn(cache: Cache, address: string): Promise<boolean> {
  const response = await cache.match(address)
  // Nur eine vollständige 200-Antwort zählt, nie ein 206.
  if (!response || response.status !== 200) return false
  // Ohne prüfbare Länge (fehlt oder Content-Encoding) genügt die 200-Antwort; eine unlesbare
  // Content-Length dagegen gilt als beschädigt.
  if (response.headers.has('Content-Encoding') || !response.headers.has('Content-Length')) return true
  const declared = declaredLength(response)
  return declared !== undefined && (await bodyLength(response)) === declared
}

/**
 * Ob die Meditation vollständig gespeichert ist: eine gecachte 200-Antwort, deren Inhalt so lang
 * ist wie ihr `Content-Length`. Fehlt der Header, genügt jede gecachte 200-Antwort.
 * Ist der Cache nicht lesbar, gilt die Meditation als nicht gespeichert.
 */
export async function isSaved(url: string, deps: OfflineDeps = {}): Promise<boolean> {
  try {
    return await savedIn(await openCache(deps), absolute(url))
  } catch {
    return false
  }
}

/**
 * Lädt die Meditation vollständig (als Strom, mit Fortschritt) und legt sie erst danach in den
 * Cache. Abbruch, Netz- oder HTTP-Fehler, eine Antwort, die kein `audio/*` ist → `'failed'`, voller
 * Speicher → `'quota'`; in beiden Fällen bleibt nichts Halbes zurück, auch kein früherer
 * unvollständiger Eintrag (er wird vor dem Laden gelöscht). `onProgress(loaded, total)`: `total` ist
 * die `Content-Length`, 0 wenn sie unbekannt ist. Eine bereits vollständig gespeicherte Datei wird
 * nicht noch einmal geladen.
 */
export async function saveMeditation(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
  deps: OfflineDeps = {},
): Promise<SaveResult> {
  try {
    const address = absolute(url)
    const cache = await openCache(deps)
    if (await savedIn(cache, address)) return 'saved'
    // Was da liegt, ist unvollständig (oder eine Teilantwort): Der Service Worker würde es beim
    // Abspielen ausliefern, auch wenn das Laden jetzt scheitert. Also weg damit.
    await cache.delete(address)
    void requestPersistOnce(deps) // nicht abwarten: Eine hängende Anfrage darf das Speichern nie blockieren

    const get = deps.fetch ?? fetch
    const response = await get(address)
    if (response.status !== 200 || !response.body || !isAudio(response)) return 'failed'
    const declared = declaredLength(response)
    const total = declared ?? 0

    const reader = response.body.getReader()
    const chunks: Uint8Array<ArrayBuffer>[] = []
    let loaded = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        loaded += value.byteLength
        onProgress?.(loaded, total)
      }
    } finally {
      reader.cancel().catch(() => {})
    }

    // Ein Strom, der früher endet als angekündigt, ist unvollständig, auch ohne Fehler.
    if (loaded === 0 || (declared !== undefined && loaded !== declared)) return 'failed'

    const body = new Blob(chunks, { type: 'audio/mpeg' })
    await cache.put(
      address,
      new Response(body, { status: 200, headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(body.size) } }),
    )
    return 'saved'
  } catch (error) {
    return isQuotaError(error) ? 'quota' : 'failed'
  }
}

/**
 * Speichert die Meditationen nacheinander. `onProgress(done, total, bytes)`: erledigte Dateien
 * (gespeichert oder fehlgeschlagen), Anzahl insgesamt und bisher empfangene Bytes der
 * gespeicherten Dateien samt der laufenden (schon vorhandene Dateien zählen 0). Bei `'quota'` ist
 * Schluss; bisher Gespeichertes bleibt. `onSaved(url)` meldet jede Datei, die nun vollständig im
 * Cache liegt, auch eine, die schon da war.
 */
export async function saveAll(
  urls: string[],
  onProgress: (done: number, total: number, bytes: number) => void,
  deps: OfflineDeps = {},
  onSaved?: (url: string) => void,
): Promise<{ saved: number; failed: number; quota: boolean }> {
  const total = urls.length
  let saved = 0
  let failed = 0
  let received = 0 // Bytes der gespeicherten Dateien; Bruchstücke fehlgeschlagener zählen nicht
  onProgress(0, total, 0)
  for (const url of urls) {
    let loaded = 0
    const result = await saveMeditation(
      url,
      (now) => {
        loaded = now
        onProgress(saved + failed, total, received + loaded)
      },
      deps,
    )
    if (result === 'quota') return { saved, failed, quota: true }
    if (result === 'saved') {
      saved++
      received += loaded
      onSaved?.(url)
    } else {
      failed++
    }
    onProgress(saved + failed, total, received)
  }
  return { saved, failed, quota: false }
}

/**
 * Welche Adressen im Cache nicht zu den aktuellen gehören: Reste einer früheren Aufnahme (die
 * Adresse trägt die Version, siehe `audioUrl`), die nur Platz belegen. Reihenfolge des Caches.
 */
export function staleEntries(cachedUrls: readonly string[], currentUrls: readonly string[]): string[] {
  const current = new Set(currentUrls)
  return cachedUrls.filter((address) => !current.has(address))
}

/**
 * Löscht aus dem Cache alles, was keine der aktuellen Adressen ist, und liefert die Zahl der
 * gelöschten Einträge. Ist der Cache nicht lesbar, bleibt alles, wie es ist (0).
 */
export async function removeStale(currentUrls: readonly string[], deps: OfflineDeps = {}): Promise<number> {
  try {
    const cache = await openCache(deps)
    const cached = (await cache.keys()).map((request) => request.url)
    const stale = staleEntries(cached, currentUrls.map(absolute))
    const removed = await Promise.all(stale.map((address) => cache.delete(address).catch(() => false)))
    return removed.filter(Boolean).length
  } catch {
    return 0
  }
}

// Pro StorageManager wird nur einmal gefragt, solange die App läuft (im Speicher gemerkt).
const asked = new WeakSet<object>()

/**
 * Bittet beim ersten Speichern einmal um dauerhaften Speicher (`navigator.storage.persist()`),
 * damit der Browser die Meditationen nicht von sich aus wieder löscht. Fehler bleiben still.
 */
export async function requestPersistOnce(deps: OfflineDeps = {}): Promise<void> {
  try {
    const storage = deps.storage ?? navigator.storage
    if (!storage || typeof storage.persist !== 'function' || asked.has(storage)) return
    asked.add(storage)
    await storage.persist()
  } catch {
    // Dauerhafter Speicher ist nur ein Wunsch; die App läuft auch ohne.
  }
}

/** Für das erste Abspielen: speichert im Hintergrund, ohne zu warten; Fehler bleiben still. */
export function saveInBackground(url: string, deps: OfflineDeps = {}): void {
  saveMeditation(url, undefined, deps).catch(() => {})
}
