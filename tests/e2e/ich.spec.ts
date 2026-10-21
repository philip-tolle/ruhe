import { readFileSync } from 'node:fs'
import { test, expect, type Locator, type Page } from '@playwright/test'

// Sitzungen und Zeiten tragen ihren Offset und der Browser läuft in Berlin; so hängt kein Test
// von der Zeitzone des Rechners ab. „Heute“ ist der 21.10.2026, 20 Uhr.
test.use({ timezoneId: 'Europe/Berlin' })
const NOW = new Date('2026-10-21T20:00:00+02:00')

const session = (id: string, start: string, kind: 'timer' | 'breath', ref: string, seconds: number) => ({
  id,
  start,
  kind,
  ref,
  seconds,
})
const SESSIONS = [
  session('s-19', '2026-10-19T07:30:00+02:00', 'timer', 'timer', 600),
  session('s-20', '2026-10-20T07:30:00+02:00', 'timer', 'timer', 600),
  session('s-21', '2026-10-21T07:30:00+02:00', 'timer', 'timer', 600),
  session('s-sep', '2026-09-03T21:00:00+02:00', 'breath', '478', 76),
]
const SETTINGS = { vibration: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }
const backupOf = (sessions: object[], settings: object = SETTINGS) => ({ version: 1, sessions, settings })

// addInitScript läuft bei jeder Navigation (auch Neuladen); ein Merker in sessionStorage lässt es nur
// einmal je Test säen, damit Änderungen im Test ein Neuladen überstehen.
async function open(page: Page, data: object | null = backupOf(SESSIONS)) {
  await page.clock.setFixedTime(NOW)
  if (data) {
    await page.addInitScript((json) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('ruhe.v1', json)
    }, JSON.stringify(data))
  }
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Ich' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ich')
}

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
const storedText = (page: Page) => page.evaluate(() => localStorage.getItem('ruhe.v1'))

// Eine Kennzahl: Beschriftung (dt) und Wert (dd) in einer Kachel.
const figure = (page: Page, label: string) => page.locator('dl > div').filter({ has: page.getByText(label, { exact: true }) })
const value = (page: Page, label: string) => figure(page, label).locator('dd')

const marked = (page: Page, label: string) => page.getByLabel(`${label}, meditiert`, { exact: true })
const monthHeading = (page: Page, title: string) => page.getByRole('heading', { level: 2, name: title })

async function chooseFile(page: Page, file: { name: string; content: string }) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Backup importieren' }).click(),
  ])
  await chooser.setFiles({ name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.content) })
}

const heightOf = async (locator: Locator) => (await locator.boundingBox())!.height

// Die Karten „Offline“ und „Backup“ haben je eine eigene Meldung (role=status).
const card = (page: Page, title: string) =>
  page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: title, exact: true }) })
const backupStatus = (page: Page) => card(page, 'Backup').getByRole('status')
const offlineStatus = (page: Page) => card(page, 'Offline').getByRole('status')

const saveAll = (page: Page) => page.getByRole('button', { name: 'Alle offline speichern' })
const progress = (page: Page) => page.getByRole('progressbar')
const summary = (page: Page) => card(page, 'Offline').getByText(/Meditationen offline gespeichert/)
const SUMMARY = (saved: number) => new RegExp(`^${saved} von 9 Meditationen offline gespeichert \\((0|\\d+,\\d) MB\\)$`)
const balanceSlider = (page: Page) => page.getByRole('slider', { name: 'Balance Stimme ↔ Hintergrund' })
const nav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name }).click()

test('key figures: streak, minutes and sessions', async ({ page }) => {
  await open(page)
  await expect(figure(page, 'Serie')).toHaveCount(1)
  await expect(value(page, 'Serie')).toHaveText('3 Tage')
  await expect(value(page, 'Minuten gesamt')).toHaveText('31') // 1876 s
  await expect(value(page, 'Sitzungen')).toHaveText('4')
})

test('a fresh start shows zeros and no marks', async ({ page }) => {
  await open(page, null)
  await expect(value(page, 'Serie')).toHaveText('0 Tage')
  await expect(value(page, 'Minuten gesamt')).toHaveText('0')
  await expect(value(page, 'Sitzungen')).toHaveText('0')
  await expect(page.getByLabel(', meditiert')).toHaveCount(0)
  await expect(backupStatus(page)).toHaveText('')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a streak of one day reads in the singular', async ({ page }) => {
  await open(page, backupOf([session('only', '2026-10-21T07:30:00+02:00', 'timer', 'timer', 60)]))
  await expect(value(page, 'Serie')).toHaveText('1 Tag')
  await expect(value(page, 'Minuten gesamt')).toHaveText('1')
  await expect(value(page, 'Sitzungen')).toHaveText('1')
})

test('calendar marks meditated days and pages through the months', async ({ page }) => {
  await open(page)
  await expect(monthHeading(page, 'Oktober 2026')).toBeVisible()
  for (const day of ['19', '20', '21']) await expect(marked(page, `${day}. Oktober`)).toBeVisible()
  await expect(page.getByLabel(', meditiert')).toHaveCount(3)
  await expect(marked(page, '18. Oktober')).toHaveCount(0)

  // Wochenbeginn Montag: Der 1. Oktober 2026 ist ein Donnerstag, also die vierte Spalte der ersten Woche.
  await expect(page.getByRole('columnheader')).toHaveText(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
  const firstWeek = page.getByRole('row').nth(1).getByRole('cell')
  await expect(firstWeek).toHaveCount(7)
  await expect(firstWeek.nth(3)).toHaveText('1')
  await expect(firstWeek.nth(2)).toHaveText('')
  await expect(page.locator('[aria-current="date"]')).toHaveCount(1) // heute: der 21.

  await page.getByRole('button', { name: 'Vorheriger Monat' }).click()
  await expect(monthHeading(page, 'September 2026')).toBeVisible()
  await expect(marked(page, '3. September')).toBeVisible()
  await expect(page.getByLabel(', meditiert')).toHaveCount(1)
  await expect(page.locator('[aria-current="date"]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Nächster Monat' }).click()
  await expect(monthHeading(page, 'Oktober 2026')).toBeVisible()
  await expect(marked(page, '21. Oktober')).toBeVisible()
})

test('calendar pages across the year boundary in both directions', async ({ page }) => {
  await open(page)
  const next = page.getByRole('button', { name: 'Nächster Monat' })
  const previous = page.getByRole('button', { name: 'Vorheriger Monat' })
  await next.click()
  await expect(monthHeading(page, 'November 2026')).toBeVisible()
  await next.click()
  await expect(monthHeading(page, 'Dezember 2026')).toBeVisible()
  await next.click()
  await expect(monthHeading(page, 'Januar 2027')).toBeVisible()
  await previous.click()
  await expect(monthHeading(page, 'Dezember 2026')).toBeVisible()
  for (let i = 0; i < 11; i++) await previous.click()
  await expect(monthHeading(page, 'Januar 2026')).toBeVisible()
  await previous.click()
  await expect(monthHeading(page, 'Dezember 2025')).toBeVisible()
  await expect(page.getByLabel(', meditiert')).toHaveCount(0)
})

test('paging the calendar keeps the scroll position and the focus on the button', async ({ page }) => {
  // Ohne Einblend-Animation: Playwright rückt ein Ziel, das sich noch bewegt, selbst zurecht.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  const next = page.getByRole('button', { name: 'Nächster Monat' })
  const previous = page.getByRole('button', { name: 'Vorheriger Monat' })
  const scrollY = () => page.evaluate(() => Math.round(window.scrollY))
  await page.evaluate(() => window.scrollBy(0, 120))
  const before = await scrollY()
  expect(before).toBeGreaterThan(0)
  // Von Oktober 2026 bis April 2027 und zurück bis August 2026: Monate mit vier (Februar 2027),
  // fünf und sechs Wochen (November und August 2026). Die Seitenhöhe darf sich dabei nicht ändern,
  // sonst rutschen Einstellungen und Backup unter dem Finger weg.
  const heights = new Set<number>([Math.round(await heightOf(page.locator('main')))])
  for (let i = 0; i < 6; i++) {
    await next.click()
    heights.add(Math.round(await heightOf(page.locator('main'))))
  }
  await expect(monthHeading(page, 'April 2027')).toBeVisible()
  for (let i = 0; i < 8; i++) {
    await previous.click()
    heights.add(Math.round(await heightOf(page.locator('main'))))
  }
  await expect(monthHeading(page, 'August 2026')).toBeVisible()
  expect(await scrollY()).toBe(before)
  expect([...heights]).toHaveLength(1)
  await expect(previous).toBeFocused()
})

test('settings are saved at once and shared with the timer sheet', async ({ page }) => {
  await open(page)
  const vibration = page.getByRole('switch', { name: 'Vibration bei Atemübungen' })
  const lead = page.getByRole('switch', { name: '10 Sekunden ankommen' })
  const sound = page.getByRole('combobox', { name: 'Standard-Hintergrundklang' })
  await expect(page.getByRole('heading', { level: 2, name: 'Einstellungen' })).toBeVisible()
  await expect(vibration).toHaveAttribute('aria-checked', 'true')
  await expect(lead).toHaveAttribute('aria-checked', 'true')
  await expect(sound.locator('option:checked')).toHaveText('Keiner')
  await expect(sound.getByRole('option')).toHaveText([
    'Keiner',
    'Regen',
    'Meeresrauschen',
    'Wind',
    'Braunes Rauschen',
    'Wald mit Vögeln',
    'Kaminfeuer',
    'Bach',
    'Klangschalen',
  ])

  await vibration.click()
  await expect(vibration).toHaveAttribute('aria-checked', 'false')
  expect((await stored(page)).settings.vibration).toBe(false)
  await lead.click()
  await expect(lead).toHaveAttribute('aria-checked', 'false')
  expect((await stored(page)).settings.timerLead).toBe(false)
  await sound.selectOption({ label: 'Regen' })
  expect((await stored(page)).settings.timerSound).toBe('regen')
  expect((await stored(page)).sessions).toHaveLength(4)

  // Derselbe Wert wie im Timer-Sheet unter „Meditieren“.
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Meditieren' }).click()
  await expect(page.getByText('10 Min · ohne Zwischenschale · Regen')).toBeVisible()
  await page.getByRole('button', { name: 'Timer einstellen' }).click()
  await expect(page.getByLabel('Hintergrundklang', { exact: true })).toHaveValue('regen')
  await expect(page.getByRole('switch', { name: '10 Sekunden ankommen' })).toHaveAttribute('aria-checked', 'false')
  await page.goBack()

  // Und zurück: „Keiner“ speichert null; nach dem Neuladen bleibt alles.
  await nav.getByRole('button', { name: 'Ich' }).click()
  await sound.selectOption({ label: 'Keiner' })
  expect((await stored(page)).settings.timerSound).toBeNull()
  await page.reload()
  await nav.getByRole('button', { name: 'Ich' }).click()
  await expect(vibration).toHaveAttribute('aria-checked', 'false')
  await expect(lead).toHaveAttribute('aria-checked', 'false')
  await expect(sound.locator('option:checked')).toHaveText('Keiner')
})

test('the balance slider is saved on release', async ({ page }) => {
  await open(page)
  const slider = balanceSlider(page)
  await expect(page.getByRole('heading', { level: 2, name: 'Einstellungen' })).toBeVisible()
  await expect(slider).toHaveValue('50')
  expect(await slider.getAttribute('aria-valuetext')).toBe('50 % Hintergrund')

  // Beim Ziehen folgt die Anzeige, gespeichert wird erst beim Loslassen.
  await slider.evaluate((el: HTMLInputElement) => {
    el.value = '30'
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(slider).toHaveAttribute('aria-valuetext', '30 % Hintergrund')
  await expect(slider).toHaveAttribute('style', /--v: 0\.3/)
  expect((await stored(page)).settings.voiceBalance).toBe(0.5)
  await slider.evaluate((el: HTMLInputElement) => el.dispatchEvent(new Event('change', { bubbles: true })))
  await expect.poll(async () => (await stored(page)).settings.voiceBalance).toBe(0.3)

  await slider.fill('85')
  await expect.poll(async () => (await stored(page)).settings.voiceBalance).toBe(0.85)
  expect((await stored(page)).settings.guidedSound).toBeNull()
  expect((await stored(page)).sessions).toHaveLength(4)

  await page.reload()
  await nav(page, 'Ich')
  await expect(slider).toHaveValue('85')
})

test('the balance is the same value as in the guided player', async ({ page }) => {
  await open(page)
  await balanceSlider(page).fill('20')
  await expect.poll(async () => (await stored(page)).settings.voiceBalance).toBe(0.2)

  await nav(page, 'Meditieren')
  await page.getByRole('button', { name: /^Guten Morgen, \d+ Minuten?/ }).click()
  const player = page.getByRole('dialog', { name: 'Geführte Meditation' })
  await player.getByRole('combobox', { name: 'Hintergrundklang' }).selectOption({ label: 'Regen' })
  const inPlayer = player.getByRole('slider', { name: 'Balance Stimme ↔ Hintergrund' })
  await expect(inPlayer).toHaveValue('20')

  // Und zurück: Was im Player eingestellt wird, steht danach unter „Ich“.
  await inPlayer.fill('80')
  await expect.poll(async () => (await stored(page)).settings.voiceBalance).toBe(0.8)
  await player.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await nav(page, 'Ich')
  await expect(balanceSlider(page)).toHaveValue('80')
})

test('an imported backup brings its balance along', async ({ page }) => {
  await open(page)
  await expect(balanceSlider(page)).toHaveValue('50')
  await chooseFile(page, { name: 'b.json', content: JSON.stringify(backupOf([], { ...SETTINGS, voiceBalance: 0.65 })) })
  await expect(backupStatus(page)).toHaveText('0 neue Sitzungen importiert.')
  await expect(balanceSlider(page)).toHaveValue('65')
})

test('the balance slider follows an import after a drag that ended where it began', async ({ page }) => {
  await open(page)
  const slider = balanceSlider(page)
  // Ziehen und zurück an den Anfang: Es gibt kein „change“, der Wert ist wie vorher.
  await slider.evaluate((el: HTMLInputElement) => {
    for (const value of ['70', '30', '50']) {
      el.value = value
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await expect(slider).toHaveValue('50')
  expect((await stored(page)).settings.voiceBalance).toBe(0.5)

  // Kommt der Wert danach von außen, zeigt der Regler ihn (und nicht den Rest des Ziehens).
  await chooseFile(page, { name: 'b.json', content: JSON.stringify(backupOf([], { ...SETTINGS, voiceBalance: 0.65 })) })
  await expect(backupStatus(page)).toHaveText('0 neue Sitzungen importiert.')
  await expect(slider).toHaveValue('65')
})

test('the offline card sits above the backup and starts empty', async ({ page }) => {
  await open(page)
  const heading = page.getByRole('heading', { level: 2, name: 'Offline', exact: true })
  await expect(heading).toBeVisible()
  const offlineBox = (await heading.boundingBox())!
  const backupBox = (await page.getByRole('heading', { level: 2, name: 'Backup' }).boundingBox())!
  expect(offlineBox.y).toBeLessThan(backupBox.y)

  await expect(summary(page)).toHaveText('0 von 9 Meditationen offline gespeichert (0 MB)')
  await expect(saveAll(page)).toBeEnabled()
  await expect(progress(page)).toHaveCount(0)
  await expect(offlineStatus(page)).toHaveText('')
  await expect(backupStatus(page)).toHaveText('')
})

test('saving is not offered without a network', async ({ page, context }) => {
  await open(page)
  await expect(saveAll(page)).toBeEnabled()
  await context.setOffline(true)
  await expect(saveAll(page)).toBeDisabled()
  await context.setOffline(false)
  await expect(saveAll(page)).toBeEnabled()
})

test('a meditation saved while playing counts in the summary', async ({ page }) => {
  await page.goto('./')
  await nav(page, 'Meditieren')
  await page.getByRole('button', { name: /^Drei-Minuten-Atempause, \d+ Minuten?/ }).click()
  await page.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await nav(page, 'Ich')
  await expect(summary(page)).toHaveText(/^1 von 9 Meditationen offline gespeichert \(\d+,\d MB\)$/) // die Datei hat eine Größe
  await expect(saveAll(page)).toBeEnabled()
})

test.describe('saving all meditations', () => {
  // Ohne Service Worker: Sonst beantwortete er den Abruf an der Route vorbei (und Playwright sähe ihn nicht).
  test.use({ serviceWorkers: 'block' })

  const cachedAddresses = (page: Page) =>
    page.evaluate(async () => (await (await caches.open('ruhe-meditations')).keys()).map((r) => r.url))

  test('shows the progress, ends with a message, and every meditation reads offline', async ({ page }) => {
    // Die Nachfrage nach dauerhaftem Speicher läuft beim ersten Speichern, genau einmal.
    await page.addInitScript(() => {
      const w = window as unknown as { __persist: number }
      w.__persist = 0
      StorageManager.prototype.persist = async () => {
        w.__persist++
        return true
      }
    })
    // Die dritte Datei hält der Test fest, damit der Zwischenstand zu sehen ist.
    const requests: string[] = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/audio/meditations/**', async (route) => {
      requests.push(route.request().url())
      if (requests.length === 3) await gate
      await route.continue()
    })
    await open(page)
    await expect(summary(page)).toHaveText('0 von 9 Meditationen offline gespeichert (0 MB)')

    await saveAll(page).click()
    await expect(page.getByText('Speichere 3 von 9 …')).toBeVisible()
    const bar = progress(page)
    await expect(bar).toBeVisible()
    await expect(bar).toHaveAccessibleName('Speichere 3 von 9 …')
    await expect(bar).toHaveAttribute('aria-valuemin', '0')
    await expect(bar).toHaveAttribute('aria-valuemax', '100')
    const now = Number(await bar.getAttribute('aria-valuenow'))
    expect(now).toBeGreaterThan(0)
    expect(now).toBeLessThan(100)
    await expect(saveAll(page)).toBeDisabled()
    await expect(offlineStatus(page)).toHaveText('')

    // Der Stand gehört der App, nicht dem Reiter: Wer wegwechselt und zurückkommt, sieht ihn weiter.
    await nav(page, 'Meditieren')
    await nav(page, 'Ich')
    await expect(page.getByText('Speichere 3 von 9 …')).toBeVisible()
    await expect(saveAll(page)).toBeDisabled()

    release()
    await expect(offlineStatus(page)).toHaveText('Alle Meditationen sind offline verfügbar.')
    await expect(summary(page)).toHaveText(SUMMARY(9))
    await expect(progress(page)).toHaveCount(0)
    await expect(saveAll(page)).toBeDisabled() // es gibt nichts mehr zu speichern
    expect(requests).toHaveLength(9)
    expect(await page.evaluate(() => (window as unknown as { __persist: number }).__persist)).toBe(1)
    expect(await cachedAddresses(page)).toHaveLength(9)

    // „Meditieren“ zeigt überall „✓ offline“, ohne dass eine Datei nochmals geladen wird.
    await nav(page, 'Meditieren')
    await expect(page.getByText('✓ offline', { exact: true })).toHaveCount(9)
    await expect(page.getByText('Nicht offline verfügbar')).toHaveCount(0)
    expect(requests).toHaveLength(9)

    // Auch nach dem Neuladen kommt der Stand aus dem Cache; die Meldung ist weg.
    await page.reload()
    await nav(page, 'Ich')
    await expect(summary(page)).toHaveText(SUMMARY(9))
    await expect(offlineStatus(page)).toHaveText('')
    await expect(saveAll(page)).toBeDisabled()
  })

  test('full storage stops at once and keeps what was saved', async ({ page }) => {
    // Das dritte Speichern scheitert mit „Speicher voll“, wie es ein echtes Gerät meldet.
    await page.addInitScript(() => {
      const put = Cache.prototype.put
      let puts = 0
      Cache.prototype.put = function (...args: Parameters<Cache['put']>) {
        return ++puts === 3 ? Promise.reject(new DOMException('voll', 'QuotaExceededError')) : put.apply(this, args)
      }
    })
    const requests: string[] = []
    await page.route('**/audio/meditations/**', (route) => {
      requests.push(route.request().url())
      return route.continue()
    })
    await open(page)

    await saveAll(page).click()
    await expect(offlineStatus(page)).toHaveText('Nicht genug Speicherplatz. Bereits Gespeichertes bleibt erhalten.')
    await expect(summary(page)).toHaveText(SUMMARY(2))
    await expect(progress(page)).toHaveCount(0)
    await expect(saveAll(page)).toBeEnabled() // es lässt sich nach dem Aufräumen wiederholen
    expect(requests).toHaveLength(3) // nach der dritten Datei ist Schluss
    expect(await cachedAddresses(page)).toHaveLength(2)

    await nav(page, 'Meditieren')
    await expect(page.getByText('✓ offline', { exact: true })).toHaveCount(2)

    // Wieder bei Ich: Ein neuer Versuch (jetzt ist Platz) lädt nur den Rest und meldet Erfolg.
    await nav(page, 'Ich')
    await expect(offlineStatus(page)).toHaveText('') // die alte Meldung ist weg
    await saveAll(page).click()
    await expect(offlineStatus(page)).toHaveText('Alle Meditationen sind offline verfügbar.')
    await expect(summary(page)).toHaveText(SUMMARY(9))
    expect(requests).toHaveLength(3 + 7)
  })

  test('a result that arrives while the user is on another tab is shown on return, once', async ({ page }) => {
    await page.addInitScript(() => {
      const put = Cache.prototype.put
      let puts = 0
      Cache.prototype.put = function (...args: Parameters<Cache['put']>) {
        if (++puts !== 3) return put.apply(this, args)
        ;(window as unknown as { __quotaHit: boolean }).__quotaHit = true
        return Promise.reject(new DOMException('voll', 'QuotaExceededError'))
      }
    })
    await open(page)

    await saveAll(page).click()
    await nav(page, 'Meditieren')
    // Der Lauf endet, während Ich nicht zu sehen ist (nach der Meldung ist noch ein Durchlauf nötig, bis
    // die Ergebnisse gesetzt sind).
    await page.waitForFunction(() => (window as unknown as { __quotaHit?: boolean }).__quotaHit === true)
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)))

    await nav(page, 'Ich')
    await expect(offlineStatus(page)).toHaveText('Nicht genug Speicherplatz. Bereits Gespeichertes bleibt erhalten.')
    await expect(summary(page)).toHaveText(SUMMARY(2))

    // Einmal gesehen: Wer wieder weg- und zurückgeht, findet sie nicht mehr.
    await nav(page, 'Meditieren')
    await nav(page, 'Ich')
    await expect(offlineStatus(page)).toHaveText('')
  })

  test('files that were there already count at once towards the progress', async ({ page }) => {
    const meditations: { file: string; version: string; bytes: number }[] = JSON.parse(
      readFileSync('src/content/meditations.json', 'utf8'),
    ).meditations
    const total = meditations.reduce((sum, m) => sum + m.bytes, 0)
    const last = meditations.at(-1)!
    const expected = Math.round(((total - last.bytes) / total) * 100)

    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    let requests = 0
    await page.route('**/audio/meditations/**', async (route) => {
      // Es werden nur acht Dateien geladen (die erste liegt schon im Cache); die letzte hält der Test fest.
      if (++requests === 8) await gate
      await route.continue()
    })
    await open(page)
    const first = meditations[0]
    await page.evaluate(
      async ({ file, version }) => {
        const cache = await caches.open('ruhe-meditations')
        await cache.put(
          new URL(`${file}?v=${version}`, location.href),
          new Response(new Uint8Array(1000), { headers: { 'Content-Type': 'audio/mpeg' } }),
        )
      },
      { file: first.file, version: first.version },
    )

    await saveAll(page).click()
    await expect(page.getByText('Speichere 9 von 9 …')).toBeVisible()
    // Die erste Datei war schon da und zählt mit ihrer Größe laut Katalog; die letzte hat noch kein Byte geliefert.
    await expect(progress(page)).toHaveAttribute('aria-valuenow', String(expected))
    release()
    await expect(offlineStatus(page)).toHaveText('Alle Meditationen sind offline verfügbar.')
    expect(requests).toBe(8)
    await expect(summary(page)).toHaveText(SUMMARY(9))
  })

  test('a file that fails does not stop the others and is counted', async ({ page }) => {
    const requests: string[] = []
    await page.route('**/audio/meditations/**', (route) => {
      requests.push(route.request().url())
      // Die dritte Datei: Server meldet „Insufficient Storage“ (507) – für die App ein Fehler dieser einen Datei.
      return requests.length === 3 ? route.fulfill({ status: 507, body: 'voll' }) : route.continue()
    })
    await open(page)

    await saveAll(page).click()
    await expect(offlineStatus(page)).toHaveText('8 von 9 gespeichert, 1 fehlgeschlagen.')
    await expect(summary(page)).toHaveText(SUMMARY(8))
    await expect(saveAll(page)).toBeEnabled()
    expect(requests).toHaveLength(9)

    await nav(page, 'Meditieren')
    await expect(page.getByText('✓ offline', { exact: true })).toHaveCount(8)

    // Ein neuer Versuch lädt nur die fehlende Datei.
    await nav(page, 'Ich')
    await saveAll(page).click()
    await expect(offlineStatus(page)).toHaveText('Alle Meditationen sind offline verfügbar.')
    await expect(summary(page)).toHaveText(SUMMARY(9))
    expect(requests).toHaveLength(10)
  })

  test('the entries of an old recording are removed first', async ({ page }) => {
    await open(page)
    // Zwei Reste früherer Aufnahmen (andere Version derselben Datei, und eine Datei ohne Version).
    await page.evaluate(async () => {
      const cache = await caches.open('ruhe-meditations')
      for (const name of ['guten-morgen.mp3?v=0000000000', 'guten-morgen.mp3'])
        await cache.put(new URL(`audio/meditations/${name}`, location.href), new Response(new Uint8Array(500)))
    })
    expect(await cachedAddresses(page)).toHaveLength(2)

    await saveAll(page).click()
    await expect(offlineStatus(page)).toHaveText('Alle Meditationen sind offline verfügbar.')

    const cached = await cachedAddresses(page)
    expect(cached).toHaveLength(9)
    expect(cached.filter((address) => address.includes('0000000000'))).toEqual([])
    expect(cached.every((address) => /\.mp3\?v=[0-9a-f]{10}$/.test(address))).toBe(true)
  })
})

test('touch targets are at least 48px', async ({ page }) => {
  await open(page)
  const targets = [
    page.getByRole('button', { name: 'Vorheriger Monat' }),
    page.getByRole('button', { name: 'Nächster Monat' }),
    page.getByRole('switch', { name: 'Vibration bei Atemübungen' }),
    page.getByRole('switch', { name: '10 Sekunden ankommen' }),
    page.getByRole('combobox', { name: 'Standard-Hintergrundklang' }),
    balanceSlider(page),
    saveAll(page),
    page.getByRole('button', { name: 'Backup exportieren' }),
    page.getByRole('button', { name: 'Backup importieren' }),
  ]
  for (const target of targets) {
    await target.scrollIntoViewIfNeeded()
    const box = (await target.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(48)
    expect(box.width).toBeGreaterThanOrEqual(48)
  }
})

test('export downloads the sessions and settings under the day of today', async ({ page }) => {
  await open(page)
  await expect(page.getByRole('heading', { level: 2, name: 'Backup' })).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Backup exportieren' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('ruhe-backup-2026-10-21.json')
  const file = JSON.parse(readFileSync((await download.path())!, 'utf8'))
  expect(file).toEqual(backupOf(SESSIONS))
})

test('import merges new sessions, skips known ones and takes over the settings', async ({ page }) => {
  await open(page)
  // Der Hinweis sagt vorher, dass die Einstellungen aus der Datei kommen.
  await expect(
    page.getByText(
      'Sichere deine Sitzungen und Einstellungen in einer Datei. Beim Importieren kommen neue Sitzungen dazu, die Einstellungen werden aus der Datei übernommen.',
    ),
  ).toBeVisible()
  const status = backupStatus(page)
  await expect(status).toHaveText('')
  const incoming = backupOf(
    [SESSIONS[0], session('s-new', '2026-09-04T08:00:00+02:00', 'timer', 'timer', 120)],
    { ...SETTINGS, vibration: false, timerLead: false, timerSound: 'wald' },
  )
  await chooseFile(page, { name: 'ruhe-backup.json', content: JSON.stringify(incoming) })
  await expect(status).toHaveText('1 neue Sitzung importiert.')
  await expect(value(page, 'Sitzungen')).toHaveText('5')
  await expect(value(page, 'Minuten gesamt')).toHaveText('33') // 1996 s
  await expect(value(page, 'Serie')).toHaveText('3 Tage')

  // Einstellungen stammen aus der Datei, auf dem Bildschirm und im Speicher.
  await expect(page.getByRole('switch', { name: 'Vibration bei Atemübungen' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('switch', { name: '10 Sekunden ankommen' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('combobox', { name: 'Standard-Hintergrundklang' })).toHaveValue('wald')
  const data = await stored(page)
  expect(data.settings).toMatchObject({ vibration: false, timerLead: false, timerSound: 'wald' })
  expect(data.sessions).toHaveLength(5)
  expect(data.sessions.map((s: { id: string }) => s.id)).toEqual(['s-sep', 's-new', 's-19', 's-20', 's-21'])

  // Das Eingabefeld ist wieder leer; dieselbe Datei lässt sich nochmals wählen und bringt nichts Neues.
  await expect(page.locator('input[type="file"]')).toHaveValue('')
  await chooseFile(page, { name: 'ruhe-backup.json', content: JSON.stringify(incoming) })
  await expect(status).toHaveText('0 neue Sitzungen importiert.')
  await expect(value(page, 'Sitzungen')).toHaveText('5')

  // Zwei neue Sitzungen stehen im Plural.
  const more = backupOf([
    session('s-a', '2026-08-01T08:00:00+02:00', 'timer', 'timer', 60),
    session('s-b', '2026-08-02T08:00:00+02:00', 'timer', 'timer', 60),
  ])
  await chooseFile(page, { name: 'mehr.json', content: JSON.stringify(more) })
  await expect(status).toHaveText('2 neue Sitzungen importiert.')
  await expect(value(page, 'Sitzungen')).toHaveText('7')
})

test('an invalid file explains itself and changes nothing', async ({ page }) => {
  await open(page)
  const status = backupStatus(page)
  const before = await storedText(page)
  const invalid: [string, string][] = [
    ['kaputt.json', '{nope'],
    ['leer.json', ''],
    ['falsche-version.json', JSON.stringify({ version: 2, sessions: [], settings: {} })],
    ['kaputte-sitzung.json', JSON.stringify(backupOf([SESSIONS[0], { id: 'x', start: 'gestern', kind: 'timer', ref: 'timer', seconds: 60 }]))],
  ]
  for (const [name, content] of invalid) {
    await chooseFile(page, { name, content })
    await expect(status).toHaveText('Diese Datei ist kein gültiges Ruhe-Backup.')
    await expect(value(page, 'Sitzungen')).toHaveText('4')
    expect(await storedText(page)).toBe(before)
    await expect(page.getByRole('switch', { name: 'Vibration bei Atemübungen' })).toHaveAttribute('aria-checked', 'true')
  }

  // Danach klappt ein gültiges Backup wieder, und das Ergebnis ersetzt die Fehlermeldung.
  await chooseFile(page, { name: 'ok.json', content: JSON.stringify(backupOf([session('s-new', '2026-09-04T08:00:00+02:00', 'timer', 'timer', 60)])) })
  await expect(status).toHaveText('1 neue Sitzung importiert.')
  await expect(value(page, 'Sitzungen')).toHaveText('5')
})

test('a failing save is announced above the backup', async ({ page }) => {
  await open(page)
  // Ab jetzt schlägt jedes Speichern fehl (Speicher voll).
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('voll', 'QuotaExceededError')
    }
  })
  const hint = page.getByText(
    'Speichern ist gerade nicht möglich – deine Daten gehen beim Schließen der App verloren. Exportiere ein Backup.',
  )
  await expect(hint).toHaveCount(0)
  const vibration = page.getByRole('switch', { name: 'Vibration bei Atemübungen' })
  await vibration.click()
  await expect(vibration).toHaveAttribute('aria-checked', 'false') // der Stand bleibt im Speicher
  await expect(hint).toBeVisible()
  // über dem Backup, nicht darunter
  const hintBox = (await hint.boundingBox())!
  const backupBox = (await page.getByRole('heading', { level: 2, name: 'Backup' }).boundingBox())!
  expect(hintBox.y).toBeLessThan(backupBox.y)
  // Der Export geht trotzdem.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Backup exportieren' }).click(),
  ])
  const file = JSON.parse(readFileSync((await download.path())!, 'utf8'))
  expect(file.settings.vibration).toBe(false)
})

test('nothing moves under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  await page.getByRole('switch', { name: '10 Sekunden ankommen' }).click()
  await page.getByRole('button', { name: 'Nächster Monat' }).click()
  await expect(page.getByRole('switch', { name: '10 Sekunden ankommen' })).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
})
