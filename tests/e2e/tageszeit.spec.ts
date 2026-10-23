import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { contrast, parseColor, type Rgba } from './color'

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
    await expect(suggestionCard(page).locator('img.motiv')).toHaveAttribute('src', /vorschlag-morgen\.webp$/)
    // Merker im Fenster: Übersteht er den Wechsel, wurde die Seite nicht neu geladen.
    await page.evaluate(() => ((window as unknown as { ruheMarker: boolean }).ruheMarker = true))

    await page.clock.runFor('01:00')

    await expect(html(page)).toHaveAttribute('data-tageszeit', 'tag')
    await expect(greeting(page)).toHaveText('Guten Tag')
    // Der Vorschlag wird mit der Tageszeit neu bestimmt.
    await expect(suggestionCard(page)).toContainText(titlesOf('stress'))
    await expect(suggestionCard(page).locator('img.motiv')).toHaveAttribute('src', /vorschlag-tag\.webp$/)
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

// Die berechnete Farbe eines Ausdrucks (`var(--accent)` usw.), gelesen über ein Hilfselement.
const resolveColor = (page: Page, expression: string) =>
  page.evaluate((value) => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = value
    document.body.appendChild(probe)
    const color = getComputedStyle(probe).backgroundColor
    probe.remove()
    return color
  }, expression)

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' })

// Sonne und Mond stehen oben rechts im festen Himmel, genau in der Spalte der Abspielknöpfe; beim Scrollen wandern
// Knöpfe und Chips über sie. Deckende Flächen lassen nichts durchscheinen, egal was dahinter steht.
test.describe('controls stay solid in front of the sun or the moon', () => {
  for (const [time, mood] of [
    ['08:00:00', 'morgen'],
    ['14:00:00', 'tag'],
    ['20:00:00', 'abend'],
  ] as const) {
    test(`the play disc is opaque and its icon in the accent has 3:1 against it: ${time} → ${mood}`, async ({ page }) => {
      await page.clock.setFixedTime(at(time))
      await page.goto('./')
      await expect(html(page)).toHaveAttribute('data-tageszeit', mood)
      await nav(page).getByRole('button', { name: 'Meditieren' }).click()
      const discs = page.locator('.entry:not(:disabled) .play')
      await expect(discs.first()).toBeVisible()
      const accent = parseColor(await resolveColor(page, 'var(--accent)'))
      const found = await discs.evaluateAll((els) =>
        els.map((el) => ({ background: getComputedStyle(el).backgroundColor, icon: getComputedStyle(el.querySelector('path')!).fill })),
      )
      expect(found.length).toBeGreaterThan(0)
      for (const disc of found) {
        const background = parseColor(disc.background)
        expect(background[3], disc.background).toBe(1)
        expect(parseColor(disc.icon)).toEqual(accent)
        // Bedienelement, kein Text: 3:1 (WCAG 1.4.11).
        expect(contrast(parseColor(disc.icon), background)).toBeGreaterThanOrEqual(3)
      }
    })

    test(`the unselected duration chips are opaque and their text has 4.5:1: ${time} → ${mood}`, async ({ page }) => {
      await page.clock.setFixedTime(at(time))
      await page.goto('./')
      await expect(html(page)).toHaveAttribute('data-tageszeit', mood)
      await nav(page).getByRole('button', { name: 'Atmen' }).click()
      const chips = page.getByRole('radiogroup', { name: 'Dauer' }).getByRole('radio', { checked: false })
      await expect(chips).toHaveCount(3)
      const found = await chips.evaluateAll((els) => els.map((el) => ({ background: getComputedStyle(el).backgroundColor, text: getComputedStyle(el).color })))
      for (const chip of found) {
        const background = parseColor(chip.background)
        expect(background[3], chip.background).toBe(1)
        expect(contrast(parseColor(chip.text), background)).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})

// Farbkanäle ohne Deckkraft, gerundet (color(srgb …) liefert Brüche).
const rgbOf = ([r, g, b]: Rgba) => [r, g, b].map(Math.round)
// Alle Farben in einem berechneten Wert wie `box-shadow`.
const colorsIn = (value: string) => [...value.matchAll(/(?:rgba?|color)\([^)]*\)/g)].map((m) => parseColor(m[0]))
const OLD_GOLD = '242, 201, 138'

test('by day the Klänge bar and the active tab take the mint accent, not the evening gold', async ({ page }) => {
  await page.clock.setFixedTime(at('14:00:00'))
  await page.goto('./')
  await expect(html(page)).toHaveAttribute('data-tageszeit', 'tag')
  await nav(page).getByRole('button', { name: 'Klänge' }).click()
  await page.getByRole('button', { name: 'Regen', exact: true }).click()
  const bar = page.locator('.dock .bar')
  await expect(bar).toBeVisible()

  const accent = rgbOf(parseColor(await resolveColor(page, 'var(--accent)')))
  // Am Tag ist der Akzent Mint, nicht Gold: Sonst prüfte der Test nichts.
  expect(accent.join(', ')).not.toBe(OLD_GOLD)
  const styleOf = (selector: string) =>
    page.locator(selector).evaluate((el) => {
      const s = getComputedStyle(el)
      return { border: s.borderTopColor, background: s.backgroundColor, shadow: s.boxShadow }
    })
  const dock = await styleOf('.dock .bar')
  const tab = await styleOf('nav [aria-current="page"] .icon')

  for (const value of [dock.border, dock.shadow, tab.background, tab.shadow]) expect(value).not.toContain(OLD_GOLD)
  // Rand und Schein der Leiste, Fläche und Schein des aktiven Reiters: der Akzent der Stimmung, zart deckend.
  expect(rgbOf(parseColor(dock.border))).toEqual(accent)
  expect(colorsIn(dock.shadow).map(rgbOf)).toContainEqual(accent)
  expect(rgbOf(parseColor(tab.background))).toEqual(accent)
  expect(colorsIn(tab.shadow).map(rgbOf)).toEqual([accent])
  // Die Fläche der Leiste wie beim Mini-Player: der Himmel der Stimmung, fast deckend.
  expect(dock.background).toBe(await resolveColor(page, 'color-mix(in srgb, var(--sky-mid) 92%, transparent)'))
})
