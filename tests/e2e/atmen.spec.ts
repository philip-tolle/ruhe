import { test, expect, type Page } from '@playwright/test'
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

// Skalierung des Atemkreises (die Zahl vor der Matrix: matrix(s, 0, 0, s, 0, 0)); 1 ohne Transform.
const circleTransform = (page: Page) =>
  page.getByTestId('breath-circle').evaluate((el) => getComputedStyle(el).transform)
async function circleScale(page: Page) {
  const transform = await circleTransform(page)
  return transform === 'none' ? 1 : parseFloat(transform.slice('matrix('.length))
}

// Phasenfarbe des Kreises (eingetragene Farbe, also als rgb() berechnet).
const LAVENDER = 'rgb(183, 168, 240)' // Einatmen, #B7A8F0
const GOLD = 'rgb(242, 201, 138)' // Halten, #F2C98A
const TEAL = 'rgb(143, 208, 214)' // Ausatmen, #8FD0D6
const phaseColor = (page: Page) =>
  page.getByTestId('breath-circle').evaluate((el) => getComputedStyle(el).getPropertyValue('--phase-color').trim())

// Füllstand des Phasenrings, 0 … 1; zu Beginn einer Phase ist noch nichts gezeichnet.
const ringProgress = (page: Page) =>
  page.evaluate(() => {
    const arc = document.querySelector('[data-testid="phase-ring"]')
    if (!arc) return 0
    return 1 - Number(arc.getAttribute('stroke-dashoffset')) / Number(arc.getAttribute('stroke-dasharray'))
  })

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
    // Zwei je Zeile: gleiche Oberkante wie der Nachbar, alle gleich hoch, die nächste Zeile liegt darunter.
    expect(box.y).toBeCloseTo(boxes[i - (i % 2)].y, 0)
    expect(box.height).toBeCloseTo(first.height, 0)
    if (i >= 2) expect(box.y).toBeGreaterThan(boxes[i - 2].y + boxes[i - 2].height - 1)
  }
  // Die rechte Spalte beginnt rechts der linken.
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].width - 1)
})

test('each tile shows title, rhythm and effect, is named "… starten" and described as before', async ({ page }) => {
  await openAtmen(page)
  for (const t of TILES) {
    await expect(tile(page, t.title)).toHaveText(t.text, { useInnerText: true })
    await expect(tile(page, t.title)).toHaveAccessibleDescription(t.description)
  }
  // 4-7-8: Der Titel ist schon der Rhythmus und steht nur einmal da.
  await expect(tile(page, '4-7-8').getByText('4-7-8', { exact: true })).toHaveCount(1)
})

test('the motif sits at the top of its tile, at the start, above the title, and is decoration', async ({ page }) => {
  await openAtmen(page)
  for (const t of TILES) {
    const target = tile(page, t.title)
    await expectMotiv(target.locator('img'), t.motiv, 80)
    const place = await target.evaluate((el, title) => {
      const rect = (e: Element) => e.getBoundingClientRect()
      const heading = [...el.querySelectorAll('span')].find((s) => s.textContent === title)!
      const tileRect = rect(el)
      const motif = rect(el.querySelector('img')!)
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
  await tile(page, 'Langes Ausatmen').locator('img').click()
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
    for (const t of TILES) await expectMotiv(tile(page, t.title).locator('img'), t.motiv, 80)
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
      expect(box.height).toBeCloseTo(without[0].height, 0)
    }
    for (const t of TILES) {
      await expect(tile(page, t.title)).toHaveText(t.text, { useInnerText: true })
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
        for (const child of el.querySelectorAll('*')) {
          const r = child.getBoundingClientRect()
          if (r.left < outer.left - 0.5 || r.right > outer.right + 0.5 || r.top < outer.top - 0.5 || r.bottom > outer.bottom + 0.5) {
            problems.push(`${el.getAttribute('aria-label')}: ${child.tagName.toLowerCase()} "${child.textContent}" ragt heraus`)
          }
        }
        return problems
      }),
    )
    expect(overflow).toEqual([])
  }

  test('nothing overflows its tile or the page, at normal size and at 130 %', async ({ page }) => {
    await openAtmen(page)
    await expect(tiles(page)).toHaveCount(6)
    const normal = await tileBoxes(page)
    expect(normal[0].width).toBeCloseTo(normal[1].width, 0)
    await expectFits(page)

    await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
    await expectFits(page)
    // Die Kacheln sind weiter zwei je Zeile, gleich groß und innerhalb des Bildschirms.
    const large = await tileBoxes(page)
    for (const [i, box] of large.entries()) {
      expect(box.width).toBeCloseTo(large[0].width, 0)
      expect(box.height).toBeCloseTo(large[0].height, 0)
      expect(box.x + box.width).toBeLessThanOrEqual(360)
      expect(box.y).toBeCloseTo(large[i - (i % 2)].y, 0)
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

test('pause freezes countdown and circle and stops the animation loop', async ({ page }) => {
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
    transform: await circleTransform(page),
    ring: await ringProgress(page),
  }
  await page.waitForTimeout(1500)
  expect(await frames()).toBe(paused.frames)
  expect(await page.getByRole('timer').innerText()).toBe(paused.seconds)
  expect(await circleTransform(page)).toBe(paused.transform)
  expect(await ringProgress(page)).toBe(paused.ring)

  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect.poll(frames).toBeGreaterThan(paused.frames + 5)
})

test('the circle grows while breathing in, rests on hold and shrinks while breathing out, each phase in its colour', async ({ page }) => {
  test.setTimeout(45_000)
  await openAtmen(page)
  await page.getByRole('button', { name: 'Box-Atmung starten' }).click()
  const inhale = page.getByText('Einatmen', { exact: true })
  const hold = page.getByText('Halten', { exact: true })
  const exhale = page.getByText('Ausatmen', { exact: true })

  // Ausgeatmet ist der Kreis knapp halb so groß; er wächst sanft an.
  await expect(inhale).toBeVisible()
  const early = await circleScale(page)
  expect(early).toBeGreaterThanOrEqual(0.44)
  expect(early).toBeLessThan(0.75)
  await expect.poll(() => circleScale(page)).toBeGreaterThan(early + 0.1)
  await expect.poll(() => phaseColor(page)).toBe(LAVENDER)
  await expect.poll(() => ringProgress(page)).toBeGreaterThan(0.25)

  await expect(hold).toBeVisible({ timeout: 6000 })
  await expect.poll(() => circleScale(page)).toBeGreaterThan(0.97)
  await expect.poll(() => phaseColor(page)).toBe(GOLD)
  await page.waitForTimeout(1000)
  expect(await circleScale(page)).toBeCloseTo(1, 2)

  await expect(exhale).toBeVisible({ timeout: 6000 })
  const start = await circleScale(page)
  expect(start).toBeGreaterThan(0.85)
  await expect.poll(() => circleScale(page)).toBeLessThan(start - 0.1)
  await expect.poll(() => phaseColor(page)).toBe(TEAL)
})

test('under reduced motion the circle stays static while colour, ring, text and countdown still change', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openAtmen(page)
  await page.getByRole('button', { name: '4-7-8 starten' }).click()
  await expect(page.getByText('Einatmen', { exact: true })).toBeVisible()
  const still = await circleTransform(page)
  expect(await phaseColor(page)).toBe(LAVENDER)
  const ring = await ringProgress(page)
  await page.waitForTimeout(1500)
  expect(await circleTransform(page)).toBe(still)
  expect(await ringProgress(page)).toBeGreaterThan(ring + 0.2)
  await expect(page.getByText('Halten', { exact: true })).toBeVisible({ timeout: 6000 })
  // Ohne Übergang: Die Farbe wechselt mit dem Text, der Ring beginnt von vorn.
  expect(await phaseColor(page)).toBe(GOLD)
  expect(await ringProgress(page)).toBeLessThan(0.5)
  expect(await circleTransform(page)).toBe(still)
  await expect(page.getByRole('timer')).toHaveText(/^[5-7]$/)
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

  // An seinem Platz liegt „4-7-8 starten“ über dem Atemkreis des Players.
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
  // Getippt wird im unteren Rand der Kachel (12 px über ihrer Unterkante), ganz links davon.
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
