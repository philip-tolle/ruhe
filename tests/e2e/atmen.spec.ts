import { test, expect, type Page } from '@playwright/test'
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

test('the screen offers six exercises and four durations, 3 Min preselected', async ({ page }) => {
  await openAtmen(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atmen')
  const group = page.getByRole('radiogroup', { name: 'Dauer' })
  await expect(group.getByRole('radio')).toHaveText(['1 Min', '3 Min', '5 Min', '10 Min'])
  await expect(group.getByRole('radio', { name: '3 Min' })).toHaveAttribute('aria-checked', 'true')

  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    '4-7-8',
    'Box-Atmung',
    'Kohärentes Atmen',
    'Langes Ausatmen',
    'Physiologischer Seufzer',
    'Wechselatmung',
  ])
  await expect(page.getByText('Einatmen 4 s · Halten 7 s · Ausatmen 8 s')).toBeVisible()
  await expect(page.getByText('Einatmen 3 s · kurz Nachatmen 1 s · langsam Ausatmen 6 s')).toBeVisible()

  const starts = page.getByRole('button', { name: /starten$/ })
  await expect(starts).toHaveCount(6)
  await expect(starts).toHaveText(Array(6).fill('Starten'))
  await expect(page.getByRole('button', { name: 'Physiologischer Seufzer starten' })).toBeVisible()
  for (const target of [...(await starts.all()), ...(await group.getByRole('radio').all())]) {
    const box = await target.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(48)
    expect(box!.width).toBeGreaterThanOrEqual(48)
  }
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

  // Weiter gescrollt liegt eine Karte knapp über der Reiterleiste, also dort, wo der Player „Pause“ hat.
  const start = page.getByRole('button', { name: 'Kohärentes Atmen starten' })
  const nav = (await page.getByRole('navigation', { name: 'Hauptnavigation' }).boundingBox())!
  const box = (await start.boundingBox())!
  await page.evaluate((dy) => window.scrollBy(0, dy), box.y + box.height / 2 - (nav.y - 20))
  await doubleTap(page, start, 0.25)
  await expectStillRunning(page)
  await expect(page.getByRole('heading', { name: 'Atmen · Kohärentes Atmen' })).toBeVisible()
})
