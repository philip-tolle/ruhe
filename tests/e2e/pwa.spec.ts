import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

test('manifest matches spec', async ({ page, request }) => {
  await page.goto('./')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const m = await (await request.get(new URL(href!, page.url()).href)).json()
  expect(m).toMatchObject({ name: 'Ruhe', short_name: 'Ruhe', display: 'standalone', orientation: 'portrait',
    lang: 'de', start_url: '/ruhe/', scope: '/ruhe/', theme_color: '#0B1026', background_color: '#0B1026' })
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512', '512x512'])
  expect(m.icons[2].purpose).toBe('maskable')
  for (const i of m.icons) {
    const r = await request.get(new URL(i.src, page.url()).href)
    expect(r.status()).toBe(200); expect(r.headers()['content-type']).toContain('image/png')
  }
})

test('works offline after first visit', async ({ page, context }) => {
  await page.goto('./')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  // Auch die Klangschale liegt im Speicher. Workbox hängt dort eine Revision an die Adresse an.
  const bowl = new URL('audio/sounds/klangschale.ogg', page.url()).href
  expect(await page.evaluate(async (url) => (await caches.match(url, { ignoreSearch: true })) instanceof Response, bowl)).toBe(true)
  await context.setOffline(true)
  expect(await page.evaluate(async (url) => (await fetch(url)).ok, bowl)).toBe(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Guten (Morgen|Tag|Abend)$/)
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Klänge' }).click()
  await page.getByRole('button', { name: 'Kaminfeuer' }).click()
  await expect(page.getByRole('button', { name: 'Kaminfeuer' })).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 })
  await page.getByRole('button', { name: 'Regen' }).click()
  await expect(page.getByRole('button', { name: 'Regen' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Meditieren' }).click()
  await page.getByRole('button', { name: 'Timer einstellen' }).click()
  await page.getByRole('button', { name: 'Starten' }).click()
  await expect(page.getByText('Ankommen', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0)
})

test('music is not precached, the breath sounds are', async ({ page, request }) => {
  await page.goto('./')
  // Die Liste des Precache steht im gebauten Service Worker.
  const sw = await (await request.get(new URL('sw.js', page.url()).href)).text()
  expect(sw).toContain('audio/breath/ein.ogg')
  expect(sw).toContain('audio/breath/aus.ogg')
  expect(sw).not.toMatch(/audio\/music\/[a-z-]+\.opus/)
  // Gespeichert wird nur `audio/*`; so liefert der Server die Musik aus (GitHub Pages ebenso).
  const music = await request.get(new URL('audio/music/klavier.opus', page.url()).href)
  expect(music.status()).toBe(200)
  expect(music.headers()['content-type']).toBe('audio/ogg')
})

test('all 35 painted motifs are precached and available offline', async ({ page, context }) => {
  const ids = (JSON.parse(readFileSync('content/motive.json', 'utf8')).motive as { id: string }[]).map((m) => m.id)
  expect(ids).toHaveLength(35)
  await page.goto('./')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const urls = ids.map((id) => new URL(`images/motive/${id}.webp`, page.url()).href)
  // Wie bei der Klangschale: Workbox hängt eine Revision an die Adresse an. Die Liste der fehlenden
  // Motive macht einen Fehlschlag lesbar.
  const missing = await page.evaluate(async (list) => {
    const absent: string[] = []
    for (const url of list) if (!((await caches.match(url, { ignoreSearch: true })) instanceof Response)) absent.push(url)
    return absent
  }, urls)
  expect(missing).toEqual([])
  await context.setOffline(true)
  const broken = await page.evaluate(async (list) => {
    const bad: string[] = []
    for (const url of list) {
      const response = await fetch(url)
      if (!response.ok || response.headers.get('Content-Type') !== 'image/webp') bad.push(url)
    }
    return bad
  }, urls)
  expect(broken).toEqual([])
})

test('the three washes are precached and available offline', async ({ page, context }) => {
  const farben = (JSON.parse(readFileSync('content/waschungen.json', 'utf8')).waschungen as { id: string }[]).map((w) => w.id)
  expect(farben).toEqual(['lavendel', 'pfirsich', 'blaugruen'])
  await page.goto('./')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const urls = farben.map((farbe) => new URL(`images/waschungen/${farbe}.webp`, page.url()).href)
  // Wie bei den Motiven: Workbox hängt eine Revision an die Adresse an; die Liste der fehlenden Dateien macht
  // einen Fehlschlag lesbar.
  const missing = await page.evaluate(async (list) => {
    const absent: string[] = []
    for (const url of list) if (!((await caches.match(url, { ignoreSearch: true })) instanceof Response)) absent.push(url)
    return absent
  }, urls)
  expect(missing).toEqual([])
  await context.setOffline(true)
  const broken = await page.evaluate(async (list) => {
    const bad: string[] = []
    for (const url of list) {
      const response = await fetch(url)
      if (!response.ok || response.headers.get('Content-Type') !== 'image/webp') bad.push(url)
    }
    return bad
  }, urls)
  expect(broken).toEqual([])
})

test('a saved meditation is served from the cache with range support while offline', async ({ page, context }) => {
  await page.goto('./')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  // Die MP3 liegt nicht im Precache (zu groß); sie kommt erst durch das Speichern in den Cache.
  // Mit Version wie in der App (audioUrl): Die Route des Service Workers muss auch die Abfrage verstehen.
  const file = new URL('audio/meditations/drei-minuten-atempause.mp3?v=0123456789', page.url()).href
  expect(await page.evaluate(async (url) => (await caches.match(url, { ignoreSearch: true })) === undefined, file)).toBe(true)

  // So speichert die App (src/lib/offline/meditations.ts): vollständig laden, dann als 200 in `ruhe-meditations`.
  const saved = await page.evaluate(async (url) => {
    const body = await (await fetch(url)).blob()
    const cache = await caches.open('ruhe-meditations')
    await cache.put(url, new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(body.size) },
    }))
    return { size: body.size, head: Array.from(new Uint8Array(await body.slice(0, 100).arrayBuffer())) }
  }, file)
  expect(saved.size).toBeGreaterThan(100)

  await context.setOffline(true)
  const partial = await page.evaluate(async (url) => {
    const response = await fetch(url, { headers: { Range: 'bytes=0-99' } })
    return {
      status: response.status,
      contentRange: response.headers.get('Content-Range'),
      bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
    }
  }, file)
  expect(partial.status).toBe(206)
  expect(partial.contentRange).toBe(`bytes 0-99/${saved.size}`)
  expect(partial.bytes).toHaveLength(100)
  expect(partial.bytes).toEqual(saved.head)
})

test('the meditation cache takes only audio, never a page in place of a file', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  // Der Vorschau-Server liefert für eine unbekannte Adresse die Startseite mit 200 (wie manche Hoster).
  const missing = new URL('audio/meditations/gibt-es-nicht.mp3?v=0000000000', page.url()).href
  const answer = await page.evaluate(async (url) => {
    const response = await fetch(url)
    return { status: response.status, type: response.headers.get('Content-Type') }
  }, missing)
  expect(answer.status).toBe(200)
  expect(answer.type).toContain('text/html')

  // Der Service Worker schreibt nach der Antwort in den Cache; ihm bleibt etwas Zeit dafür.
  await page.waitForTimeout(1000)
  const cached = await page.evaluate(async () => (await (await caches.open('ruhe-meditations')).keys()).map((r) => r.url))
  expect(cached).toEqual([])
})
