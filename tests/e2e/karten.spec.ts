import { readFileSync } from 'node:fs'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { parseColor } from './color'

// Karten mit Goldlinien und gemalter Waschung (Meilenstein 4.1). Die Waschung ist Schmuck in der textfreien oberen
// rechten Ecke einer Karte: Schrift und Waschung teilen sich nie eine Fläche (außer Schrift auf einer deckenden
// Fläche wie dem Linienknopf). Die Helfer hier nutzen auch die Tests von Heute und Atmen.

// Der Browser läuft in Berlin, die Uhr steht fest: Die Farbe der Tageszeit hängt nicht vom Rechner ab.
test.use({ timezoneId: 'Europe/Berlin' })
const at = (time: string) => new Date(`2026-10-22T${time}+02:00`)

// Farbe der Waschung einer Karte, aus dem Dateinamen des Bildes in `.waschung` (`null`: keine Waschung).
async function waschungIn(card: Locator): Promise<string | null> {
  const img = card.locator('.waschung img')
  if ((await img.count()) === 0) return null
  const src = await img.getAttribute('src')
  return src?.match(/\/images\/waschungen\/([a-z]+)\.webp$/)?.[1] ?? null
}

// Kein Text liegt in der Zone der Waschung. Zone = Rechteck von `.waschung`, auf die Karte beschnitten. Geprüft
// werden die Zeilenrechtecke jedes sichtbaren Textknotens (Range), ohne versteckten Text für Hilfstechnik und ohne
// Text auf einer deckenden Fläche (ein Vorfahr innerhalb der Karte mit deckender Hintergrundfarbe). Mehr als 1 px
// Überschneidung in beiden Richtungen ist ein Fehler; die Meldung nennt den Text.
async function expectNoTextInWash(card: Locator): Promise<void> {
  const problems = await card.evaluate((el) => {
    const wash = el.querySelector('.waschung')
    if (!wash) return ['keine Waschung in der Karte']
    const c = el.getBoundingClientRect()
    const w = wash.getBoundingClientRect()
    const zone = { left: Math.max(w.left, c.left), right: Math.min(w.right, c.right), top: Math.max(w.top, c.top), bottom: Math.min(w.bottom, c.bottom) }
    if (zone.right - zone.left < 1 || zone.bottom - zone.top < 1) return ['die Zone der Waschung ist leer']
    // Deckkraft einer berechneten Farbe: rgb(), rgba(), color(srgb … / a).
    const alpha = (css: string) => {
      if (css === 'transparent') return 0
      const slash = css.match(/\/\s*([\d.]+)(%?)\s*\)$/)
      if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1)
      const rgba = css.match(/^rgba\(([^)]*)\)$/)
      return rgba ? Number(rgba[1].split(',')[3]) : 1
    }
    const onOpaque = (node: Node) => {
      for (let e = node.parentElement; e && e !== el; e = e.parentElement) if (alpha(getComputedStyle(e).backgroundColor) === 1) return true
      return false
    }
    const found: string[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent!.trim()
      if (text === '' || node.parentElement!.closest('.visually-hidden') || onOpaque(node)) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const r of range.getClientRects()) {
        const dx = Math.min(r.right, zone.right) - Math.max(r.left, zone.left)
        const dy = Math.min(r.bottom, zone.bottom) - Math.max(r.top, zone.top)
        if (dx > 1 && dy > 1) {
          found.push(`„${text}“ liegt ${dx.toFixed(1)} × ${dy.toFixed(1)} px in der Waschung (Zone x ${zone.left.toFixed(1)}–${zone.right.toFixed(1)}, y ${zone.top.toFixed(1)}–${zone.bottom.toFixed(1)})`)
        }
      }
    }
    return found
  })
  expect(problems).toEqual([])
}

// Goldrand: Die Farbkanäle genau, die Deckkraft auf ±0,01 (der Build schreibt 0.26 als #e9c48e42 = 0,2588).
async function expectGoldBorder(el: Locator, alpha: number) {
  const [r, g, b, a] = parseColor(await el.evaluate((e) => getComputedStyle(e).borderTopColor))
  expect([r, g, b]).toEqual([233, 196, 142])
  expect(Math.abs(a - alpha)).toBeLessThanOrEqual(0.01)
}

const pageFits = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

// ---------------------------------------------------------------------------------------------------------------
// Meditieren
// ---------------------------------------------------------------------------------------------------------------

type ManifestEntry = { id: string; title: string; category: string; duration: number }
const MANIFEST: ManifestEntry[] = JSON.parse(readFileSync('src/content/meditations.json', 'utf8')).meditations
// Länge wie in der Liste („5 Min“): aus der Länge der Datei.
const lengthOf = (title: string) => `${Math.max(1, Math.round(MANIFEST.find((m) => m.title === title)!.duration / 60))} Min`

const THEMES = [
  { title: 'Einsteiger & Achtsamkeit', farbe: 'lavendel' },
  { title: 'Stress & Ruhe', farbe: 'blaugruen' },
  { title: 'Fokus & Energie', farbe: 'pfirsich' },
]

async function openMeditieren(page: Page, time = '08:00:00') {
  await page.clock.setFixedTime(at(time))
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Meditieren' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Meditieren')
}

const timerCard = (page: Page) => page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: 'Meditations-Timer' }) })
const guided = (page: Page) => page.getByRole('region', { name: 'Geführte Meditationen' })
const entries = (page: Page) => guided(page).getByRole('button')
const entryOf = (page: Page, title: string) => guided(page).getByRole('button', { name: new RegExp(`^${title}, `) })
const savedMark = (scope: Locator) => scope.getByRole('img', { name: 'offline gespeichert' })

// Spielt eine Meditation kurz an und beendet sie: Dabei wird ihre Datei offline gespeichert.
async function playAndSave(page: Page, title: string) {
  await entryOf(page, title).click()
  await page.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect(savedMark(entryOf(page, title))).toBeVisible({ timeout: 30_000 })
}

test.describe('Meditieren', () => {
  test('the timer card has the morning wash, a gold border and the outline button „Einstellen“', async ({ page }) => {
    await openMeditieren(page)
    const card = timerCard(page)
    expect(await waschungIn(card)).toBe('pfirsich')
    await expectGoldBorder(card, 0.26)

    // Sichtbar „Einstellen“, vorgelesen „Timer einstellen“ (das sichtbare Wort steckt im Namen).
    const button = card.getByRole('button', { name: 'Timer einstellen' })
    await expect(button).toHaveText('Einstellen')
    await expect(button).toHaveClass(/\bbutton-line\b/)
    // Auf dem Handy steht der Knopf rechts neben dem Text, nicht darunter.
    const text = (await card.locator('.timer-text').boundingBox())!
    const box = (await button.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(text.x + text.width)
    expect(box.y).toBeLessThan(text.y + text.height)
  })

  test('the timer wash follows the time of day', async ({ page }) => {
    await openMeditieren(page, '14:00:00')
    expect(await waschungIn(timerCard(page))).toBe('blaugruen')
    await openMeditieren(page, '20:00:00')
    expect(await waschungIn(timerCard(page))).toBe('lavendel')
  })

  test('a short gold line sits under „Geführte Meditationen“, a fading one beside every theme', async ({ page }) => {
    await openMeditieren(page)
    const rule = guided(page).locator('.rule')
    await expect(rule).toHaveCount(1)
    expect(await rule.evaluate((el) => [el.getBoundingClientRect().width, el.getBoundingClientRect().height])).toEqual([40, 1])
    const heading = (await guided(page).getByRole('heading', { level: 2 }).boundingBox())!
    expect((await rule.boundingBox())!.y).toBeGreaterThan(heading.y + heading.height)

    for (const theme of THEMES) {
      const group = guided(page).getByRole('region', { name: theme.title })
      const fade = group.locator('.rule-fade')
      await expect(fade).toHaveCount(1)
      const title = (await group.getByRole('heading', { level: 3 }).boundingBox())!
      const line = (await fade.boundingBox())!
      // Rechts neben der Überschrift, auf ihrer Höhe.
      expect(line.x).toBeGreaterThanOrEqual(title.x + title.width)
      expect(line.width).toBeGreaterThan(0)
      expect(line.y).toBeGreaterThan(title.y)
      expect(line.y).toBeLessThan(title.y + title.height)
    }
  })

  test('every entry has the wash of its theme in turn, a Fraunces title, a gold border and its length', async ({ page }) => {
    await openMeditieren(page)
    await expect(entries(page)).toHaveCount(9)
    for (const theme of THEMES) {
      const group = guided(page).getByRole('region', { name: theme.title })
      const items = group.getByRole('button')
      await expect(items).toHaveCount(3)
      for (let i = 0; i < 3; i++) {
        const item = items.nth(i)
        expect(await waschungIn(item)).toBe(theme.farbe)
        // Lage reihum 0, 1, 2; die Waschung ist das erste Kind des Eintrags.
        await expect(item.locator(':scope > .waschung')).toHaveClass(new RegExp(`\\blage-${i}\\b`))
        await expect(item.locator('.waschung img')).toHaveAttribute('alt', '')
        await expect(item.locator('.waschung')).toHaveAttribute('aria-hidden', 'true')
        await expectGoldBorder(item, 0.22)
        const title = item.locator('.title')
        expect(await title.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Fraunces')
        await expect(item).toContainText(lengthOf((await title.textContent())!))
      }
    }
    await expect(entryOf(page, 'Ankommen im Atem')).toContainText('5 Min')
  })

  test('no text lies in a wash', async ({ page }) => {
    await openMeditieren(page)
    await expectNoTextInWash(timerCard(page))
    for (const item of await entries(page).all()) await expectNoTextInWash(item)
  })

  test('offline: a blocked entry says so in text and description; a saved one shows the mark', async ({ page, context }) => {
    await openMeditieren(page)
    const morning = entryOf(page, 'Guten Morgen')
    await expect(savedMark(morning)).toHaveCount(0)

    // Nichts gespeichert, kein Netz: gesperrt, mit Hinweis im Text und als Beschreibung.
    await context.setOffline(true)
    await expect(morning).toBeDisabled()
    await expect(morning.getByText('Nicht offline verfügbar', { exact: true })).toBeVisible()
    await expect(morning).toHaveAccessibleDescription(/Nicht offline verfügbar/)
    await expect(morning).toContainText(lengthOf('Guten Morgen'))
    await expectNoTextInWash(morning)
    await context.setOffline(false)
    await expect(morning).toBeEnabled()

    // Gespeichert: das Zeichen „offline gespeichert“ neben der Länge, auch ohne Netz startbar.
    await playAndSave(page, 'Drei-Minuten-Atempause')
    const saved = entryOf(page, 'Drei-Minuten-Atempause')
    await expect(saved).toHaveAccessibleName(/, offline verfügbar$/)
    await expect(saved).toContainText(lengthOf('Drei-Minuten-Atempause'))
    await expect(savedMark(guided(page))).toHaveCount(1)
    await context.setOffline(true)
    await expect(morning).toBeDisabled()
    await expect(saved).toBeEnabled()
    await expect(savedMark(saved)).toBeVisible()
    await expect(saved.getByText('Nicht offline verfügbar', { exact: true })).toHaveCount(0)
    // Das Zeichen trägt die gedämpfte Farbe der Angaben.
    const [mark, meta] = await Promise.all([
      savedMark(saved).evaluate((el) => getComputedStyle(el).color),
      saved.locator('.meta').evaluate((el) => getComputedStyle(el).color),
    ])
    expect(mark).toBe(meta)
    await expectNoTextInWash(saved)
  })

  test('a tap on the wash starts the meditation, and nothing scrolls sideways', async ({ page }) => {
    await openMeditieren(page)
    expect(await pageFits(page)).toBe(true)
    const first = entries(page).first()
    await first.click({ trial: true }) // wartet, bis der Bildschirm eingeblendet ist
    const zone = (await first.locator('.waschung').boundingBox())!
    await page.touchscreen.tap(zone.x + zone.width / 2, zone.y + zone.height / 2)
    await expect(page.getByRole('dialog', { name: 'Geführte Meditation' }).getByRole('heading', { name: 'Ankommen im Atem' })).toBeVisible()
  })

  test.describe('when the washes do not load', () => {
    // Der Service Worker des ersten Besuchs würde die Bilder aus dem Speicher liefern, an `page.route` vorbei.
    test.use({ serviceWorkers: 'block' })

    test('the cards keep their size and a tap still starts', async ({ page }) => {
      await openMeditieren(page)
      await expect.poll(() => page.locator('.waschung img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).every((img) => img.complete && img.naturalWidth > 0))).toBe(true)
      const heights = () => page.locator('.card, .entry').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
      const withImages = await heights()
      expect(withImages).toHaveLength(10)

      await page.route('**/images/waschungen/**', (route) => route.fulfill({ status: 404 }))
      await openMeditieren(page)
      // Die Bilder sind wirklich ausgefallen (sonst prüfte der Test nichts).
      await expect(page.locator('.waschung img')).toHaveCount(10)
      await expect
        .poll(() => page.locator('.waschung img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).every((img) => img.complete && img.naturalWidth === 0)))
        .toBe(true)
      const without = await heights()
      for (const [i, height] of without.entries()) expect(Math.abs(height - withImages[i])).toBeLessThanOrEqual(1)

      const first = entries(page).first()
      await first.click({ trial: true })
      const zone = (await first.locator('.waschung').boundingBox())!
      await page.touchscreen.tap(zone.x + zone.width / 2, zone.y + zone.height / 2)
      await expect(page.getByRole('dialog', { name: 'Geführte Meditation' }).getByRole('heading', { name: 'Ankommen im Atem' })).toBeVisible()
    })
  })

  test.describe('on a small phone with large text', () => {
    test.use({ viewport: { width: 360, height: 640 } })

    test('nothing overflows, „Einstellen“ stays in its card, and no text lies in a wash', async ({ page, context }) => {
      await openMeditieren(page)
      await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
      // Mit gespeichertem Zeichen und gesperrtem Hinweis: die längsten Zeilen, die ein Eintrag hat.
      await playAndSave(page, 'Vor einem wichtigen Termin')
      await context.setOffline(true)
      await expect(entryOf(page, 'Guten Morgen')).toBeDisabled()

      expect(await pageFits(page)).toBe(true)
      const card = timerCard(page)
      const cards = [card, ...(await entries(page).all())]
      for (const c of cards) {
        expect(await c.evaluate((el) => el.scrollWidth <= el.clientWidth), await c.innerText()).toBe(true)
        await expectNoTextInWash(c)
      }
      const outer = (await card.boundingBox())!
      const button = (await card.getByRole('button', { name: 'Timer einstellen' }).boundingBox())!
      expect(button.x).toBeGreaterThanOrEqual(outer.x)
      expect(button.y).toBeGreaterThanOrEqual(outer.y)
      expect(button.x + button.width).toBeLessThanOrEqual(outer.x + outer.width)
      expect(button.y + button.height).toBeLessThanOrEqual(outer.y + outer.height)
    })
  })
})
