import { test, expect, type Locator, type Page } from '@playwright/test'
import { breathAt, type PhaseKind } from '../../src/lib/breath/patterns'
import { circleScale, easedLevel, petalOffset } from '../../src/lib/breath/view'
import { expectMotiv } from './motiv'
import { doubleTap, expectStillRunning } from './taps'

// Tiefe der obersten Ebene im aktuellen History-Eintrag (0 = keine Ebene offen).
const depth = (page: Page) => page.evaluate(() => (history.state as { ruheLayer?: number } | null)?.ruheLayer ?? 0)

async function openAtmen(page: Page) {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Atmen' }).click()
}

// Sammelt, was die Seite an Vibration und Wake Lock verlangt. `window.__vibrations` sind die
// Aufrufe von navigator.vibrate; `window.__locks` die ausgegebenen Sperren.
type Spy = { __vibrations: unknown[]; __locks: { released: boolean }[] }

async function spyOnDevice(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Spy
    w.__vibrations = []
    w.__locks = []
    navigator.vibrate = (pattern) => {
      w.__vibrations.push(pattern)
      return true
    }
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          const lock = {
            released: false,
            release: async () => {
              lock.released = true
            },
          }
          w.__locks.push(lock)
          return lock
        },
      },
    })
  })
}

const vibrations = (page: Page) => page.evaluate(() => (window as unknown as Spy).__vibrations)
const locks = (page: Page) => page.evaluate(() => (window as unknown as Spy).__locks.map((l) => l.released))

// Die Atem-Blüte. Größe (`--scale`) und Spreizung (`--offset`, Anteil der Blattlänge) setzt der Player
// je Bild aus der Audio-Uhr an ihre Wurzel.
const flower = (page: Page) => page.getByTestId('breath-flower')
const flowerVar = (page: Page, name: '--scale' | '--offset') =>
  flower(page).evaluate((el, name) => Number(getComputedStyle(el).getPropertyValue(name)), name)
const flowerScale = (page: Page) => flowerVar(page, '--scale')

// Was gezeichnet wird, in einem Bild gelesen: die Vorgaben und daneben die Skalierung der Blüte (die Zahl
// vor der Matrix: matrix(s, 0, 0, s, 0, 0)) und die Verschiebung des obersten Blattes in Blattlängen.
const drawn = (page: Page) =>
  flower(page).evaluate((el) => {
    const matrix = (e: Element) => new DOMMatrix(getComputedStyle(e).transform)
    const petal = el.querySelector<HTMLElement>('.petal')!
    return {
      scale: Number(getComputedStyle(el).getPropertyValue('--scale')),
      offset: Number(getComputedStyle(el).getPropertyValue('--offset')),
      bloom: matrix(el.querySelector('.bloom')!).a,
      spread: matrix(petal).f / petal.offsetHeight,
    }
  })

// Die berechneten Transformationen von Drehung, Blüte und den sechs Blättern in einem Zug.
const flowerTransforms = (page: Page) =>
  flower(page).evaluate((el) => [...el.querySelectorAll('.spin, .bloom, .petal')].map((e) => getComputedStyle(e).transform))

// Die Drehung der Blüte (CSS-Animation): Zustand und Stand in Millisekunden.
const spin = (page: Page) =>
  flower(page)
    .locator('.spin')
    .evaluate((el) => el.getAnimations().map((a) => ({ playState: a.playState, currentTime: Number(a.currentTime) })))

// Phasenfarbe des Scheins (eingetragene Farbe, also als rgb() berechnet).
const LAVENDER = 'rgb(183, 168, 240)' // Einatmen, #B7A8F0
const GOLD = 'rgb(242, 201, 138)' // Halten, #F2C98A
const TEAL = 'rgb(143, 208, 214)' // Ausatmen, #8FD0D6
const phaseColor = (page: Page) => flower(page).evaluate((el) => getComputedStyle(el).getPropertyValue('--phase-color').trim())

// Deckkraft der Farbebenen je Phase, über alle Blätter.
const layerOpacities = (page: Page) =>
  flower(page).evaluate((el) => {
    const layers: Record<string, number[]> = { ein: [], halten: [], aus: [] }
    for (const img of el.querySelectorAll<HTMLElement>('img[data-layer]')) layers[img.dataset.layer!].push(Number(getComputedStyle(img).opacity))
    return layers
  })

// Auf allen sechs Blättern ist die Ebene der Phase zu sehen (über 0,5), die beiden anderen nicht (unter 0,1).
async function expectLayer(page: Page, kind: PhaseKind) {
  const layers = await layerOpacities(page)
  for (const [layer, values] of Object.entries(layers)) {
    expect(values, layer).toHaveLength(6)
    for (const value of values) {
      if (layer === kind) expect(value, layer).toBeGreaterThan(0.5)
      else expect(value, layer).toBeLessThan(0.1)
    }
  }
}

// Die Vibrationsmuster je Phase.
const IN = [200]
const HOLD = [60]
const OUT = [150, 120, 150]

test('breathing shows the phases in order and can be ended', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Atmen' }).click()
  await page.getByRole('radio', { name: '1 Min' }).click()
  await page.getByRole('button', { name: '4-7-8 starten' }).click()
  await expect(page.getByText('Einatmen', { exact: true })).toBeVisible()
  await expect(page.getByText('Halten', { exact: true })).toBeVisible({ timeout: 7000 })
  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByRole('heading', { name: 'Gut gemacht.' })).toBeVisible()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atmen')
})

// Die sechs Kacheln in der Reihenfolge der Liste: was sie der Reihe nach zeigen (Titel, Rhythmus, Wirkung),
// ihr Motiv und die Beschreibung, die Hilfstechnik zum Namen „… starten“ vorliest. 4-7-8 zeigt den Rhythmus
// nicht noch einmal, er wäre der Titel.
const TILES = [
  { title: '4-7-8', text: '4-7-8 Einschlafen', motiv: 'atem-478', description: 'Einatmen 4 s · Halten 7 s · Ausatmen 8 s' },
  {
    title: 'Box-Atmung',
    text: 'Box-Atmung 4-4-4-4 Konzentration',
    motiv: 'atem-box',
    description: 'Einatmen 4 s · Halten 4 s · Ausatmen 4 s · Halten 4 s',
  },
  {
    title: 'Kohärentes Atmen',
    text: 'Kohärentes Atmen 5,5-5,5 Balance',
    motiv: 'atem-kohaerent',
    description: 'Einatmen 5,5 s · Ausatmen 5,5 s',
  },
  {
    title: 'Langes Ausatmen',
    text: 'Langes Ausatmen 4-6 Entspannung',
    motiv: 'atem-langes-ausatmen',
    description: 'Einatmen 4 s · Ausatmen 6 s',
  },
  {
    title: 'Physiologischer Seufzer',
    text: 'Physiologischer Seufzer 3+1-6 Schnell beruhigen',
    motiv: 'atem-seufzer',
    description: 'Einatmen 3 s · kurz Nachatmen 1 s · langsam Ausatmen 6 s',
  },
  {
    title: 'Wechselatmung',
    text: 'Wechselatmung 4-4-4-4 Ausgleich',
    motiv: 'atem-wechselatmung',
    description: 'Je 4 s: links ein · rechts aus · rechts ein · links aus. Das andere Nasenloch hältst du mit dem Finger zu.',
  },
] as const

const tile = (page: Page, title: string) => page.getByRole('button', { name: `${title} starten` })
const tiles = (page: Page) => page.getByRole('button', { name: /starten$/ })

// Maße aller Kacheln in einem Zug (ein Bild der Seite), unabhängig vom Einblenden des Bildschirms.
const tileBoxes = (page: Page) =>
  tiles(page).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }),
  )

// Was die Kachel an Text zeigt, ohne die weichen Trennstellen (U+00AD) in den langen Wörtern des Titels.
const tileText = (target: Locator) =>
  target.evaluate((el) => (el as HTMLElement).innerText.replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim())

test('the screen offers four durations with 3 Min preselected and six exercise tiles', async ({ page }) => {
  await openAtmen(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atmen')
  const group = page.getByRole('radiogroup', { name: 'Dauer' })
  await expect(group.getByRole('radio')).toHaveText(['1 Min', '3 Min', '5 Min', '10 Min'])
  await expect(group.getByRole('radio', { name: '3 Min' })).toHaveAttribute('aria-checked', 'true')

  await expect(tiles(page)).toHaveCount(6)
  for (const t of TILES) await expect(tile(page, t.title)).toBeVisible()
  for (const target of [...(await tiles(page).all()), ...(await group.getByRole('radio').all())]) {
    const box = await target.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(48)
    expect(box!.width).toBeGreaterThanOrEqual(48)
  }
})

test('the exercises are tiles in two columns of equal width, two to a row', async ({ page }) => {
  await openAtmen(page)
  await expect(tiles(page)).toHaveCount(6)
  const boxes = await tileBoxes(page)
  const viewport = page.viewportSize()!
  const [first] = boxes
  expect(first.width).toBeGreaterThan(viewport.width / 3)
  for (const [i, box] of boxes.entries()) {
    // Gleiche Breite, links bzw. rechts in derselben Spalte, innerhalb des Bildschirms.
    expect(box.width).toBeCloseTo(first.width, 0)
    expect(box.x).toBeCloseTo(boxes[i % 2].x, 0)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    // Zwei je Zeile: gleiche Oberkante und Höhe wie der Nachbar, die nächste Zeile liegt darunter.
    expect(box.y).toBeCloseTo(boxes[i ^ 1].y, 0)
    expect(box.height).toBeCloseTo(boxes[i ^ 1].height, 0)
    if (i >= 2) expect(box.y).toBeGreaterThan(boxes[i - 2].y + boxes[i - 2].height - 1)
  }
  // Die rechte Spalte beginnt rechts der linken.
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].width - 1)
})

test('each tile shows title, rhythm and effect, is named "… starten" and described as before', async ({ page }) => {
  await openAtmen(page)
  for (const t of TILES) {
    await expect.poll(() => tileText(tile(page, t.title))).toBe(t.text)
    await expect(tile(page, t.title)).toHaveAccessibleDescription(t.description)
  }
  // 4-7-8: Der Titel ist schon der Rhythmus und steht nur einmal da.
  await expect(tile(page, '4-7-8').getByText('4-7-8', { exact: true })).toHaveCount(1)
})

test('the motif sits at the top of its tile, at the start, above the title, and is decoration', async ({ page }) => {
  await openAtmen(page)
  for (const t of TILES) {
    const target = tile(page, t.title)
    await expectMotiv(target.locator('img.motiv'), t.motiv, 80)
    const place = await target.evaluate((el, title) => {
      const rect = (e: Element) => e.getBoundingClientRect()
      const heading = [...el.querySelectorAll('span')].find((s) => s.textContent!.replace(/\u00ad/g, '') === title)!
      const tileRect = rect(el)
      const motif = rect(el.querySelector('img.motiv')!)
      const text = rect(heading)
      return {
        fromStart: motif.left - tileRect.left,
        fromTop: motif.top - tileRect.top,
        sameStart: motif.left - text.left,
        above: text.top - motif.bottom,
      }
    }, t.title)
    expect(place.fromStart).toBeLessThanOrEqual(24)
    expect(place.fromTop).toBeLessThanOrEqual(24)
    expect(Math.abs(place.sameStart)).toBeLessThanOrEqual(1)
    expect(place.above).toBeGreaterThanOrEqual(0)
  }
})

test('tapping anywhere on a tile starts it with the chosen duration', async ({ page }) => {
  await openAtmen(page)
  await page.getByRole('radio', { name: '10 Min' }).click()
  // Auf die Wirkung statt auf die Mitte des Knopfes: Die ganze Kachel ist der Knopf.
  await page.getByText('Konzentration', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Atmen · Box-Atmung' })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null').lastUsed)).toEqual({
    kind: 'breath',
    pattern: 'box',
    minutes: 10,
  })
  await page.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()

  // Und auf das Motiv.
  await tile(page, 'Langes Ausatmen').locator('img.motiv').click()
  await expect(page.getByRole('heading', { name: 'Atmen · Langes Ausatmen' })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null').lastUsed)).toEqual({
    kind: 'breath',
    pattern: 'langes-ausatmen',
    minutes: 10,
  })
})

test.describe('when the motifs do not load', () => {
  // Der Service Worker des ersten Besuchs würde die Bilder aus dem Speicher liefern, an `page.route` vorbei.
  test.use({ serviceWorkers: 'block' })

  test('the tiles keep their size, names and texts', async ({ page }) => {
    await openAtmen(page)
    await expect(tiles(page)).toHaveCount(6)
    for (const t of TILES) await expectMotiv(tile(page, t.title).locator('img.motiv'), t.motiv, 80)
    const withImages = await tileBoxes(page)

    await page.route('**/images/motive/**', (route) => route.fulfill({ status: 404 }))
    await openAtmen(page)
    await expect(tiles(page)).toHaveCount(6)
    // Die Bilder sind wirklich ausgefallen (sonst prüfte der Test nichts), die Flächen bleiben.
    await expect
      .poll(() =>
        page.locator('img.motiv').evaluateAll((imgs) => (imgs as HTMLImageElement[]).every((img) => img.complete && img.naturalWidth === 0)),
      )
      .toBe(true)
    expect(await page.locator('img.motiv').count()).toBe(6)
    for (const img of await page.locator('img.motiv').all()) {
      expect(await img.evaluate((el: HTMLImageElement) => [el.offsetWidth, el.offsetHeight])).toEqual([80, 80])
    }

    const without = await tileBoxes(page)
    for (const [i, box] of without.entries()) {
      expect(box.width).toBeCloseTo(withImages[i].width, 0)
      expect(box.height).toBeCloseTo(withImages[i].height, 0)
      expect(box.width).toBeCloseTo(without[0].width, 0)
      expect(box.height).toBeCloseTo(without[i ^ 1].height, 0)
    }
    for (const t of TILES) {
      await expect.poll(() => tileText(tile(page, t.title))).toBe(t.text)
      await expect(tile(page, t.title)).toHaveAccessibleDescription(t.description)
    }
  })
})

test.describe('on a narrow screen with large system text', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  // Nichts läuft seitlich über, und kein Text (oder Motiv) ragt aus seiner Kachel.
  async function expectFits(page: Page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    const overflow = await tiles(page).evaluateAll((els) =>
      els.flatMap((el) => {
        const outer = el.getBoundingClientRect()
        const problems: string[] = []
        if (el.scrollWidth > el.clientWidth) problems.push(`${el.getAttribute('aria-label')}: scrollWidth ${el.scrollWidth} > ${el.clientWidth}`)
        if (el.scrollHeight > el.clientHeight) problems.push(`${el.getAttribute('aria-label')}: scrollHeight ${el.scrollHeight} > ${el.clientHeight}`)
        // Die Waschung (ihr Bild ist größer als die Zone und von ihr beschnitten) prüft karten.spec.ts.
        for (const child of el.querySelectorAll('*:not(.waschung, .waschung *)')) {
          const r = child.getBoundingClientRect()
          if (r.left < outer.left - 0.5 || r.right > outer.right + 0.5 || r.top < outer.top - 0.5 || r.bottom > outer.bottom + 0.5) {
            problems.push(`${el.getAttribute('aria-label')}: ${child.tagName.toLowerCase()} "${child.textContent}" ragt heraus`)
          }
        }
        // Der Titel bricht nur an Leerzeichen, Bindestrichen und weichen Trennstellen (U+00AD) um, nie mitten im
        // Wort: Zwei Buchstaben, zwischen denen keine Trennstelle liegt, stehen in derselben Zeile. (Der Buchstabe
        // direkt hinter einer Trennstelle meldet sein Rechteck samt dem Trennstrich der Zeile davor: übersprungen.)
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
            problems.push(`${el.getAttribute('aria-label')}: „${text.data}“ bricht mitten im Wort zwischen „${a}“ und „${b}“`)
          }
        }
        return problems
      }),
    )
    expect(overflow).toEqual([])
  }

  // Die Dauer-Chips: je Chip eine Textzeile (nur die Mindesthöhe von 48 px), nichts läuft heraus. Oberkanten der Chips.
  async function chipTops(page: Page) {
    const chips = await page
      .getByRole('radiogroup', { name: 'Dauer' })
      .getByRole('radio')
      .evaluateAll((els) => els.map((el) => ({ top: el.getBoundingClientRect().top, height: el.getBoundingClientRect().height, overflow: el.scrollWidth > el.clientWidth })))
    expect(chips).toHaveLength(4)
    for (const chip of chips) {
      expect(chip.height).toBeLessThanOrEqual(48.5)
      expect(chip.overflow).toBe(false)
    }
    return chips.map((chip) => Math.round(chip.top))
  }

  test('nothing overflows its tile or the page, at normal size and at 130 %', async ({ page }) => {
    await openAtmen(page)
    await expect(tiles(page)).toHaveCount(6)
    const normal = await tileBoxes(page)
    expect(normal[0].width).toBeCloseTo(normal[1].width, 0)
    await expectFits(page)
    // Bei normaler Schrift stehen die vier Dauer-Chips in einer Zeile.
    expect(new Set(await chipTops(page)).size).toBe(1)

    await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
    await expectFits(page)
    // Bei 130 % dürfen sie umbrechen, aber kein Chip bricht in sich um oder läuft über.
    await chipTops(page)
    // Die Kacheln sind weiter zwei je Zeile, gleich breit, je Zeile gleich hoch und innerhalb des Bildschirms.
    const large = await tileBoxes(page)
    for (const [i, box] of large.entries()) {
      expect(box.width).toBeCloseTo(large[0].width, 0)
      expect(box.height).toBeCloseTo(large[i ^ 1].height, 0)
      expect(box.x + box.width).toBeLessThanOrEqual(360)
      expect(box.y).toBeCloseTo(large[i ^ 1].y, 0)
    }
  })
})

test('starting remembers the exercise and duration, and the labels follow the pattern', async ({ page }) => {
  await openAtmen(page)
  await page.getByRole('radio', { name: '5 Min' }).click()
  await expect(page.getByRole('radio', { name: '5 Min' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Wechselatmung starten' }).click()
  await expect(page.getByRole('heading', { name: 'Atmen · Wechselatmung' })).toBeVisible()
  await expect(page.getByText('Links einatmen', { exact: true })).toBeVisible()
  await expect(page.getByText('Rechts ausatmen', { exact: true })).toBeVisible({ timeout: 6000 })
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null').lastUsed)).toEqual({
    kind: 'breath',
    pattern: 'wechselatmung',
    minutes: 5,
  })
})

test('the countdown shows the seconds left of the phase', async ({ page }) => {
  await openAtmen(page)
  await page.getByRole('button', { name: 'Box-Atmung starten' }).click()
  const countdown = page.getByRole('timer')
  await expect(page.getByText('Einatmen', { exact: true })).toBeVisible()
  await expect(countdown).toHaveText(/^[1-4]$/)
  await expect(page.getByText('Halten', { exact: true })).toBeVisible({ timeout: 6000 })
  // Eine neue Phase beginnt wieder bei ihrer vollen Länge.
  await expect(countdown).toHaveText(/^[34]$/)
})

test('back asks before ending and never leaves extra history entries', async ({ page }) => {
  await openAtmen(page)
  const confirm = page.getByRole('alertdialog', { name: 'Übung beenden?' })
  const done = page.getByRole('heading', { name: 'Gut gemacht.' })

  await page.getByRole('button', { name: '4-7-8 starten' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Atmen · 4-7-8' })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)
  await expect(page.locator('[inert] main')).toHaveCount(1)
  await expect(page.locator('[inert] nav')).toHaveCount(1)

  // Zurück fragt nach; Zurück im Dialog heißt „Weiter atmen“.
  await page.goBack()
  await expect(confirm).toBeVisible()
  await expect(confirm.getByRole('button')).toHaveText(['Weiter atmen', 'Beenden'])
  await expect.poll(() => depth(page)).toBe(2)
  await page.goBack()
  await expect(confirm).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)

  // „Weiter atmen“ im Dialog schließt ihn und lässt die Übung laufen.
  await page.goBack()
  await confirm.getByRole('button', { name: 'Weiter atmen' }).click()
  await expect(confirm).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)

  // „Beenden“ im Dialog führt zum Abschluss, ohne zweiten Dialog und ohne zusätzlichen Eintrag.
  await page.goBack()
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Beenden' }).click()
  await expect(done).toBeVisible()
  await expect(page.getByText('Unter einer Minute – das zählt noch nicht für die Statistik.')).toBeVisible()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(1)

  // Zurück im Abschluss schließt den Player; man ist wieder im Reiter, von dem man kam.
  await page.goBack()
  await expect(done).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atmen')
  await expect.poll(() => depth(page)).toBe(0)
  await expect(page.locator('[inert]')).toHaveCount(0)
})

test('pause freezes countdown and flower and stops the animation loop', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: number }
    w.__frames = 0
    const request = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (callback) => {
      w.__frames++
      return request(callback)
    }
  })
  const frames = () => page.evaluate(() => (window as unknown as { __frames: number }).__frames)
  await openAtmen(page)
  await page.getByRole('button', { name: 'Box-Atmung starten' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  const first = await frames()
  await expect.poll(frames).toBeGreaterThan(first + 5) // läuft Bild für Bild

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()
  await page.waitForTimeout(400) // die Audio-Uhr hält an, die Schleife beruhigt sich
  const paused = {
    frames: await frames(),
    seconds: await page.getByRole('timer').innerText(),
    transforms: await flowerTransforms(page),
    layers: await layerOpacities(page),
  }
  await page.waitForTimeout(1500)
  expect(await frames()).toBe(paused.frames)
  expect(await page.getByRole('timer').innerText()).toBe(paused.seconds)
  expect(await flowerTransforms(page)).toEqual(paused.transforms)
  expect(await layerOpacities(page)).toEqual(paused.layers)

  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect.poll(frames).toBeGreaterThan(paused.frames + 5)
})

test('the flower opens while breathing in, rests while holding and closes while breathing out', async ({ page }) => {
  test.setTimeout(45_000)
  await openAtmen(page)
  await page.getByRole('button', { name: 'Box-Atmung starten' }).click()
  const inhale = page.getByText('Einatmen', { exact: true })
  const hold = page.getByText('Halten', { exact: true })
  const exhale = page.getByText('Ausatmen', { exact: true })

  // Ausgeatmet ist die Blüte knapp halb so groß und geschlossen; sie wächst sanft und spreizt sich.
  await expect(inhale).toBeVisible()
  const early = await drawn(page)
  expect(early.scale).toBeGreaterThanOrEqual(circleScale(0) - 0.01)
  expect(early.scale).toBeLessThan(0.75)
  await expect.poll(() => flowerScale(page)).toBeGreaterThan(early.scale + 0.1)
  const opening = await drawn(page)
  expect(opening.offset).toBeLessThan(early.offset)
  // Gezeichnet wird, was der Player vorgibt: Größe der Blüte, Verschiebung der Blätter nach außen.
  expect(opening.bloom).toBeCloseTo(opening.scale, 3)
  expect(opening.spread).toBeCloseTo(opening.offset, 2)

  await expect(hold).toBeVisible({ timeout: 6000 })
  await expect.poll(() => flowerScale(page)).toBeGreaterThan(0.97)
  await page.waitForTimeout(1000)
  const open = await drawn(page)
  expect(open.scale).toBeCloseTo(circleScale(1), 2)
  expect(open.offset).toBeCloseTo(petalOffset(1), 2)
  expect(open.bloom).toBeCloseTo(open.scale, 3)
  expect(open.spread).toBeCloseTo(open.offset, 2)

  await expect(exhale).toBeVisible({ timeout: 6000 })
  const start = await flowerScale(page)
  expect(start).toBeGreaterThan(0.85)
  await expect.poll(() => flowerScale(page)).toBeLessThan(start - 0.1)
  expect(await flowerVar(page, '--offset')).toBeGreaterThan(open.offset)
})

test('petals change colour with the phase', async ({ page }) => {
  test.setTimeout(45_000)
  await openAtmen(page)
  await page.getByRole('button', { name: 'Box-Atmung starten' }).click()
  for (const [label, kind, color] of [
    ['Einatmen', 'ein', LAVENDER],
    ['Halten', 'halten', GOLD],
    ['Ausatmen', 'aus', TEAL],
  ] as const) {
    await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 6000 })
    await expect(flower(page)).toHaveAttribute('data-phase', kind)
    // Nach dem Überblenden (0,6 s): die Ebene der Phase auf allen Blättern, der Schein in ihrer Farbe.
    await page.waitForTimeout(1000)
    await expectLayer(page, kind)
    expect(await phaseColor(page)).toBe(color)
  }
})

test('the old circle and phase ring are gone', async ({ page }) => {
  await openAtmen(page)
  await page.getByRole('button', { name: '4-7-8 starten' }).click()
  await expect(flower(page)).toBeVisible()
  await expect(page.getByTestId('breath-circle')).toHaveCount(0)
  await expect(page.getByTestId('phase-ring')).toHaveCount(0)

  // An ihrer Stelle sechs gemalte Blätter, je um 60° gedreht, jedes mit den drei Farbebenen. Alles Schmuck:
  // Phasenwort und Countdown tragen die Bedeutung.
  await expect(flower(page)).toHaveAttribute('aria-hidden', 'true')
  const petals = flower(page).locator('.petal')
  await expect(petals).toHaveCount(6)
  const angles = await petals.evaluateAll((els) =>
    els.map((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform)
      return Math.round(((Math.atan2(m.b, m.a) * 180) / Math.PI + 360) % 360)
    }),
  )
  expect(angles).toEqual([0, 60, 120, 180, 240, 300])
  for (const kind of ['ein', 'halten', 'aus'] as const) {
    const layers = flower(page).locator(`img[data-layer="${kind}"]`)
    await expect(layers).toHaveCount(6)
    for (const img of await layers.all()) {
      await expect(img).toHaveAttribute('src', new RegExp(`/images/motive/blatt-${kind}\\.webp$`))
      await expect(img).toHaveAttribute('alt', '')
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
    }
  }
})

test('with reduced motion the flower stands still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openAtmen(page)
  await page.getByRole('button', { name: '4-7-8 starten' }).click()
  await expect(page.getByText('Einatmen', { exact: true })).toBeVisible()
  const animations = () => flower(page).evaluate((el) => el.getAnimations({ subtree: true }).length)

  // Mittlere Größe und Spreizung (Atemstand 0,5), keine Drehung, keine laufende Animation.
  const still = await flowerTransforms(page)
  const middle = await drawn(page)
  expect(middle.bloom).toBeCloseTo(circleScale(0.5), 3)
  expect(middle.spread).toBeCloseTo(petalOffset(0.5), 2)
  expect(still[0]).toBe('none')
  expect(await animations()).toBe(0)
  expect(await phaseColor(page)).toBe(LAVENDER)
  await expectLayer(page, 'ein')
  await page.waitForTimeout(3000)
  expect(await flowerTransforms(page)).toEqual(still)

  // Ohne Übergang: Farbe und Ebene wechseln mit dem Text, die Blüte bleibt, wie sie ist.
  await expect(page.getByText('Halten', { exact: true })).toBeVisible({ timeout: 6000 })
  expect(await phaseColor(page)).toBe(GOLD)
  await expectLayer(page, 'halten')
  expect(await flowerTransforms(page)).toEqual(still)
  expect(await animations()).toBe(0)
  await expect(page.getByRole('timer')).toHaveText(/^[5-7]$/)
})

// Die Audio-Uhr selbst ist hier nicht lesbar. Im Halten von 4-7-8 steht der Atemstand aber fest bei 1;
// danach zeigt der Beginn des Ausatmens, ob die Blüte wieder mitläuft (Ruling R7).
test('paused flower stands still and is in time after resume', async ({ page }) => {
  test.setTimeout(45_000)
  await openAtmen(page)
  await page.getByRole('radio', { name: '1 Min' }).click() // 76 s, vier Zyklen
  await page.getByRole('button', { name: '4-7-8 starten' }).click()
  const hold = page.getByText('Halten', { exact: true })
  const full = circleScale(1)

  await expect(hold).toBeVisible({ timeout: 6000 })
  await expect.poll(() => flowerScale(page)).toBeGreaterThan(full - 0.05)
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()
  await expect.poll(async () => (await spin(page)).map((a) => a.playState)).toEqual(['paused'])
  const paused = { transforms: await flowerTransforms(page), scale: await flowerScale(page), spin: await spin(page) }
  expect(Math.abs(paused.scale - full)).toBeLessThan(0.05)
  await page.waitForTimeout(2000)
  expect(await flowerTransforms(page)).toEqual(paused.transforms)
  expect(await flowerScale(page)).toBe(paused.scale)
  expect(await spin(page)).toEqual(paused.spin)

  // Weiter: noch im Halten, also voll geöffnet; die Drehung läuft weiter, wo sie stand.
  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect(hold).toBeVisible()
  expect(Math.abs((await flowerScale(page)) - full)).toBeLessThan(0.05)
  await expect.poll(async () => (await spin(page)).map((a) => a.playState)).toEqual(['running'])
  await expect.poll(async () => (await spin(page))[0].currentTime).toBeGreaterThan(paused.spin[0].currentTime)

  // Mit dem Ausatmen (8 s, sanft beginnend) schließt sie sich: Nach 1,5 s ist sie kleiner als nach 1 s Ausatmen.
  const afterOneSecond = circleScale(easedLevel(breathAt('478', 4 + 7 + 1, 76)))
  await expect(page.getByText('Ausatmen', { exact: true })).toBeVisible({ timeout: 8000 })
  await expect.poll(() => flowerScale(page), { timeout: 1500, intervals: [100] }).toBeLessThan(afterOneSecond)
})

test('the player shows the description of the exercise under the title', async ({ page }) => {
  for (const t of [TILES[0], TILES[5]]) {
    await openAtmen(page)
    await tile(page, t.title).click()
    const player = page.getByRole('dialog', { name: 'Atemübung' })
    const title = player.getByRole('heading', { level: 2, name: `Atmen · ${t.title}` })
    const description = player.getByText(t.description, { exact: true })
    await expect(description).toBeVisible()
    const [above, below, stage] = await Promise.all([title.boundingBox(), description.boundingBox(), flower(page).boundingBox()])
    expect(below!.y).toBeGreaterThanOrEqual(above!.y + above!.height - 1)
    expect(below!.y + below!.height).toBeLessThanOrEqual(stage!.y + 1)
    await page.getByRole('button', { name: 'Beenden' }).click()
    await page.getByRole('button', { name: 'Fertig' }).click()
  }
})

test('it vibrates on each real phase change and not on the first frame', async ({ page }) => {
  await spyOnDevice(page)
  await openAtmen(page)
  await page.getByRole('button', { name: '4-7-8 starten' }).click()
  await expect(page.getByText('Einatmen', { exact: true })).toBeVisible()
  await page.waitForTimeout(500)
  expect(await vibrations(page)).toEqual([])
  await expect(page.getByText('Halten', { exact: true })).toBeVisible({ timeout: 6000 })
  await expect.poll(() => vibrations(page)).toEqual([HOLD])

  // Pause und Weiter sind kein Phasenwechsel.
  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.waitForTimeout(500)
  expect(await vibrations(page)).toEqual([HOLD])

  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByRole('heading', { name: 'Gut gemacht.' })).toBeVisible()
  expect(await vibrations(page)).toEqual([HOLD])
})

test('it does not vibrate when vibration is switched off in the settings', async ({ page }) => {
  await spyOnDevice(page)
  await page.addInitScript(() => {
    if (!localStorage.getItem('ruhe.v1')) {
      localStorage.setItem('ruhe.v1', JSON.stringify({ version: 1, sessions: [], settings: { vibration: false } }))
    }
  })
  await openAtmen(page)
  await page.getByRole('button', { name: '4-7-8 starten' }).click()
  await expect(page.getByText('Halten', { exact: true })).toBeVisible({ timeout: 6000 })
  await page.waitForTimeout(500)
  expect(await vibrations(page)).toEqual([])
})

test('without vibration and wake lock in the browser the exercise still runs', async ({ page }) => {
  const errors: Error[] = []
  page.on('pageerror', (error) => errors.push(error))
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined })
  })
  await openAtmen(page)
  await page.getByRole('button', { name: '4-7-8 starten' }).click()
  await expect(page.getByText('Einatmen', { exact: true })).toBeVisible()
  await expect(page.getByText('Halten', { exact: true })).toBeVisible({ timeout: 6000 })
  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByRole('heading', { name: 'Gut gemacht.' })).toBeVisible()
  expect(errors).toEqual([])
})

test('the screen stays on during the exercise, comes back after the page was hidden and is released at the end', async ({ page }) => {
  await spyOnDevice(page)
  await openAtmen(page)
  expect(await locks(page)).toEqual([])
  await page.getByRole('button', { name: '4-7-8 starten' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect.poll(() => locks(page)).toEqual([false])

  // Der Browser gibt die Sperre beim Verbergen der Seite frei; beim Zurückkehren wird neu angefordert.
  await page.evaluate(() => {
    ;(window as unknown as Spy).__locks[0].released = true
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => locks(page)).toEqual([true, false])

  // Pause hält die Übung an, nicht die Sperre; erst das Ende gibt sie frei.
  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('button', { name: 'Weiter' }).click()
  expect(await locks(page)).toEqual([true, false])
  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByRole('heading', { name: 'Gut gemacht.' })).toBeVisible()
  await expect.poll(() => locks(page)).toEqual([true, true])
})

test('a full one-minute exercise is counted, vibrates once per phase change in its pattern and frees the screen', async ({ page }) => {
  test.setTimeout(120_000)
  await spyOnDevice(page)
  await openAtmen(page)
  await page.getByRole('radio', { name: '1 Min' }).click()
  // 19-s-Zyklus: Der vierte Zyklus wird zu Ende geführt, 76 s mit je drei Phasen.
  await page.getByRole('button', { name: '4-7-8 starten' }).click()
  await expect(page.getByRole('timer')).toHaveText(/^[1-4]$/)

  await expect(page.getByText('1 Min geatmet')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('heading', { name: 'Gut gemacht.' })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)
  expect(await vibrations(page)).toEqual([HOLD, OUT, IN, HOLD, OUT, IN, HOLD, OUT, IN, HOLD, OUT])
  expect(await locks(page)).toEqual([true])
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect.poll(() => depth(page)).toBe(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atmen')

  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
  expect(data.sessions).toHaveLength(1)
  expect(data.sessions[0]).toMatchObject({ kind: 'breath', ref: '478', seconds: 76 })
  expect(data.lastUsed).toEqual({ kind: 'breath', pattern: '478', minutes: 1 })
})

test('a double tap on a start button does not reach the player that opens over it', async ({ page }) => {
  await openAtmen(page)
  const done = page.getByRole('heading', { name: 'Gut gemacht.' })

  // An seinem Platz liegt „4-7-8 starten“ über der Atem-Blüte des Players.
  await doubleTap(page, page.getByRole('button', { name: '4-7-8 starten' }), 0.25)
  await expectStillRunning(page)
  await page.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect(done).toHaveCount(0)
})

test('a double tap on a tile that was scrolled over "Pause" does not reach the player', async ({ page }) => {
  // Auf einem niedrigeren Bildschirm lässt sich eine Kachel bis knapp über die Reiterleiste schieben.
  await page.setViewportSize({ width: 412, height: 640 })
  await openAtmen(page)

  // Weiter gescrollt endet eine Kachel knapp über der Reiterleiste, also dort, wo der Player „Pause“ hat.
  // Getippt wird im unteren Rand der Kachel (12 px über ihrer Unterkante), im ersten Viertel ihrer Breite.
  const start = page.getByRole('button', { name: 'Kohärentes Atmen starten' })
  await start.click({ trial: true }) // wartet, bis die Kachel ruhig steht (Einblenden des Bildschirms)
  const nav = (await page.getByRole('navigation', { name: 'Hauptnavigation' }).boundingBox())!
  const box = (await start.boundingBox())!
  await page.evaluate((dy) => window.scrollBy(0, dy), box.y + box.height - (nav.y - 4))
  const tapped = await doubleTap(page, start, 0.25, (box.height - 12) / box.height)
  await expectStillRunning(page)
  await expect(page.getByRole('heading', { name: 'Atmen · Kohärentes Atmen' })).toBeVisible()

  // Die Stelle lag wirklich auf „Pause“: Sonst bewiese der Test nichts.
  const pause = (await page.getByRole('button', { name: 'Pause', exact: true }).boundingBox())!
  expect(tapped.x).toBeGreaterThanOrEqual(pause.x)
  expect(tapped.x).toBeLessThanOrEqual(pause.x + pause.width)
  expect(tapped.y).toBeGreaterThanOrEqual(pause.y)
  expect(tapped.y).toBeLessThanOrEqual(pause.y + pause.height)
})
