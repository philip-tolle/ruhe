import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

// Der Browser läuft in Berlin, die Uhr ist vorgegeben; so hängt kein Test von der Zeitzone des Rechners ab.
test.use({ timezoneId: 'Europe/Berlin' })

test.describe('prepaint', () => {
  // Alle App-Skripte werden abgebrochen: Bleibt die Stimmung trotzdem gesetzt, kam sie aus dem
  // Inline-Skript in index.html und nicht aus der App.
  test.beforeEach(async ({ page }) => {
    await page.route('**/assets/*.js', (route) => route.abort())
  })

  test('prepaint: the mood is set before the app script runs', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-22T08:00:00+02:00'))
    await page.goto('./')
    await expect(page.locator('html')).toHaveAttribute('data-tageszeit', 'morgen')
    // Die App selbst ist nicht gestartet.
    await expect(page.locator('#app')).toBeEmpty()
  })

  test('prepaint: the evening is the default late in the day', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-22T20:00:00+02:00'))
    await page.goto('./')
    await expect(page.locator('html')).toHaveAttribute('data-tageszeit', 'abend')
    await expect(page.locator('#app')).toBeEmpty()
  })
})

// Die Uhr läuft (install statt setFixedTime): Der Minuten-Takt der App soll feuern können.
const at = (time: string) => new Date(`2026-10-22T${time}+02:00`)
const html = (page: Page) => page.locator('html')
const greeting = (page: Page) => page.getByRole('heading', { level: 1 })
const suggestionCard = (page: Page) =>
  page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Vorschlag des Tages', exact: true }) })

// Titel je Thema aus dem Katalog: Der Vorschlag kommt morgens aus „fokus“, nachmittags aus „stress“.
type Entry = { title: string; category: string }
const CATALOG: Entry[] = JSON.parse(readFileSync('src/content/meditations.json', 'utf8')).meditations
const titlesOf = (category: string) =>
  new RegExp(
    CATALOG.filter((m) => m.category === category)
      .map((m) => m.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|'),
  )

test.describe('mood', () => {
  for (const [time, mood, text] of [
    ['08:00:00', 'morgen', 'Guten Morgen'],
    ['14:00:00', 'tag', 'Guten Tag'],
    ['20:00:00', 'abend', 'Guten Abend'],
  ] as const) {
    test(`the mood follows the time of day: ${time} → ${mood}`, async ({ page }) => {
      await page.clock.install({ time: at(time) })
      await page.goto('./')
      await expect(greeting(page)).toHaveText(text)
      await expect(html(page)).toHaveAttribute('data-tageszeit', mood)
      // Die Statusleiste nimmt die Farbe oben am Himmel der Stimmung an.
      const colors = await page.evaluate(() => ({
        meta: document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content,
        sky: getComputedStyle(document.documentElement).getPropertyValue('--sky-top').trim(),
      }))
      expect(colors.meta).toBe(colors.sky)
    })
  }

  test('the mood changes while the app is open', async ({ page }) => {
    await page.clock.install({ time: at('10:59:30') })
    await page.goto('./')
    await expect(greeting(page)).toHaveText('Guten Morgen')
    await expect(html(page)).toHaveAttribute('data-tageszeit', 'morgen')
    await expect(suggestionCard(page)).toContainText(titlesOf('fokus'))
    await expect(suggestionCard(page).locator('img')).toHaveAttribute('src', /vorschlag-morgen\.webp$/)
    // Merker im Fenster: Übersteht er den Wechsel, wurde die Seite nicht neu geladen.
    await page.evaluate(() => ((window as unknown as { ruheMarker: boolean }).ruheMarker = true))

    await page.clock.runFor('01:00')

    await expect(html(page)).toHaveAttribute('data-tageszeit', 'tag')
    await expect(greeting(page)).toHaveText('Guten Tag')
    // Der Vorschlag wird mit der Tageszeit neu bestimmt.
    await expect(suggestionCard(page)).toContainText(titlesOf('stress'))
    await expect(suggestionCard(page).locator('img')).toHaveAttribute('src', /vorschlag-tag\.webp$/)
    expect(await page.evaluate(() => (window as unknown as { ruheMarker?: boolean }).ruheMarker)).toBe(true)
  })

  test('returning to the app after hours updates at once', async ({ page }) => {
    await page.clock.install({ time: at('16:00:00') })
    await page.goto('./')
    await expect(greeting(page)).toHaveText('Guten Tag')
    await expect(html(page)).toHaveAttribute('data-tageszeit', 'tag')

    // Zwei Stunden später, ohne dass ein Timer gefeuert hat (wie nach dem Entsperren).
    await page.clock.setSystemTime(at('18:00:00'))
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

    // Sofort, nicht erst zur nächsten vollen Minute.
    await expect(html(page)).toHaveAttribute('data-tageszeit', 'abend', { timeout: 1000 })
    await expect(greeting(page)).toHaveText('Guten Abend', { timeout: 1000 })
  })
})
