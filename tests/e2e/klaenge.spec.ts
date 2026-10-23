import { test, expect, type Locator, type Page } from '@playwright/test'
import { contrast, over, parseColor } from './color'
import { expectMotiv } from './motiv'

test('switch sounds, sleep timer and mini player', async ({ page }) => {
  await page.goto('./')
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Klänge' }).click()
  const tiles = page.locator('button[aria-pressed]')
  await expect(tiles).toHaveText(ALL_TILES.map((t) => t.title))

  await page.getByRole('button', { name: 'Regen' }).click()
  await expect(page.getByRole('button', { name: 'Regen' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('slider', { name: 'Lautstärke Regen' })).toBeVisible()
  await expect(page.getByText('Läuft endlos')).toBeVisible()

  await page.getByRole('radio', { name: '15 Min' }).click()
  await expect(page.getByText(/^Noch 1[45]:\d\d$/)).toBeVisible()

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()
  await page.getByRole('button', { name: 'Weiter' }).click()

  // Antippen wechselt: Es läuft immer nur ein Klang, der Sleep-Timer läuft weiter.
  await page.getByRole('button', { name: 'Wald mit Vögeln' }).click()
  await expect(page.getByRole('button', { name: 'Wald mit Vögeln' })).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 })
  await expect(page.getByRole('button', { name: 'Regen' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(1)
  await expect(page.getByRole('slider')).toHaveCount(1)
  await expect(page.getByRole('slider', { name: 'Lautstärke Wald mit Vögeln' })).toBeVisible()
  await expect(page.getByText(/^Noch 1[45]:\d\d$/)).toBeVisible()

  await nav.getByRole('button', { name: 'Heute' }).click()
  const mini = page.getByRole('region', { name: 'Wiedergabe' })
  const miniTitle = mini.getByRole('button', { name: 'Wald mit Vögeln', exact: true })
  await expect(miniTitle).toBeVisible()
  await expect(mini).not.toContainText('Regen')
  await mini.getByRole('button', { name: 'Pause' }).click()
  await expect(mini.getByRole('button', { name: 'Weiter' })).toBeVisible()

  await miniTitle.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
  await page.getByRole('button', { name: 'Stoppen', exact: true }).click()
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(0)
  await nav.getByRole('button', { name: 'Heute' }).click()
  await expect(page.getByRole('region', { name: 'Wiedergabe' })).toHaveCount(0)
})

test('status text does not claim "Läuft endlos" while paused', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Klänge' }).click()
  await page.getByRole('button', { name: 'Regen' }).click()
  await expect(page.getByText('Läuft endlos')).toBeVisible()

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()
  await expect(page.getByText('Läuft endlos')).toHaveCount(0)

  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.getByText('Läuft endlos')).toBeVisible()

  await page.getByRole('button', { name: 'Stoppen', exact: true }).click()
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(0)
})

async function openKlaenge(page: Page) {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Klänge' }).click()
}

// Die acht Kacheln in der Reihenfolge der Liste: Titel, Motiv.
const SOUND_TILES = [
  { title: 'Regen', motiv: 'klang-regen' },
  { title: 'Meeresrauschen', motiv: 'klang-meer' },
  { title: 'Wind', motiv: 'klang-wind' },
  { title: 'Braunes Rauschen', motiv: 'klang-braun' },
  { title: 'Wald mit Vögeln', motiv: 'klang-wald' },
  { title: 'Kaminfeuer', motiv: 'klang-kaminfeuer' },
  { title: 'Bach', motiv: 'klang-bach' },
  { title: 'Klangschalen', motiv: 'klang-klangschalen' },
] as const

// Die sieben Musikkacheln stehen vor den Naturklängen, in einem eigenen Abschnitt.
const MUSIC_TILES = [
  { title: 'Schwebende Flächen', motiv: 'musik-schwebend' },
  { title: 'Stilles Klavier', motiv: 'musik-klavier' },
  { title: 'Obertöne', motiv: 'musik-obertoene' },
  { title: 'Bambusflöte', motiv: 'musik-bambusfloete' },
  { title: 'Zwischen zwei Atemzügen', motiv: 'musik-zwischen-zwei-atemzuegen' },
  { title: 'Salz und Sternenlicht', motiv: 'musik-salz-und-sternenlicht' },
  { title: 'Unter der Oberfläche', motiv: 'musik-unter-der-oberflaeche' },
] as const
const ALL_TILES = [...MUSIC_TILES, ...SOUND_TILES]

// Die Nachbarkachel in derselben Zeile: je Abschnitt zwei je Zeile, die siebte Musikkachel steht allein.
const partner = (i: number) =>
  i < MUSIC_TILES.length ? ((i ^ 1) < MUSIC_TILES.length ? i ^ 1 : i) : MUSIC_TILES.length + ((i - MUSIC_TILES.length) ^ 1)

const soundTile = (page: Page, title: string) => page.getByRole('button', { name: title, exact: true })
const soundTiles = (page: Page) => page.locator('button[aria-pressed]')
const MOTIF_SIZE = 128

// Maße aller Kacheln (das Gitterelement `.tile` samt Rand) in einem Zug, unabhängig vom Einblenden des Bildschirms.
const tileBoxes = (page: Page) =>
  page.locator('.tile').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }),
  )

test('each tile shows its motif as decoration, centred at the top, and tapping the motif plays the sound', async ({ page }) => {
  await openKlaenge(page)
  await expect(soundTiles(page)).toHaveCount(15)
  for (const t of ALL_TILES) {
    const button = soundTile(page, t.title)
    await expect(button.locator('img')).toHaveCount(1)
    await expectMotiv(button.locator('img'), t.motiv, MOTIF_SIZE)
    // Der Name des Knopfes bleibt der Titel: Das Motiv trägt keinen Text bei.
    await expect(button).toHaveAccessibleName(t.title)
    expect(await button.evaluate((el) => (el as HTMLElement).innerText.replace(/\u00ad/g, ''))).toBe(t.title)
    const place = await button.evaluate((el) => {
      const tileRect = el.getBoundingClientRect()
      const motif = el.querySelector('img')!.getBoundingClientRect()
      return {
        centre: motif.left + motif.width / 2 - (tileRect.left + tileRect.width / 2),
        fromTop: motif.top - tileRect.top,
        inside: motif.left >= tileRect.left && motif.right <= tileRect.right && motif.bottom <= tileRect.bottom,
      }
    })
    expect(Math.abs(place.centre)).toBeLessThanOrEqual(1)
    expect(place.fromTop).toBeLessThanOrEqual(24)
    expect(place.inside).toBe(true)
  }
  // Auf das Motiv getippt: Die ganze Kachel ist der Knopf.
  await soundTile(page, 'Bach').locator('img').click()
  await expect(soundTile(page, 'Bach')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('slider', { name: 'Lautstärke Bach' })).toBeVisible()
})

// Die berechnete Farbe eines Ausdrucks (`var(--tile-scrim)` usw.), gelesen über ein Hilfselement in der Kachel.
const resolveColor = (target: Locator, expression: string) =>
  target.evaluate((el, value) => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = value
    el.appendChild(probe)
    const color = getComputedStyle(probe).backgroundColor
    probe.remove()
    return color
  }, expression)

test.describe('the title stays readable over the picture, in every mood', () => {
  test.use({ timezoneId: 'Europe/Berlin' })

  for (const [time, mood] of [
    ['08:00:00', 'morgen'],
    ['14:00:00', 'tag'],
    ['20:00:00', 'abend'],
  ] as const) {
    test(`the title has at least 4.5:1 against its gradient: ${time} → ${mood}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(`2026-10-22T${time}+02:00`))
      await openKlaenge(page)
      await expect(page.locator('html')).toHaveAttribute('data-tageszeit', mood)
      await expect(soundTiles(page)).toHaveCount(15)

      const tile = page.locator('.tile').first()
      const scrimCss = await resolveColor(tile, 'var(--tile-scrim)')
      const scrim = parseColor(scrimCss)
      const skyBottom = parseColor(await resolveColor(tile, 'var(--sky-bottom)'))
      // Der Verlauf deckt kräftig: Dahinter liegt ein Motiv, kein Himmel.
      expect(scrim[3]).toBeGreaterThanOrEqual(0.75)

      // Der Titel steht auf der vollen Farbe des Verlaufs: Unter dem Auslauf (`--tile-fade`), nicht darin.
      const titles = await page.locator('.title').evaluateAll((els) =>
        els.map((el) => {
          const label = el.parentElement!
          const fade = parseFloat(getComputedStyle(label).paddingTop)
          return {
            color: getComputedStyle(el).color,
            image: getComputedStyle(label).backgroundImage,
            belowFade: el.getBoundingClientRect().top - label.getBoundingClientRect().top >= fade - 0.5,
            fade,
          }
        }),
      )
      expect(titles).toHaveLength(15)
      for (const title of titles) {
        // Der gemalte Verlauf hinter dem Titel hat die Farbe des Tokens, das hier geprüft wird.
        expect(title.image).toMatch(/^linear-gradient\(/)
        expect(title.image).toContain(scrimCss)
        expect(title.belowFade).toBe(true)
        expect(title.fade).toBeGreaterThan(0)
        const text = parseColor(title.color)
        // Schlimmster Fall: ein helles Motiv (weiß) unter dem Verlauf; dazu der Himmel unten.
        expect(contrast(text, over(scrim, [255, 255, 255, 1]))).toBeGreaterThanOrEqual(4.5)
        expect(contrast(text, over(scrim, skyBottom))).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})

test('an active tile keeps its height, shows the accent, and keeps its title clear of the slider', async ({ page }) => {
  await openKlaenge(page)
  await expect(soundTiles(page)).toHaveCount(15)
  const before = await tileBoxes(page)

  await soundTile(page, 'Meeresrauschen').click()
  const slider = page.getByRole('slider', { name: 'Lautstärke Meeresrauschen' })
  await expect(slider).toBeVisible()
  // Höhe wie vorher, auch wenn der Regler erscheint (die Zeile bleibt, nichts springt).
  await expect
    .poll(async () => (await tileBoxes(page)).every((box, i) => Math.abs(box.height - before[i].height) <= 1))
    .toBe(true)

  // Die aktive Kachel erkennt man am Akzent (Rand); die anderen haben ihn nicht.
  const active = page.locator('.tile.active')
  await expect(active).toHaveCount(1)
  await expect(active.getByRole('button', { name: 'Meeresrauschen', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const accent = parseColor(await resolveColor(active, 'var(--accent)'))
  await expect.poll(async () => parseColor(await active.evaluate((el) => getComputedStyle(el).borderTopColor))).toEqual(accent)
  const idle = page.locator('.tile:not(.active)').first()
  expect(parseColor(await idle.evaluate((el) => getComputedStyle(el).borderTopColor))).not.toEqual(accent)

  // Titel und Regler liegen übereinander, nicht ineinander, beide in der Kachel; der Titel bleibt sichtbar.
  const place = await active.evaluate((el) => {
    const tileRect = el.getBoundingClientRect()
    const title = el.querySelector('.title')!.getBoundingClientRect()
    const range = el.querySelector('input')!.getBoundingClientRect()
    return {
      titleAboveRange: range.top - title.bottom,
      titleTop: title.top - tileRect.top,
      rangeBottom: tileRect.bottom - range.bottom,
    }
  })
  expect(place.titleAboveRange).toBeGreaterThanOrEqual(-1)
  expect(place.titleTop).toBeGreaterThan(0)
  expect(place.rangeBottom).toBeGreaterThanOrEqual(0)

  // Und wieder aus: Tippen auf dieselbe Kachel stoppt, der Regler geht, die Höhe bleibt.
  await soundTile(page, 'Meeresrauschen').click()
  await expect(slider).toHaveCount(0)
  await expect(page.locator('.tile.active')).toHaveCount(0)
  await expect
    .poll(async () => (await tileBoxes(page)).every((box, i) => Math.abs(box.height - before[i].height) <= 1))
    .toBe(true)
})

test.describe('when the motifs do not load', () => {
  // Der Service Worker des ersten Besuchs würde die Bilder aus dem Speicher liefern, an `page.route` vorbei.
  test.use({ serviceWorkers: 'block' })

  test('the tiles keep their size and names, and tapping still toggles', async ({ page }) => {
    await openKlaenge(page)
    await expect(soundTiles(page)).toHaveCount(15)
    for (const t of ALL_TILES) await expectMotiv(soundTile(page, t.title).locator('img'), t.motiv, MOTIF_SIZE)
    const withImages = await tileBoxes(page)

    await page.route('**/images/motive/**', (route) => route.fulfill({ status: 404 }))
    await openKlaenge(page)
    await expect(soundTiles(page)).toHaveCount(15)
    // Die Bilder sind wirklich ausgefallen (sonst prüfte der Test nichts), die Flächen bleiben.
    await expect
      .poll(() =>
        page.locator('img.motiv').evaluateAll((imgs) => (imgs as HTMLImageElement[]).every((img) => img.complete && img.naturalWidth === 0)),
      )
      .toBe(true)
    expect(await page.locator('img.motiv').count()).toBe(15)
    for (const img of await page.locator('img.motiv').all()) {
      expect(await img.evaluate((el: HTMLImageElement) => [el.offsetWidth, el.offsetHeight])).toEqual([MOTIF_SIZE, MOTIF_SIZE])
    }

    // Alle gleich groß, je Zeile gleiche Höhe, nicht anders als mit Bildern.
    const without = await tileBoxes(page)
    expect(without).toHaveLength(15)
    for (const [i, box] of without.entries()) {
      expect(box.width).toBeCloseTo(withImages[i].width, 0)
      expect(box.height).toBeCloseTo(withImages[i].height, 0)
      expect(box.width).toBeCloseTo(without[0].width, 0)
      expect(box.height).toBeCloseTo(without[0].height, 0)
      expect(box.y).toBeCloseTo(without[partner(i)].y, 0)
    }
    await expect(soundTiles(page)).toHaveText(ALL_TILES.map((t) => t.title))

    // Bedienbar: Tippen spielt, der Regler erscheint, noch einmal tippen stoppt.
    const regen = soundTile(page, 'Regen')
    await regen.click()
    await expect(regen).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('slider', { name: 'Lautstärke Regen' })).toBeVisible()
    await regen.click()
    await expect(regen).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('slider')).toHaveCount(0)
  })
})

test.describe('on a narrow screen with large system text', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  // Nichts läuft seitlich über, und kein Text, Motiv oder Regler ragt aus seiner Kachel.
  async function expectFits(page: Page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    const problems = await page.locator('.tile').evaluateAll((els) =>
      els.flatMap((el) => {
        const outer = el.getBoundingClientRect()
        const name = el.querySelector('.title')!.textContent
        const found: string[] = []
        for (const part of [el, el.querySelector('button')!]) {
          if (part.scrollWidth > part.clientWidth) found.push(`${name}: scrollWidth ${part.scrollWidth} > ${part.clientWidth}`)
          if (part.scrollHeight > part.clientHeight) found.push(`${name}: scrollHeight ${part.scrollHeight} > ${part.clientHeight}`)
        }
        for (const child of el.querySelectorAll('*')) {
          const r = child.getBoundingClientRect()
          if (r.left < outer.left - 0.5 || r.right > outer.right + 0.5 || r.top < outer.top - 0.5 || r.bottom > outer.bottom + 0.5) {
            found.push(`${name}: ${child.tagName.toLowerCase()} ragt heraus`)
          }
        }
        // Der Titel bricht nur an Leerzeichen und weichen Trennstellen (U+00AD) um, nie mitten im Wort: Zwei
        // Buchstaben, zwischen denen keine Trennstelle liegt, stehen in derselben Zeile. (Der Buchstabe direkt
        // hinter einer Trennstelle meldet sein Rechteck samt dem Trennstrich der Zeile davor: übersprungen.)
        const text = el.querySelector('.title')!.firstChild as Text
        const range = document.createRange()
        const topOf = (i: number) => {
          range.setStart(text, i)
          range.setEnd(text, i + 1)
          return range.getBoundingClientRect().top
        }
        for (let i = 0; i + 1 < text.data.length; i++) {
          const [a, b] = [text.data[i], text.data[i + 1]]
          if (text.data[i - 1] !== '\u00ad' && /\p{L}/u.test(a) && /\p{L}/u.test(b) && topOf(i + 1) > topOf(i) + 2) {
            found.push(`${name}: „${text.data}“ bricht mitten im Wort zwischen „${a}“ und „${b}“`)
          }
        }
        return found
      }),
    )
    expect(problems).toEqual([])
  }

  test('nothing overflows its tile or the page, at normal size and at 130 %, idle and active', async ({ page }) => {
    await openKlaenge(page)
    await expect(soundTiles(page)).toHaveCount(15)
    const normal = await tileBoxes(page)
    expect(normal[0].width).toBeCloseTo(normal[1].width, 0)
    await expectFits(page)

    await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
    await expectFits(page)
    // Zwei je Zeile, gleich breit, je Zeile gleich hoch und innerhalb des Bildschirms.
    const large = await tileBoxes(page)
    expect(large).toHaveLength(15)
    for (const [i, box] of large.entries()) {
      expect(box.width).toBeCloseTo(large[0].width, 0)
      expect(box.height).toBeCloseTo(large[partner(i)].height, 0)
      expect(box.y).toBeCloseTo(large[partner(i)].y, 0)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(360)
    }

    // Auch die aktive Kachel mit Regler (längster Titel, größte Schrift).
    await soundTile(page, 'Braunes Rauschen').click()
    await expect(page.getByRole('slider', { name: 'Lautstärke Braunes Rauschen' })).toBeVisible()
    await expectFits(page)
  })
})

test('music comes first, then nature', async ({ page }) => {
  await openKlaenge(page)
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Musik', 'Natur', 'Sleep-Timer'])
  const music = page.getByRole('region', { name: 'Musik' })
  const nature = page.getByRole('region', { name: 'Natur' })
  await expect(music.locator('button[aria-pressed]')).toHaveText(MUSIC_TILES.map((t) => t.title))
  await expect(nature.locator('button[aria-pressed]')).toHaveText(SOUND_TILES.map((t) => t.title))
  for (const t of MUSIC_TILES) await expectMotiv(soundTile(page, t.title).locator('img'), t.motiv, MOTIF_SIZE)
})

test('a music piece plays, switches with nature and shows in the mini player', async ({ page }) => {
  await openKlaenge(page)
  await soundTile(page, 'Stilles Klavier').click()
  await expect(soundTile(page, 'Stilles Klavier')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 })
  await expect(page.getByRole('slider', { name: 'Lautstärke Stilles Klavier' })).toBeVisible()

  await soundTile(page, 'Regen').click()
  await expect(soundTile(page, 'Regen')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 })
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(1)

  await soundTile(page, 'Obertöne').click()
  await expect(soundTile(page, 'Obertöne')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 })
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(1)
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Heute' }).click()
  await expect(page.getByRole('region', { name: 'Wiedergabe' }).getByRole('button', { name: 'Obertöne', exact: true })).toBeVisible()
})

test('offline, unsaved music is disabled and says so', async ({ page, context }) => {
  await openKlaenge(page)
  const klavier = soundTile(page, 'Stilles Klavier')
  await expect(klavier).toBeEnabled()

  await context.setOffline(true)
  await expect(klavier).toBeDisabled()
  await expect(klavier).toHaveAccessibleDescription('Nicht offline verfügbar')
  await expect(page.getByRole('region', { name: 'Musik' }).getByText('Nicht offline verfügbar')).toHaveCount(7)
  await expect(soundTile(page, 'Regen')).toBeEnabled()

  await context.setOffline(false)
  await expect(klavier).toBeEnabled()
})
