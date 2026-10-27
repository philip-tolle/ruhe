import { readFileSync } from 'node:fs'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { parseColor } from './color'

// Karten mit Goldlinien und gemalter Waschung (Meilenstein 4.1). Die Waschung ist Schmuck in der textfreien oberen
// rechten Ecke einer Karte: Schrift und Waschung teilen sich nie eine Fläche (außer Schrift auf einer deckenden
// Fläche wie dem Linienknopf). Die Helfer hier nutzen auch die Tests von Heute und Atmen.

// Der Browser läuft in Berlin, die Uhr steht fest: Die Farbe der Tageszeit hängt nicht vom Rechner ab.
test.use({ timezoneId: 'Europe/Berlin' })
const at = (time: string, day = '2026-10-22') => new Date(`${day}T${time}+02:00`)

// Farbe der Waschung einer Karte, aus dem Dateinamen des Bildes in `.waschung` (`null`: keine Waschung).
async function waschungIn(card: Locator): Promise<string | null> {
  const img = card.locator('.waschung img')
  if ((await img.count()) === 0) return null
  const src = await img.getAttribute('src')
  return src?.match(/\/images\/waschungen\/([a-z]+)\.webp$/)?.[1] ?? null
}

// Kein Text liegt in der Zone der Waschung. Zone = Rechteck von `.waschung`, auf die Karte beschnitten. Geprüft
// werden die Zeilenrechtecke jedes sichtbaren Textknotens (Range), ohne versteckten Text für Hilfstechnik und ohne
// Text auf einer deckenden Fläche: ein Vorfahr innerhalb der Karte mit deckender Hintergrundfarbe (Deckkraft 1), der
// selbst und samt allen Vorfahren bis zur Karte die `opacity` 1 hat – eine abgeblendete Fläche ließe die Waschung
// durchscheinen. Mehr als 1 px Überschneidung in beiden Richtungen ist ein Fehler; die Meldung nennt den Text.
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
      const chain: HTMLElement[] = []
      for (let e = node.parentElement; e && e !== el; e = e.parentElement) chain.push(e)
      // Von der Karte her abwärts: `dimmed`, sobald ein Vorfahr (oder die Fläche selbst) nicht ganz deckend gezeichnet wird.
      let dimmed = false
      for (let i = chain.length - 1; i >= 0; i--) {
        const style = getComputedStyle(chain[i])
        if (Number(style.opacity) !== 1) dimmed = true
        if (!dimmed && alpha(style.backgroundColor) === 1) return true
      }
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

// Der Text liegt auf genau einer Zeile: Der Range über den Textknoten hat ein einziges Zeilenrechteck.
async function expectOneLine(el: Locator) {
  const lines = await el.evaluate((node) => {
    const range = document.createRange()
    range.selectNodeContents(node)
    return range.getClientRects().length
  })
  expect(lines, `„${await el.innerText()}“ bricht um`).toBe(1)
}

// Aus einem Titel wird ein Muster: Sonderzeichen entschärfen.
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Die Waschung lässt Tipps durch: An dieser Stelle (Seitenkoordinaten) liegt oben weder das Bild noch die Zone.
// `elementFromPoint` beachtet `pointer-events: none` – wäre die Zone getroffen, finge sie den Tipp ab.
async function expectTapPassesThrough(page: Page, x: number, y: number) {
  const hit = await page.evaluate(
    ([px, py]) => {
      const top = document.elementFromPoint(px, py)
      return top ? { tag: top.tagName, inWash: top.closest('.waschung') !== null } : null
    },
    [x, y],
  )
  expect(hit, `an der Stelle ${x.toFixed(0)}/${y.toFixed(0)} liegt nichts`).not.toBeNull()
  expect(hit!.inWash, `an der Stelle liegt oben ${hit!.tag} der Waschung`).toBe(false)
}

// ---------------------------------------------------------------------------------------------------------------
// Meditieren
// ---------------------------------------------------------------------------------------------------------------

type ManifestEntry = { id: string; title: string; category: string; duration: number }
const MANIFEST: ManifestEntry[] = JSON.parse(readFileSync('src/content/meditations.json', 'utf8')).meditations
// Länge wie in der Liste („5 Min“): aus der Länge der Datei.
const lengthOf = (title: string) => `${Math.max(1, Math.round(MANIFEST.find((m) => m.title === title)!.duration / 60))} Min`

const THEMES = [
  { title: 'Einsteiger & Achtsamkeit', farbe: 'lavendel', count: 4 },
  { title: 'Stress & Ruhe', farbe: 'blaugruen', count: 4 },
  { title: 'Fokus & Energie', farbe: 'pfirsich', count: 4 },
  { title: 'Mitgefühl & Freundlichkeit', farbe: 'lavendel', count: 2 },
  { title: 'Gefühle & Loslassen', farbe: 'blaugruen', count: 2 },
  { title: 'Achtsam im Alltag', farbe: 'pfirsich', count: 2 },
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
const entryOf = (page: Page, title: string) => guided(page).getByRole('button', { name: new RegExp(`^${escapeRegExp(title)}, `) })
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
    // Auf dem Handy (Pixel 7, 412 px) steht der Knopf unter dem Text, nicht daneben (Ruling R5).
    const text = (await card.locator('.timer-text').boundingBox())!
    const box = (await button.boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(text.y + text.height - 1)
  })

  // Ruling R5: Auf Handys bis rund 412 px steht der Knopf unter dem Text, damit „Meditations-Timer“ auf einer Zeile
  // bleibt; erst auf breiten Bildschirmen steht er daneben (auch dann ohne Umbruch im Titel).
  for (const width of [412, 393, 360]) {
    test.describe(`the timer card at ${width} px`, () => {
      test.use({ viewport: { width, height: 800 } })

      test('the title is one line, the button sits under the text, and no text lies in the wash', async ({ page }) => {
        await openMeditieren(page)
        const card = timerCard(page)
        await expectOneLine(card.getByRole('heading', { level: 2, name: 'Meditations-Timer' }))
        const text = (await card.locator('.timer-text').boundingBox())!
        const button = (await card.getByRole('button', { name: 'Timer einstellen' }).boundingBox())!
        expect(button.y, 'unter dem Text').toBeGreaterThanOrEqual(text.y + text.height - 1)
        await expectNoTextInWash(card)
        expect(await pageFits(page)).toBe(true)
      })
    })
  }

  test.describe('the timer card on a wide screen', () => {
    test.use({ viewport: { width: 800, height: 800 } })

    test('the button sits beside the text, and the title is still one line', async ({ page }) => {
      await openMeditieren(page)
      const card = timerCard(page)
      await expectOneLine(card.getByRole('heading', { level: 2, name: 'Meditations-Timer' }))
      const text = (await card.locator('.timer-text').boundingBox())!
      const button = (await card.getByRole('button', { name: 'Timer einstellen' }).boundingBox())!
      expect(button.x, 'rechts neben dem Text').toBeGreaterThanOrEqual(text.x + text.width - 1)
      expect(button.y).toBeLessThan(text.y + text.height)
      await expectNoTextInWash(card)
    })
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
    await expect(entries(page)).toHaveCount(18)
    // Die Themen stehen in dieser Reihenfolge untereinander; benachbarte tragen nie dieselbe Farbe.
    await expect(guided(page).getByRole('heading', { level: 3 })).toHaveText(THEMES.map((theme) => theme.title))
    for (let t = 1; t < THEMES.length; t++) expect(THEMES[t].farbe).not.toBe(THEMES[t - 1].farbe)
    for (const theme of THEMES) {
      const group = guided(page).getByRole('region', { name: theme.title })
      const items = group.getByRole('button')
      await expect(items).toHaveCount(theme.count)
      for (let i = 0; i < theme.count; i++) {
        const item = items.nth(i)
        expect(await waschungIn(item)).toBe(theme.farbe)
        // Lage reihum 0, 1, 2, 0; die Waschung ist das erste Kind des Eintrags.
        await expect(item.locator(':scope > .waschung')).toHaveClass(new RegExp(`\\blage-${i % 3}\\b`))
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
    await expectTapPassesThrough(page, zone.x + zone.width / 2, zone.y + zone.height / 2)
    await page.touchscreen.tap(zone.x + zone.width / 2, zone.y + zone.height / 2)
    await expect(page.getByRole('dialog', { name: 'Geführte Meditation' }).getByRole('heading', { name: 'Ankommen im Atem' })).toBeVisible()
  })

  test.describe('when the washes do not load', () => {
    // Der Service Worker des ersten Besuchs würde die Bilder aus dem Speicher liefern, an `page.route` vorbei.
    test.use({ serviceWorkers: 'block' })

    test('the cards keep their size and a tap still starts', async ({ page }) => {
      await openMeditieren(page)
      // Erst zählen (Timer-Karte und 18 Einträge): `every` auf einer leeren Liste ist wahr, die Basislinie
      // bewiese sonst nichts.
      await expect(page.locator('.waschung img')).toHaveCount(19)
      await expect.poll(() => page.locator('.waschung img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).every((img) => img.complete && img.naturalWidth > 0))).toBe(true)
      const heights = () => page.locator('.card, .entry').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
      const withImages = await heights()
      expect(withImages).toHaveLength(19)

      await page.route('**/images/waschungen/**', (route) => route.fulfill({ status: 404 }))
      await openMeditieren(page)
      // Die Bilder sind wirklich ausgefallen (sonst prüfte der Test nichts).
      await expect(page.locator('.waschung img')).toHaveCount(19)
      await expect
        .poll(() => page.locator('.waschung img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).every((img) => img.complete && img.naturalWidth === 0)))
        .toBe(true)
      const without = await heights()
      for (const [i, height] of without.entries()) expect(Math.abs(height - withImages[i])).toBeLessThanOrEqual(1)

      const first = entries(page).first()
      await first.click({ trial: true })
      const zone = (await first.locator('.waschung').boundingBox())!
      await expectTapPassesThrough(page, zone.x + zone.width / 2, zone.y + zone.height / 2)
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

    test('a theme heading that wraps keeps a visible fading line of at least 24 px', async ({ page }) => {
      await openMeditieren(page)
      await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
      let wrapped = 0
      for (const theme of THEMES) {
        const group = guided(page).getByRole('region', { name: theme.title })
        const heading = group.getByRole('heading', { level: 3 })
        const lines = await heading.evaluate((el) => {
          const range = document.createRange()
          range.selectNodeContents(el)
          return range.getClientRects().length
        })
        if (lines > 1) wrapped++
        const fade = (await group.locator('.rule-fade').boundingBox())!
        expect(fade.width, `Linie neben „${theme.title}“`).toBeGreaterThanOrEqual(24)
      }
      // Der Test prüft nur etwas, wenn mindestens eine Überschrift wirklich umbricht.
      expect(wrapped, 'umgebrochene Themenüberschriften').toBeGreaterThan(0)
      expect(await pageFits(page)).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------------------------------------------
// Heute
// ---------------------------------------------------------------------------------------------------------------

const SETTINGS = { vibration: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } }

// Öffnet „Heute“ zur festen Zeit. `lastUsed` wird einmal je Test gesät (ein Merker in sessionStorage lässt ein Neuladen
// im Test das Gemerkte behalten); ohne `lastUsed` ist die App leer und „Zuletzt genutzt“ bietet „Ankommen im Atem“ an.
// Am 22.10. ist der Vorschlag am Morgen „Guten Morgen“, am 19.10. „Gehmeditation“ (das längste Wort eines Titels).
async function openHeute(page: Page, time = '08:00:00', lastUsed?: object, day?: string) {
  await page.clock.setFixedTime(at(time, day))
  if (lastUsed) {
    await page.addInitScript((json) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('ruhe.v1', json)
    }, JSON.stringify({ version: 1, sessions: [], settings: SETTINGS, lastUsed }))
  }
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 2, name: 'Vorschlag des Tages', exact: true })).toBeVisible()
}

const heuteCard = (page: Page, heading: string) => page.locator('.card').filter({ has: page.getByRole('heading', { level: 2, name: heading, exact: true }) })
const vorschlag = (page: Page) => heuteCard(page, 'Vorschlag des Tages')
const zuletzt = (page: Page) => heuteCard(page, 'Zuletzt genutzt')
const aktivitaeten = (page: Page) => heuteCard(page, 'Aktivitäten')
const isFullButton = (button: Locator) => button.evaluate((el) => el.classList.contains('button') && !el.classList.contains('button-line'))
const isLineButton = (button: Locator) => button.evaluate((el) => el.classList.contains('button-line') && !el.classList.contains('button'))
const rem = (page: Page) => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))

// Zweites steht rechts vom ersten, auf derselben Zeile (die Mitte des zweiten liegt in der Höhe des ersten).
async function expectBeside(first: Locator, second: Locator) {
  const [a, b] = [(await first.boundingBox())!, (await second.boundingBox())!]
  expect(b.x, 'rechts daneben').toBeGreaterThanOrEqual(a.x + a.width - 1)
  const middle = b.y + b.height / 2
  expect(middle, 'auf derselben Zeile').toBeGreaterThan(a.y)
  expect(middle).toBeLessThan(a.y + a.height)
}

// Kein Wort des Textes bricht mitten im Wort um: Jedes Wort liegt auf einer Zeile (ein Range-Rechteck). Ein
// Bindestrich darf umbrechen („Drei-Minuten-“ / „Atempause“): Geprüft wird jedes Stück bis einschließlich Bindestrich.
async function expectWordsWhole(el: Locator) {
  // Erst die Schriften: Mit der Ersatzschrift lägen die Umbrüche anders als auf dem Handy.
  await el.page().evaluate(async () => {
    await document.fonts.ready
  })
  const broken = await el.evaluate((node) => {
    const text = node.firstChild as Text
    const found: string[] = []
    let at = 0
    for (const word of text.textContent!.split(' ')) {
      for (const part of word.split(/(?<=-)/)) {
        const range = document.createRange()
        range.setStart(text, at)
        range.setEnd(text, at + part.length)
        if (range.getClientRects().length > 1) found.push(part)
        at += part.length
      }
      at += 1
    }
    return found
  })
  expect(broken, 'Wörter, die mitten im Wort umbrechen').toEqual([])
}

// Spielt den Vorschlag kurz an und beendet ihn: Dabei wird seine Datei offline gespeichert.
async function playSuggestionAndSave(page: Page) {
  await vorschlag(page).getByRole('button', { name: 'Jetzt starten' }).click()
  await page.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect(savedMark(vorschlag(page))).toBeVisible({ timeout: 30_000 })
}

test.describe('Heute', () => {
  for (const [time, farbe] of [
    ['08:00:00', 'pfirsich'],
    ['14:00:00', 'blaugruen'],
    ['20:00:00', 'lavendel'],
  ] as const) {
    test(`the suggestion has the ${farbe} wash at ${time.slice(0, 5)}, a gold border, and no text lies in it`, async ({ page }) => {
      await openHeute(page, time)
      const card = vorschlag(page)
      expect(await waschungIn(card)).toBe(farbe)
      await expect(card.locator('.waschung img')).toHaveAttribute('alt', '')
      await expect(card.locator('.waschung')).toHaveAttribute('aria-hidden', 'true')
      await expectGoldBorder(card, 0.26)
      await expectNoTextInWash(card)
    })
  }

  test('the suggestion heading is still the h2, now in small caps', async ({ page }) => {
    await openHeute(page)
    const card = vorschlag(page)
    const heading = card.getByRole('heading', { level: 2, name: 'Vorschlag des Tages', exact: true })
    await expect(heading).toHaveText('Vorschlag des Tages') // der Text bleibt; die Versalien setzt das CSS
    const style = await heading.evaluate((el) => {
      const s = getComputedStyle(el)
      return { transform: s.textTransform, size: parseFloat(s.fontSize), spacing: parseFloat(s.letterSpacing), weight: s.fontWeight, color: s.color, family: s.fontFamily }
    })
    const root = await rem(page)
    expect(style.transform).toBe('uppercase')
    expect(style.size).toBeCloseTo(0.72 * root, 1)
    expect(style.spacing / style.size).toBeCloseTo(0.14, 2)
    expect(style.weight).toBe('700')
    // Gedämpft wie die Beschreibung darunter (`--text-muted`), kleine Schrift statt Fraunces-Titel.
    expect(style.color).toBe(await card.locator('p.hint').first().evaluate((el) => getComputedStyle(el).color))
    expect(style.family).not.toContain('Fraunces')
    // Der Titel der Meditation darunter bleibt der Blickfang in Fraunces, rund 1.625rem.
    const name = await card.locator('.name').evaluate((el) => ({ family: getComputedStyle(el).fontFamily, size: parseFloat(getComputedStyle(el).fontSize) }))
    expect(name.family).toContain('Fraunces')
    expect(name.size).toBeCloseTo(1.625 * root, 0)
    // Überschrift, Titel, Beschreibung: von oben nach unten.
    const [h, n, d] = await Promise.all([heading.boundingBox(), card.locator('.name').boundingBox(), card.locator('p.hint').first().boundingBox()])
    expect(n!.y).toBeGreaterThan(h!.y + h!.height - 1)
    expect(d!.y).toBeGreaterThan(n!.y + n!.height - 1)
  })

  test('the zone is the top right corner around the motif, above the description', async ({ page }) => {
    await openHeute(page)
    const card = vorschlag(page)
    const [c, z, m, d] = await Promise.all([
      card.boundingBox(),
      card.locator('.waschung').boundingBox(),
      card.locator('img.motiv').boundingBox(),
      card.locator('p.hint').first().boundingBox(),
    ])
    // Oben rechts: bündig mit dem Innenrand (1 px Rand).
    expect(Math.abs(z!.x + z!.width - (c!.x + c!.width - 1))).toBeLessThan(1)
    expect(Math.abs(z!.y - (c!.y + 1))).toBeLessThan(1)
    expect(z!.width).toBeLessThan(c!.width / 2)
    // Das Motiv steht in der Zone, und die Beschreibung beginnt unter ihr.
    expect(m!.x).toBeGreaterThanOrEqual(z!.x - 1)
    expect(m!.x + m!.width).toBeLessThanOrEqual(z!.x + z!.width + 1)
    expect(m!.y).toBeGreaterThanOrEqual(z!.y - 1)
    expect(d!.y).toBeGreaterThanOrEqual(z!.y + z!.height - 1)
  })

  test('the start row: the full „Jetzt starten“, the length beside it, the mark once the file is saved', async ({ page }) => {
    await openHeute(page)
    const card = vorschlag(page)
    const button = card.getByRole('button', { name: 'Jetzt starten' })
    expect(await isFullButton(button)).toBe(true)
    const length = card.getByText(/^\d+ Min$/)
    await expect(length).toHaveCount(1)
    await expect(savedMark(card)).toHaveCount(0)
    await expectBeside(button, length)

    // Die Länge ist leise: 0.78rem und gedämpft wie die Überschrift der Karte, nicht in der Farbe des Titels.
    const [size, color, muted, titleColor] = await Promise.all([
      length.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      length.evaluate((el) => getComputedStyle(el).color),
      card.getByRole('heading', { level: 2 }).evaluate((el) => getComputedStyle(el).color),
      card.locator('.name').evaluate((el) => getComputedStyle(el).color),
    ])
    expect(size).toBeCloseTo(0.78 * (await rem(page)), 1)
    expect(color).toBe(muted)
    expect(color).not.toBe(titleColor)

    // Gespeichert: das Zeichen steht neben der Länge, der Name des Knopfs bleibt.
    await playSuggestionAndSave(page)
    await expect(savedMark(card)).toHaveCount(1)
    await expectBeside(length, savedMark(card))
    await expect(card.getByRole('button', { name: 'Jetzt starten' })).toBeVisible()
    expect(await savedMark(card).evaluate((el) => getComputedStyle(el).color)).toBe(color)
  })

  test('offline, the hint stays below the start row and stays readable', async ({ page, context }) => {
    await openHeute(page)
    await context.setOffline(true)
    const card = vorschlag(page)
    const hint = card.getByText('Nicht offline verfügbar', { exact: true })
    await expect(hint).toBeVisible()
    const button = card.getByRole('button', { name: 'Jetzt starten' })
    await expect(button).toBeDisabled()
    // Unter der Zeile, nicht daneben; Länge und Knopf bleiben.
    const [b, h] = [(await button.boundingBox())!, (await hint.boundingBox())!]
    expect(h.y).toBeGreaterThanOrEqual(b.y + b.height - 1)
    await expect(card.getByText(/^\d+ Min$/)).toBeVisible()
    // Lesbar: 0.8125rem, 600, gedämpft, volle Deckkraft.
    const style = await hint.evaluate((el) => {
      const s = getComputedStyle(el)
      return { size: parseFloat(s.fontSize), weight: s.fontWeight, opacity: s.opacity }
    })
    expect(style.size).toBeGreaterThanOrEqual(0.8125 * (await rem(page)) - 0.1)
    expect(style.weight).toBe('600')
    expect(style.opacity).toBe('1')
    await expectNoTextInWash(card)
    await expectNoTextInWash(zuletzt(page))
  })

  test('„Zuletzt genutzt“: the wash follows the stored session, the button is an outline button', async ({ page }) => {
    // Atemübung: Farbe der Übung (Box → pfirsich). Das Gemerkte gewinnt gegen die Tageszeit (20 Uhr: lavendel).
    await openHeute(page, '20:00:00', { kind: 'breath', pattern: 'box', minutes: 5 })
    let card = zuletzt(page)
    expect(await waschungIn(card)).toBe('pfirsich')
    await expectGoldBorder(card, 0.26)
    let button = card.getByRole('button', { name: 'Erneut starten' })
    expect(await isLineButton(button)).toBe(true)
    await expectNoTextInWash(card)

    // Geführt: Farbe des Themas („Nach einem vollen Tag“ gehört zu „Stress & Ruhe“ → blaugruen).
    await page.evaluate(() => localStorage.setItem('ruhe.v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('ruhe.v1')!), lastUsed: { kind: 'guided', id: 'nach-einem-vollen-tag' } })))
    await page.reload()
    card = zuletzt(page)
    await expect(card.getByText(/^Nach einem vollen Tag/)).toBeVisible()
    expect(await waschungIn(card)).toBe('blaugruen')
    button = card.getByRole('button', { name: 'Erneut starten' })
    expect(await isLineButton(button)).toBe(true)
    await expectNoTextInWash(card)

    // Timer: Farbe der Tageszeit. Um 14 Uhr ist das blaugruen; um 20 Uhr (lavendel) wäre es von der Ersatz-Meditation
    // „Ankommen im Atem“ (lavendel) nicht zu unterscheiden, und eine falsch verdrahtete Tageszeit fiele nicht auf.
    await page.clock.setFixedTime(at('14:00:00'))
    await page.evaluate(() =>
      localStorage.setItem('ruhe.v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('ruhe.v1')!), lastUsed: { kind: 'timer', minutes: 5, intervalMin: null, sound: null, lead: true } })),
    )
    await page.reload()
    card = zuletzt(page)
    await expect(card.getByText('Timer · 5 Min', { exact: true })).toBeVisible()
    expect(await waschungIn(card)).toBe('blaugruen')
    expect(await isLineButton(card.getByRole('button', { name: 'Erneut starten' }))).toBe(true)
    await expectNoTextInWash(card)
  })

  test('„Zuletzt genutzt“ without a stored session offers „Ankommen im Atem“ on the lavender wash', async ({ page }) => {
    await openHeute(page)
    const card = zuletzt(page)
    await expect(card.getByText(/^Ankommen im Atem · \d+ Min$/)).toBeVisible()
    expect(await waschungIn(card)).toBe('lavendel')
    const button = card.getByRole('button', { name: 'Jetzt starten' })
    expect(await isLineButton(button)).toBe(true)
    await expectNoTextInWash(card)
  })

  test('„Zuletzt genutzt“: the zone is a small corner, heading and summary stay out of it', async ({ page }) => {
    await openHeute(page, '08:00:00', { kind: 'guided', id: 'nach-einem-vollen-tag' })
    const card = zuletzt(page)
    const [c, z, h, s] = await Promise.all([card.boundingBox(), card.locator('.waschung').boundingBox(), card.getByRole('heading', { level: 2 }).boundingBox(), card.locator('p.hint').boundingBox()])
    expect(Math.abs(z!.x + z!.width - (c!.x + c!.width - 1))).toBeLessThan(1)
    expect(Math.abs(z!.y - (c!.y + 1))).toBeLessThan(1)
    expect(z!.width).toBeLessThanOrEqual(c!.width * 0.45)
    expect(z!.height).toBeLessThanOrEqual(c!.height / 2)
    // Die Zone endet über der Zusammenfassung; die Überschrift steht links von ihr.
    expect(s!.y).toBeGreaterThanOrEqual(z!.y + z!.height - 1)
    expect(h!.x + h!.width).toBeLessThanOrEqual(z!.x + 1)
    await expectNoTextInWash(card)
  })

  test('a tap on a wash lands on the card, not on the picture, and starts nothing', async ({ page }) => {
    await openHeute(page, '08:00:00', { kind: 'breath', pattern: 'box', minutes: 5 })
    // Vorschlag: links unten in der Zone, neben dem Motiv und unter der Überschrift (keine Bedienfläche).
    const v = (await vorschlag(page).locator('.waschung').boundingBox())!
    const motiv = (await vorschlag(page).locator('img.motiv').boundingBox())!
    const pointV = { x: (v.x + motiv.x) / 2, y: motiv.y + motiv.height / 2 }
    expect(pointV.x).toBeGreaterThan(v.x)
    // Zuletzt: die Mitte der Zone.
    const z = (await zuletzt(page).locator('.waschung').boundingBox())!
    const pointZ = { x: z.x + z.width * 0.6, y: z.y + z.height / 2 }
    for (const point of [pointV, pointZ]) {
      await expectTapPassesThrough(page, point.x, point.y)
      await page.touchscreen.tap(point.x, point.y)
    }
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guten Morgen')
  })

  test('„Aktivitäten“: gold lines above the rows, titles in Fraunces, a chevron on each row, no wash', async ({ page }) => {
    await openHeute(page)
    const card = aktivitaeten(page)
    expect(await waschungIn(card)).toBeNull()
    await expectGoldBorder(card, 0.26)
    const rows = card.getByRole('button')
    await expect(rows).toHaveCount(3)
    const root = await rem(page)
    for (const [i, title] of ['Meditieren', 'Atemübung', 'Klänge'].entries()) {
      const row = rows.nth(i)
      // Die Linie über jeder Zeile, auch über der ersten.
      const line = await row.evaluate((el) => {
        const s = getComputedStyle(el.closest('li')!)
        return { width: s.borderTopWidth, style: s.borderTopStyle, color: s.borderTopColor }
      })
      expect([line.width, line.style]).toEqual(['1px', 'solid'])
      const [r, g, b, a] = parseColor(line.color)
      expect([r, g, b]).toEqual([233, 196, 142])
      expect(Math.abs(a - 0.28)).toBeLessThanOrEqual(0.01)

      // Titel in Fraunces, 1.125rem; der Untertitel bleibt gedämpft und klein.
      const name = row.locator('.row-title')
      await expect(name).toHaveText(title)
      const type = await name.evaluate((el) => ({ family: getComputedStyle(el).fontFamily, size: parseFloat(getComputedStyle(el).fontSize), weight: getComputedStyle(el).fontWeight }))
      expect(type.family).toContain('Fraunces')
      expect(type.size).toBeCloseTo(1.125 * root, 1)
      expect(type.weight).toBe('400')

      // Der Chevron: 18 px, Strich 1.5 in der starken Goldlinie, rechts in der Zeile, Schmuck.
      const chevron = row.locator('svg[aria-hidden="true"]')
      await expect(chevron).toHaveCount(1)
      const mark = await chevron.evaluate((el) => {
        const s = getComputedStyle(el)
        return { width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, stroke: s.stroke, strokeWidth: parseFloat(s.strokeWidth) }
      })
      expect([mark.width, mark.height]).toEqual([18, 18])
      expect(mark.strokeWidth).toBeCloseTo(1.5, 1)
      const [sr, sg, sb, sa] = parseColor(mark.stroke)
      expect([sr, sg, sb]).toEqual([233, 196, 142])
      expect(Math.abs(sa - 0.7)).toBeLessThanOrEqual(0.01)
      const [text, arrow] = [(await row.locator('.row-text').boundingBox())!, (await chevron.boundingBox())!]
      expect(arrow.x).toBeGreaterThanOrEqual(text.x + text.width - 1)
      const box = (await row.boundingBox())!
      expect(arrow.x + arrow.width).toBeLessThanOrEqual(box.x + box.width)
    }
    // Die Namen bleiben (der Chevron trägt nichts bei).
    await expect(rows.nth(0)).toHaveAccessibleName('Meditieren Geführt oder mit Timer')
    await expect(rows.nth(1)).toHaveAccessibleName('Atemübung 3 Min kohärent atmen')
    await expect(rows.nth(2)).toHaveAccessibleName('Klänge Zur Ruhe kommen')
  })

  test('„Jetzt starten“ of the suggestion is the only full button on the screen', async ({ page }) => {
    await openHeute(page, '08:00:00', { kind: 'breath', pattern: 'box', minutes: 5 })
    await expect(page.locator('.screen button.button')).toHaveText(['Jetzt starten'])
    await expect(vorschlag(page).locator('button.button')).toHaveCount(1)
  })

  test.describe('when the washes do not load', () => {
    // Der Service Worker des ersten Besuchs würde die Bilder aus dem Speicher liefern, an `page.route` vorbei.
    test.use({ serviceWorkers: 'block' })

    test('the cards keep their size and „Jetzt starten“ still starts', async ({ page }) => {
      await openHeute(page)
      // Erst zählen (Vorschlag und Zuletzt), dann prüfen, dass alle geladen sind: `every` auf einer leeren Liste ist wahr.
      await expect(page.locator('.waschung img')).toHaveCount(2)
      await expect.poll(() => page.locator('.waschung img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).every((img) => img.complete && img.naturalWidth > 0))).toBe(true)
      const heights = () => page.locator('.card').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
      const withImages = await heights()
      expect(withImages).toHaveLength(4) // „Dein Akku“, Vorschlag, Zuletzt genutzt, Aktivitäten

      await page.route('**/images/waschungen/**', (route) => route.fulfill({ status: 404 }))
      await openHeute(page)
      await expect(page.locator('.waschung img')).toHaveCount(2)
      await expect
        .poll(() => page.locator('.waschung img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).every((img) => img.complete && img.naturalWidth === 0)))
        .toBe(true)
      const without = await heights()
      for (const [i, height] of without.entries()) expect(Math.abs(height - withImages[i])).toBeLessThanOrEqual(1)

      await vorschlag(page).getByRole('button', { name: 'Jetzt starten' }).click()
      await expect(page.getByRole('dialog', { name: 'Geführte Meditation' })).toBeVisible()
    })
  })

  test.describe('on a small phone with large text', () => {
    test.use({ viewport: { width: 360, height: 640 } })

    // Jeder Titel, der vorgeschlagen werden kann: je Tageszeit rotieren sechs Meditationen, der 19. bis 24.10. zeigt
    // also alle 18. Das längste Wort ist „Gehmeditation“ (19.10. morgens).
    test('every title that can be suggested breaks only between words at 100 %', async ({ page }) => {
      test.setTimeout(120_000)
      const seen = new Set<string>()
      for (const time of ['08:00:00', '14:00:00', '20:00:00']) {
        for (const day of ['19', '20', '21', '22', '23', '24']) {
          await openHeute(page, time, undefined, `2026-10-${day}`)
          const name = vorschlag(page).locator('.name')
          const title = (await name.textContent())!
          seen.add(title)
          await expectWordsWhole(name)
          expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth), title).toBe(true)
          expect(await pageFits(page), title).toBe(true)
          await expectNoTextInWash(vorschlag(page))
        }
      }
      expect(seen.size).toBe(18)
    })

    test('at 130 %: nothing overflows, the title breaks between words, and no text lies in a wash', async ({ page }) => {
      // 19.10. morgens: „Gehmeditation“, das längste Wort im schmalsten Fall.
      await openHeute(page, '08:00:00', undefined, '2026-10-19')
      await expect(vorschlag(page).locator('.name')).toHaveText('Gehmeditation')
      await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
      // Gespeichert: Knopf, Länge und Zeichen. Das Gemerkte ist danach dieselbe Meditation, die Zusammenfassung von
      // „Zuletzt genutzt“ also lang.
      await playSuggestionAndSave(page)

      expect(await pageFits(page)).toBe(true)
      for (const card of [vorschlag(page), zuletzt(page), aktivitaeten(page)]) {
        expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth), await card.innerText()).toBe(true)
      }
      await expectNoTextInWash(vorschlag(page))
      await expectNoTextInWash(zuletzt(page))

      // Der Titel bricht zwischen den Wörtern um und läuft nicht ins Motiv.
      const name = vorschlag(page).locator('.name')
      await expectWordsWhole(name)
      const [box, motiv] = [(await name.boundingBox())!, (await vorschlag(page).locator('img.motiv').boundingBox())!]
      expect(box.x + box.width).toBeLessThanOrEqual(motiv.x + 1)
      expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    })

    test('at 160 %: the start row wraps, the length and the mark sit under the button, all inside the card', async ({ page }) => {
      await openHeute(page)
      await page.evaluate(() => (document.documentElement.style.fontSize = '160%'))
      await playSuggestionAndSave(page)

      const card = vorschlag(page)
      const [c, button, length, mark] = await Promise.all([
        card.boundingBox(),
        card.getByRole('button', { name: 'Jetzt starten' }).boundingBox(),
        card.getByText(/^\d+ Min$/).boundingBox(),
        savedMark(card).boundingBox(),
      ])
      // Wirklich umgebrochen: Länge und Zeichen stehen unter dem Knopf, linksbündig mit ihm, nebeneinander.
      expect(length!.y).toBeGreaterThanOrEqual(button!.y + button!.height - 1)
      expect(Math.abs(length!.x - button!.x)).toBeLessThanOrEqual(1)
      expect(mark!.x).toBeGreaterThanOrEqual(length!.x + length!.width - 1)
      expect(Math.abs(mark!.y + mark!.height / 2 - (length!.y + length!.height / 2))).toBeLessThan(length!.height)
      // Alles liegt in der Karte.
      for (const box of [button!, length!, mark!]) {
        expect(box.x).toBeGreaterThanOrEqual(c!.x)
        expect(box.x + box.width).toBeLessThanOrEqual(c!.x + c!.width)
        expect(box.y + box.height).toBeLessThanOrEqual(c!.y + c!.height)
      }
      expect(await pageFits(page)).toBe(true)
      expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      await expectNoTextInWash(card)
    })

    test('offline, with both hints and at 160 %: nothing overflows and no text lies in a wash', async ({ page, context }) => {
      await openHeute(page, '20:00:00')
      await page.evaluate(() => (document.documentElement.style.fontSize = '160%'))
      await context.setOffline(true)
      await expect(page.getByText('Nicht offline verfügbar', { exact: true })).toHaveCount(2)
      expect(await pageFits(page)).toBe(true)
      for (const card of [vorschlag(page), zuletzt(page)]) {
        expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth), await card.innerText()).toBe(true)
        await expectNoTextInWash(card)
      }
    })
  })
})

// ---------------------------------------------------------------------------------------------------------------
// Atmen
// ---------------------------------------------------------------------------------------------------------------

// Öffnet einen Reiter zur festen Zeit (Meditieren hat oben `openMeditieren`, Heute `openHeute`).
async function openTab(page: Page, tab: 'Atmen' | 'Klänge' | 'Ich', time = '08:00:00') {
  await page.clock.setFixedTime(at(time))
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: tab }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(tab)
  // Der Bildschirm gleitet 0,6 s lang ein (`screen-in`): Gemessen wird erst, wenn er steht, sonst liegen
  // zwei nacheinander gemessene Rechtecke an verschiedenen Stellen.
  await page.locator('.screen').first().evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
}

// Der Akzent der Stimmung, wie ihn der Browser auflöst (`var(--accent)` an einer Probe).
const accentOf = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--accent)'
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  })

// Die sechs Kacheln in der Reihenfolge der Liste, mit der Farbe ihrer Übung.
const ATEM = [
  { title: '4-7-8', farbe: 'lavendel' },
  { title: 'Box-Atmung', farbe: 'pfirsich' },
  { title: 'Kohärentes Atmen', farbe: 'blaugruen' },
  { title: 'Langes Ausatmen', farbe: 'lavendel' },
  { title: 'Physiologischer Seufzer', farbe: 'blaugruen' },
  { title: 'Wechselatmung', farbe: 'pfirsich' },
]
const atemTile = (page: Page, title: string) => page.getByRole('button', { name: `${title} starten` })
const atemTiles = (page: Page) => page.getByRole('button', { name: /starten$/ })

test.describe('Atmen', () => {
  test('every tile has the wash of its exercise, in turn, and a gold border', async ({ page }) => {
    await openTab(page, 'Atmen')
    await expect(atemTiles(page)).toHaveCount(6)
    await expect(page.locator('.waschung img')).toHaveCount(6)
    for (const [i, t] of ATEM.entries()) {
      const tile = atemTile(page, t.title)
      expect(await waschungIn(tile), t.title).toBe(t.farbe)
      // Lage reihum 0, 1, 2 (Index modulo 3); die Waschung ist Schmuck.
      await expect(tile.locator(':scope > .waschung')).toHaveClass(new RegExp(`\\blage-${i % 3}\\b`))
      await expect(tile.locator('.waschung img')).toHaveAttribute('alt', '')
      await expect(tile.locator('.waschung')).toHaveAttribute('aria-hidden', 'true')
      await expectGoldBorder(tile, 0.26)
    }
  })

  test('the zone sits in the top right corner, beside the motif and above the title', async ({ page }) => {
    await openTab(page, 'Atmen')
    for (const t of ATEM) {
      const tile = atemTile(page, t.title)
      const [c, z, m, title] = await Promise.all([
        tile.boundingBox(),
        tile.locator('.waschung').boundingBox(),
        tile.locator('img.motiv').boundingBox(),
        tile.locator('.title').boundingBox(),
      ])
      // Oben rechts, bündig mit dem Innenrand (1 px Rand).
      expect(Math.abs(z!.x + z!.width - (c!.x + c!.width - 1)), t.title).toBeLessThan(1)
      expect(Math.abs(z!.y - (c!.y + 1)), t.title).toBeLessThan(1)
      // Neben dem Motiv (beginnt an seinem rechten Rand), nicht darüber hinaus nach unten: Der Titel steht darunter.
      expect(z!.x, t.title).toBeGreaterThanOrEqual(m!.x + m!.width - 1)
      expect(z!.height, t.title).toBeLessThanOrEqual(m!.y + m!.height - c!.y + 1)
      expect(title!.y, t.title).toBeGreaterThanOrEqual(z!.y + z!.height - 1)
    }
  })

  test('no text lies in a wash, and the effect line keeps the accent', async ({ page }) => {
    await openTab(page, 'Atmen')
    const accent = await accentOf(page)
    for (const t of ATEM) {
      const tile = atemTile(page, t.title)
      await expectNoTextInWash(tile)
      expect(await tile.locator('.effect').evaluate((el) => getComputedStyle(el).color), t.title).toBe(accent)
    }
  })

  test('a tap on the wash starts the exercise', async ({ page }) => {
    await openTab(page, 'Atmen')
    const tile = atemTile(page, 'Box-Atmung')
    await tile.click({ trial: true }) // wartet, bis der Bildschirm eingeblendet ist
    const zone = (await tile.locator('.waschung').boundingBox())!
    const [x, y] = [zone.x + zone.width / 2, zone.y + zone.height / 2]
    await expectTapPassesThrough(page, x, y)
    await page.touchscreen.tap(x, y)
    await expect(page.getByRole('heading', { name: 'Atmen · Box-Atmung' })).toBeVisible()
  })

  test.describe('when the washes do not load', () => {
    // Der Service Worker des ersten Besuchs würde die Bilder aus dem Speicher liefern, an `page.route` vorbei.
    test.use({ serviceWorkers: 'block' })

    test('the tiles keep their size and a tap still starts', async ({ page }) => {
      await openTab(page, 'Atmen')
      // Erst zählen: `every` auf einer leeren Liste ist wahr, die Basislinie bewiese sonst nichts.
      await expect(page.locator('.waschung img')).toHaveCount(6)
      await expect.poll(() => page.locator('.waschung img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).every((img) => img.complete && img.naturalWidth > 0))).toBe(true)
      const heights = () => atemTiles(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
      const withImages = await heights()
      expect(withImages).toHaveLength(6)

      await page.route('**/images/waschungen/**', (route) => route.fulfill({ status: 404 }))
      await openTab(page, 'Atmen')
      // Die Bilder sind wirklich ausgefallen (sonst prüfte der Test nichts).
      await expect(page.locator('.waschung img')).toHaveCount(6)
      await expect
        .poll(() => page.locator('.waschung img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).every((img) => img.complete && img.naturalWidth === 0)))
        .toBe(true)
      const without = await heights()
      for (const [i, height] of without.entries()) expect(Math.abs(height - withImages[i])).toBeLessThanOrEqual(1)

      const tile = atemTile(page, '4-7-8')
      await tile.click({ trial: true })
      const zone = (await tile.locator('.waschung').boundingBox())!
      await expectTapPassesThrough(page, zone.x + zone.width / 2, zone.y + zone.height / 2)
      await page.touchscreen.tap(zone.x + zone.width / 2, zone.y + zone.height / 2)
      await expect(page.getByRole('heading', { name: 'Atmen · 4-7-8' })).toBeVisible()
    })
  })

  test.describe('on a small phone with large text', () => {
    test.use({ viewport: { width: 360, height: 640 } })

    test('nothing overflows, the titles start below the zone, and no text lies in a wash', async ({ page }) => {
      await openTab(page, 'Atmen')
      for (const size of ['100%', '130%']) {
        await page.evaluate((value) => (document.documentElement.style.fontSize = value), size)
        expect(await pageFits(page), size).toBe(true)
        for (const t of ATEM) {
          const tile = atemTile(page, t.title)
          expect(await tile.evaluate((el) => el.scrollWidth <= el.clientWidth), `${t.title} bei ${size}`).toBe(true)
          await expectNoTextInWash(tile)
          const [z, title] = await Promise.all([tile.locator('.waschung').boundingBox(), tile.locator('.title').boundingBox()])
          expect(title!.y, `${t.title} bei ${size}`).toBeGreaterThanOrEqual(z!.y + z!.height - 1)
        }
      }
    })
  })
})

// ---------------------------------------------------------------------------------------------------------------
// Klänge
// ---------------------------------------------------------------------------------------------------------------

test.describe('Klänge', () => {
  test('no tile has a wash; idle tiles have the gold border, an active one keeps the accent', async ({ page }) => {
    await openTab(page, 'Klänge')
    const tiles = page.locator('.screen .tile')
    await expect(tiles).toHaveCount(19) // sieben Musikstücke, vier Lofi-Stücke, acht Naturklänge
    await expect(page.locator('.screen .waschung')).toHaveCount(0)
    for (const tile of await tiles.all()) await expectGoldBorder(tile, 0.26)

    // Eine Kachel an: Ihr Rand wechselt in den Akzent, alle anderen bleiben golden.
    await page.getByRole('button', { name: 'Regen', exact: true }).click()
    const active = page.locator('.screen .tile.active')
    await expect(active).toHaveCount(1)
    const accent = parseColor(await accentOf(page))
    await expect.poll(async () => parseColor(await active.evaluate((el) => getComputedStyle(el).borderTopColor))).toEqual(accent)
    const idle = page.locator('.screen .tile:not(.active)')
    await expect(idle).toHaveCount(18)
    for (const tile of await idle.all()) await expectGoldBorder(tile, 0.26)
  })
})

// ---------------------------------------------------------------------------------------------------------------
// Ich
// ---------------------------------------------------------------------------------------------------------------

const ichCards = (page: Page) => page.locator('.screen .card')
const calendar = (page: Page) => page.locator('.screen .card').filter({ has: page.getByRole('table') })
const ichCard = (page: Page, heading: string) => page.locator('.screen .card').filter({ has: page.getByRole('heading', { level: 2, name: heading, exact: true }) })

test.describe('Ich', () => {
  test('the key figures and every card have the gold border', async ({ page }) => {
    await openTab(page, 'Ich')
    const figures = page.locator('dl > div')
    await expect(figures).toHaveCount(3)
    for (const figure of await figures.all()) await expectGoldBorder(figure, 0.26)
    await expect(ichCards(page)).toHaveCount(5) // Kalender, Ruhe, Einstellungen, Offline, Backup
    for (const card of await ichCards(page).all()) await expectGoldBorder(card, 0.26)
  })

  for (const [time, farbe] of [
    ['08:00:00', 'pfirsich'],
    ['14:00:00', 'blaugruen'],
    ['20:00:00', 'lavendel'],
  ] as const) {
    test(`only the calendar has a wash, ${farbe} at ${time.slice(0, 5)}`, async ({ page }) => {
      await openTab(page, 'Ich', time)
      await expect(page.locator('.waschung')).toHaveCount(1)
      expect(await waschungIn(calendar(page))).toBe(farbe)
      await expect(calendar(page).locator('.waschung img')).toHaveAttribute('alt', '')
      await expect(calendar(page).locator('.waschung')).toHaveAttribute('aria-hidden', 'true')
      for (const heading of ['Ruhe', 'Einstellungen', 'Offline', 'Backup']) expect(await waschungIn(ichCard(page, heading)), heading).toBeNull()
    })
  }

  test('the calendar zone is the top right corner around „Nächster Monat“, with no text in it', async ({ page }) => {
    await openTab(page, 'Ich')
    const card = calendar(page)
    const [c, z, next, title] = await Promise.all([
      card.boundingBox(),
      card.locator('.waschung').boundingBox(),
      card.getByRole('button', { name: 'Nächster Monat' }).boundingBox(),
      // Der Text des Monatstitels, nicht die Fläche der Überschrift (die füllt ihre ganze Spalte).
      card.getByRole('heading', { level: 2 }).evaluate((el) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        const r = range.getBoundingClientRect()
        return { right: r.right }
      }),
    ])
    expect(Math.abs(z!.x + z!.width - (c!.x + c!.width - 1))).toBeLessThan(1)
    expect(Math.abs(z!.y - (c!.y + 1))).toBeLessThan(1)
    expect(z!.width).toBeLessThanOrEqual(c!.width * 0.35)
    // Der Knopf sitzt in der Zone, die Zone endet über den Wochentagen.
    expect(next!.x + next!.width / 2).toBeGreaterThan(z!.x)
    expect(next!.y + next!.height / 2).toBeLessThan(z!.y + z!.height)
    const weekdays = (await card.locator('thead th').first().boundingBox())!
    expect(weekdays.y).toBeGreaterThanOrEqual(z!.y + z!.height - 1)
    // Der Monatstitel steht links von ihr.
    expect(title.right).toBeLessThanOrEqual(z!.x + 1)
    await expectNoTextInWash(card)
  })

  test('the rows of the settings are divided by gold lines, above every row', async ({ page }) => {
    await openTab(page, 'Ich')
    const rows = [
      page.getByRole('switch', { name: 'Vibration bei Atemübungen' }),
      page.getByRole('switch', { name: '10 Sekunden ankommen' }),
      page.getByRole('combobox', { name: 'Hintergrundklang beim Timer' }),
      page.getByRole('slider', { name: 'Balance Stimme ↔ Hintergrund' }),
    ]
    for (const control of rows) {
      // Wie in „Aktivitäten“ (Ruling R4, Spec §2.4): eine Linie über jeder Zeile, auch über der ersten.
      const row = await control.evaluate((el) => {
        const s = getComputedStyle(el.closest('.setting')!)
        return { width: s.borderTopWidth, style: s.borderTopStyle, color: s.borderTopColor, padding: parseFloat(s.paddingTop) }
      })
      expect([row.width, row.style]).toEqual(['1px', 'solid'])
      const [r, g, b, a] = parseColor(row.color)
      expect([r, g, b]).toEqual([233, 196, 142])
      expect(Math.abs(a - 0.28)).toBeLessThanOrEqual(0.01)
      // Das Bedienelement klebt nicht an der Linie.
      expect(row.padding).toBeGreaterThan(0)
    }
    // Die Hinweise und Überschriften der anderen Karten sind keine Zeilen.
    await expect(ichCard(page, 'Offline').locator('.setting')).toHaveCount(0)
    await expect(ichCard(page, 'Backup').locator('.setting')).toHaveCount(0)
  })

  test.describe('on a small phone with large text', () => {
    test.use({ viewport: { width: 360, height: 640 } })

    test('nothing overflows, and no month title lies in the wash', async ({ page }) => {
      await openTab(page, 'Ich')
      expect(await pageFits(page)).toBe(true)
      await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
      expect(await pageFits(page)).toBe(true)
      for (const card of await ichCards(page).all()) {
        expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth), await card.innerText()).toBe(true)
      }
      // Alle zwölf Monatstitel (September ist der breiteste): keiner reicht in die Zone.
      const card = calendar(page)
      for (let month = 0; month < 12; month++) {
        await expectNoTextInWash(card)
        expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth), await card.getByRole('heading', { level: 2 }).innerText()).toBe(true)
        await card.getByRole('button', { name: 'Nächster Monat' }).click()
      }
      expect(await pageFits(page)).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------------------------------------------
// Dialoge
// ---------------------------------------------------------------------------------------------------------------

test.describe('Dialoge', () => {
  test('the timer sheet has the gold border', async ({ page }) => {
    await openMeditieren(page)
    await page.getByRole('button', { name: 'Timer einstellen' }).click()
    const sheet = page.getByRole('dialog', { name: 'Meditations-Timer' })
    await expect(sheet).toBeVisible()
    await expectGoldBorder(sheet, 0.26)
  })

  test('„Übung beenden?“ has the gold border', async ({ page }) => {
    await openTab(page, 'Atmen')
    await atemTile(page, '4-7-8').click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    await page.goBack()
    const confirm = page.getByRole('alertdialog', { name: 'Übung beenden?' })
    await expect(confirm).toBeVisible()
    await expectGoldBorder(confirm, 0.26)
  })
})

// ---------------------------------------------------------------------------------------------------------------
// Überschriften der Karten (Ruling R3)
// ---------------------------------------------------------------------------------------------------------------

test.describe('card headings', () => {
  // Eine Regel für alle Karten: Fraunces 400, 1.1875rem. Nur die kleine Versalien-Überschrift des Vorschlags (Heute)
  // ist eine andere Sorte Überschrift und bleibt bei 0.72rem.
  async function expectCardHeadings(page: Page, expected: number) {
    const root = await rem(page)
    const headings = await page.locator('.card h2:not(.kicker)').evaluateAll((els) =>
      els.map((el) => ({ text: el.textContent, size: parseFloat(getComputedStyle(el).fontSize), family: getComputedStyle(el).fontFamily, weight: getComputedStyle(el).fontWeight })),
    )
    expect(headings).toHaveLength(expected)
    for (const h of headings) {
      expect(h.size, h.text!).toBeCloseTo(1.1875 * root, 1)
      expect(h.family, h.text!).toContain('Fraunces')
      expect(h.weight, h.text!).toBe('400')
    }
  }

  test('Heute: „Dein Akku“, „Zuletzt genutzt“ and „Aktivitäten“', async ({ page }) => {
    await openHeute(page)
    await expectCardHeadings(page, 3)
  })

  test('Meditieren: the timer card', async ({ page }) => {
    await openMeditieren(page)
    await expectCardHeadings(page, 1)
  })

  test('Ich: the month, „Ruhe“, „Einstellungen“, „Offline“ and „Backup“', async ({ page }) => {
    await openTab(page, 'Ich')
    await expectCardHeadings(page, 5)
  })
})
