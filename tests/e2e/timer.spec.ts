import { test, expect, type Page } from '@playwright/test'
import { doubleTap, expectStillRunning } from './taps'

const NO_BOWL = 'Die Klangschale konnte nicht geladen werden – der Timer läuft ohne sie.'

// Tiefe der obersten Ebene im aktuellen History-Eintrag (0 = keine Ebene offen).
const depth = (page: Page) => page.evaluate(() => (history.state as { ruheLayer?: number } | null)?.ruheLayer ?? 0)

async function openMeditieren(page: Page) {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Meditieren' }).click()
}

test('set up, run, pause, confirm back, end', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Meditieren' }).click()
  await expect(page.getByText('10 Min · ohne Zwischenschale')).toBeVisible()
  await page.getByRole('button', { name: 'Timer einstellen' }).click()
  await page.getByRole('radio', { name: '5 Min', exact: true }).click()
  await page.getByRole('radio', { name: 'Alle 2 Min' }).click()
  await page.getByLabel('Hintergrundklang').selectOption({ label: 'Regen' })
  await page.getByRole('button', { name: 'Starten' }).click()
  await expect(page.getByText('Ankommen', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.goBack()
  await expect(page.getByRole('alertdialog', { name: 'Meditation beenden?' })).toBeVisible()
  await page.getByRole('button', { name: 'Weiter meditieren' }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByText('Unter einer Minute – das zählt noch nicht für die Statistik.')).toBeVisible()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect(page.getByText('5 Min · Klangschale alle 2 Min · Regen')).toBeVisible()
  await page.getByRole('button', { name: 'Timer einstellen' }).click()
  await expect(page.getByRole('radio', { name: '5 Min', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('radio', { name: 'Alle 2 Min' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('Hintergrundklang')).toHaveValue('regen')
  await expect(page.getByRole('switch', { name: '10 Sekunden ankommen' })).toHaveAttribute('aria-checked', 'true')
})

test('back closes the sheet, asks before ending and never leaves extra history entries', async ({ page }) => {
  await openMeditieren(page)
  const sheet = page.getByRole('dialog', { name: 'Meditations-Timer' })
  const confirm = page.getByRole('alertdialog', { name: 'Meditation beenden?' })
  const thanks = page.getByRole('heading', { name: 'Schön, dass du dir die Zeit genommen hast.' })

  // Zurück schließt das Sheet, der Reiter bleibt.
  await page.getByRole('button', { name: 'Timer einstellen' }).click()
  await expect(sheet).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)
  await page.goBack()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Meditieren')
  await expect.poll(() => depth(page)).toBe(0)

  // Beim Start ersetzt der Player das Sheet: genau eine Ebene, App darunter unerreichbar.
  await page.getByRole('button', { name: 'Timer einstellen' }).click()
  await page.getByRole('button', { name: 'Starten' }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Meditation · 10 Min' })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)
  await expect(page.locator('[inert] main')).toHaveCount(1)
  await expect(page.locator('[inert] nav')).toHaveCount(1)

  // Zurück fragt nach; Zurück im Dialog heißt „Weiter meditieren“.
  await page.goBack()
  await expect(confirm).toBeVisible()
  await expect.poll(() => depth(page)).toBe(2)
  await page.goBack()
  await expect(confirm).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)

  // „Beenden“ im Dialog führt zum Abschluss, ohne zweiten Dialog und ohne zusätzlichen Eintrag.
  await page.goBack()
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Beenden' }).click()
  await expect(thanks).toBeVisible()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(1)

  // Zurück im Abschluss schließt den Player; man ist wieder im Reiter, von dem man kam.
  await page.goBack()
  await expect(thanks).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Meditieren')
  await expect.poll(() => depth(page)).toBe(0)
  await expect(page.locator('[inert]')).toHaveCount(0)
})

test('a full one-minute timer is counted', async ({ page }) => {
  test.setTimeout(120_000)
  await openMeditieren(page)
  await page.getByRole('button', { name: 'Timer einstellen' }).click()
  await page.getByRole('radio', { name: 'Frei' }).click()
  await page.getByLabel('Minuten', { exact: true }).fill('1')
  const lead = page.getByRole('switch', { name: '10 Sekunden ankommen' })
  await lead.click()
  await expect(lead).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: 'Starten' }).click()
  await expect(page.getByRole('timer')).toHaveText(/^(1:00|0:[0-5]\d)$/)

  // Läuft die Zeit ab, während die Rückfrage offen ist, schließt sie sich und der Abschluss erscheint.
  await page.goBack()
  await expect(page.getByRole('alertdialog', { name: 'Meditation beenden?' })).toBeVisible()
  await expect(page.getByText('1 Min meditiert')).toBeVisible({ timeout: 75_000 })
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect.poll(() => depth(page)).toBe(1)
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect.poll(() => depth(page)).toBe(0)
  await expect(page.getByText('1 Min · ohne Zwischenschale')).toBeVisible()

  // Die Sitzung steht unter „Ich“ …
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Ich' }).click()
  const sessions = page.locator('dl > div').filter({ has: page.getByText('Sitzungen', { exact: true }) }).locator('dd')
  await expect(sessions).toHaveText('1')

  // … und so im Speicher.
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))
  expect(data.sessions).toHaveLength(1)
  expect(data.sessions[0]).toMatchObject({ kind: 'timer', ref: 'timer', seconds: 60 })
  expect(data.settings).toMatchObject({ timer: { minutes: 1, intervalMin: null }, timerSound: null, timerLead: false })
  expect(data.lastUsed).toEqual({ kind: 'timer', minutes: 1, intervalMin: null, sound: null, lead: false })
})

test('pause freezes the display and stops the animation loop', async ({ page }) => {
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
  await openMeditieren(page)
  await page.getByRole('button', { name: 'Timer einstellen' }).click()
  const lead = page.getByRole('switch', { name: '10 Sekunden ankommen' })
  await lead.click()
  await expect(lead).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: 'Starten' }).click()
  const countdown = page.getByRole('timer')
  await expect(countdown).toBeVisible()
  const first = await frames()
  await expect.poll(frames).toBeGreaterThan(first + 5) // läuft Bild für Bild
  await expect(page.getByText(NO_BOWL)).toHaveCount(0) // die Klangschale ist geladen

  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()
  await page.waitForTimeout(400) // die Audio-Uhr hält an, die Schleife beruhigt sich
  const paused = { frames: await frames(), remaining: await countdown.innerText() }
  // Der Sekundentakt der Engine ersetzt den Stand auch in der Pause; er darf die Schleife nicht wecken.
  await page.waitForTimeout(2500)
  expect(await frames()).toBe(paused.frames)
  expect(await countdown.innerText()).toBe(paused.remaining)

  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect.poll(frames).toBeGreaterThan(paused.frames + 5)
})

test('a double tap on „Starten“ does not reach the player that opens under it', async ({ page }) => {
  await openMeditieren(page)
  // Unter „Starten“ liegen dann links „Pause“, rechts „Beenden“.
  for (const side of [0.25, 0.75]) {
    await page.getByRole('button', { name: 'Timer einstellen' }).click()
    await doubleTap(page, page.getByRole('button', { name: 'Starten' }), side)
    await expectStillRunning(page)
    await page.getByRole('button', { name: 'Beenden' }).click()
    await page.getByRole('button', { name: 'Fertig' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Meditieren')
  }
})

test.describe('when the bowl does not load', () => {
  // Ohne Service Worker: Sonst beantwortete er den Abruf aus seinem Speicher, an der Route vorbei.
  test.use({ serviceWorkers: 'block' })

  test('the player says so and the timer runs without it', async ({ page }) => {
    await page.route('**/audio/sounds/klangschale.ogg', (route) => route.abort())
    await openMeditieren(page)
    await page.getByRole('button', { name: 'Timer einstellen' }).click()
    await page.getByRole('button', { name: 'Starten' }).click()
    await expect(page.getByText(NO_BOWL)).toBeVisible()
    await expect(page.getByText('Ankommen', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    expect(await page.evaluate(() => navigator.mediaSession.playbackState)).toBe('playing')
  })
})

test('the background select groups music, lofi and nature and a music piece runs under the timer', async ({ page }) => {
  await openMeditieren(page)
  await page.getByRole('button', { name: 'Timer einstellen' }).click()
  const sound = page.getByLabel('Hintergrundklang')
  const groups = await sound.locator('optgroup').evaluateAll((list) => list.map((group) => (group as HTMLOptGroupElement).label))
  expect(groups).toEqual(['Musik', 'Lofi', 'Natur'])
  await expect(sound.locator('option').first()).toHaveText('Keiner')
  await expect(sound.locator('optgroup[label="Musik"] option')).toHaveText(['Schwebende Flächen', 'Stilles Klavier', 'Obertöne', 'Bambusflöte', 'Zwischen zwei Atemzügen', 'Salz und Sternenlicht', 'Unter der Oberfläche'])
  await expect(sound.locator('optgroup[label="Lofi"] option')).toHaveText(['Kaffee & Notizen', 'Regenfenster', 'Abendlicht', 'Alte Kassette'])
  await expect(sound.locator('optgroup[label="Natur"] option')).toHaveCount(8)

  await sound.selectOption({ label: 'Stilles Klavier' })
  await page.getByRole('button', { name: 'Starten' }).click()
  await expect(page.getByText('Ankommen', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect(page.getByText('10 Min · ohne Zwischenschale · Stilles Klavier')).toBeVisible()

  await page.reload()
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Meditieren' }).click()
  await expect(page.getByText('10 Min · ohne Zwischenschale · Stilles Klavier')).toBeVisible()
})
