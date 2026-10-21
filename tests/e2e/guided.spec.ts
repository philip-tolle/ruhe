import { test, expect, type Page } from '@playwright/test'

// Die Meditationen sind noch Platzhalter und werden später durch echte Aufnahmen ersetzt: Die Tests
// verlassen sich nie auf genaue Längen, nur auf Unterschiede (Spulen ≈ 15 s, ±2 s).

// Tiefe der obersten Ebene im aktuellen History-Eintrag (0 = keine Ebene offen).
const depth = (page: Page) => page.evaluate(() => (history.state as { ruheLayer?: number } | null)?.ruheLayer ?? 0)

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null'))

async function openMeditieren(page: Page) {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Meditieren' }).click()
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Ein Eintrag der Liste, gleich ob gespeichert oder nicht.
const entry = (page: Page, title: string) =>
  page.getByRole('button', { name: new RegExp(`^${escape(title)}, \\d+ Minuten?(, offline verfügbar)?$`) })

// Restzeit im Player in Sekunden (Anzeige m:ss).
async function remaining(page: Page): Promise<number> {
  const [minutes, seconds] = (await page.getByRole('timer').innerText()).split(':').map(Number)
  return minutes * 60 + seconds
}

// Wartet, bis die Restzeit höchstens `tolerance` Sekunden von `target` entfernt ist.
async function expectRemainingNear(page: Page, target: number, tolerance = 2) {
  await expect.poll(async () => Math.abs((await remaining(page)) - target)).toBeLessThanOrEqual(tolerance)
}

const GROUPS = {
  'Einsteiger & Achtsamkeit': ['Ankommen im Atem', 'Gedanken wie Wolken', 'Bodyscan im Sitzen'],
  'Stress & Ruhe': ['Drei-Minuten-Atempause', 'Nach einem vollen Tag', 'Vor einem wichtigen Termin'],
  'Fokus & Energie': ['Guten Morgen', 'Fokus vor der Arbeit', 'Energie in der Mittagspause'],
}

test('the guided meditations are listed by theme with their length', async ({ page }) => {
  await openMeditieren(page)
  const list = page.getByRole('region', { name: 'Geführte Meditationen' })
  await expect(list.getByRole('heading', { level: 2 })).toHaveText('Geführte Meditationen')
  await expect(list.getByRole('heading', { level: 3 })).toHaveText(Object.keys(GROUPS))
  await expect(list.getByRole('button')).toHaveCount(9)

  for (const [theme, titles] of Object.entries(GROUPS)) {
    const group = list.getByRole('region', { name: theme })
    const entries = group.getByRole('button')
    await expect(entries).toHaveCount(3)
    for (const [index, title] of titles.entries()) {
      await expect(entries.nth(index)).toHaveAccessibleName(new RegExp(`^${escape(title)}, \\d+ Minuten?$`))
      await expect(entries.nth(index)).toContainText(title)
      await expect(entries.nth(index)).toContainText(/\d+ Min/)
      // Noch Platzhalter: als Vorabversion gekennzeichnet, nicht offline gespeichert.
      await expect(entries.nth(index)).toContainText('Vorabversion')
      await expect(entries.nth(index)).not.toContainText('✓ offline')
      await expect(entries.nth(index)).toBeEnabled()
    }
  }

  for (const target of await list.getByRole('button').all()) {
    const box = await target.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(48)
  }
})

test('start, seek, pause, ask before ending and end with the done screen', async ({ page }) => {
  await openMeditieren(page)
  await entry(page, 'Drei-Minuten-Atempause').click()

  const player = page.getByRole('dialog', { name: 'Geführte Meditation' })
  await expect(player.getByRole('heading', { name: 'Drei-Minuten-Atempause' })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)
  await expect(page.locator('[inert] main')).toHaveCount(1)
  await expect(page.locator('[inert] nav')).toHaveCount(1)
  expect((await stored(page)).lastUsed).toEqual({ kind: 'guided', id: 'drei-minuten-atempause' })

  // Spulen geht, sobald die Länge der Datei bekannt ist.
  const forward = player.getByRole('button', { name: '15 Sekunden vor' })
  const back = player.getByRole('button', { name: '15 Sekunden zurück' })
  await expect(forward).toBeEnabled()
  await expect(back).toBeEnabled()

  // Die Restzeit läuft …
  const first = await remaining(page)
  await expect.poll(() => remaining(page)).toBeLessThan(first)

  // … und springt beim Vorspulen um 15 s (die Wiedergabe läuft dabei weiter).
  const beforeForward = await remaining(page)
  await forward.click()
  await expect.poll(() => remaining(page)).toBeLessThanOrEqual(beforeForward - 13)
  expect(await remaining(page)).toBeGreaterThanOrEqual(beforeForward - 18)

  // Pause hält die Anzeige an; Zurückspulen wirkt auch dann.
  await player.getByRole('button', { name: 'Pause' }).click()
  await expect(player.getByRole('button', { name: 'Weiter' })).toBeVisible()
  await page.waitForTimeout(300)
  const paused = await remaining(page)
  await page.waitForTimeout(1500)
  expect(await remaining(page)).toBe(paused)
  await back.click()
  await expectRemainingNear(page, paused + 15)
  await forward.click()
  await expectRemainingNear(page, paused)

  await player.getByRole('button', { name: 'Weiter' }).click()
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible()
  const resumed = await remaining(page)
  await expect.poll(() => remaining(page)).toBeLessThan(resumed)

  // Zurück fragt nach; „Weiter meditieren“ lässt sie laufen.
  const confirm = page.getByRole('alertdialog', { name: 'Meditation beenden?' })
  await page.goBack()
  await expect(confirm).toBeVisible()
  await expect.poll(() => depth(page)).toBe(2)
  await confirm.getByRole('button', { name: 'Weiter meditieren' }).click()
  await expect(confirm).toHaveCount(0)
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)

  // „Beenden“ führt zum Abschluss wie beim Timer; unter einer Minute zählt nichts.
  await player.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByRole('heading', { name: 'Schön, dass du dir die Zeit genommen hast.' })).toBeVisible()
  await expect(page.getByText('Unter einer Minute – das zählt noch nicht für die Statistik.')).toBeVisible()
  await expect.poll(() => depth(page)).toBe(1)
  expect((await stored(page)).sessions).toEqual([])

  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Meditieren')
  await expect.poll(() => depth(page)).toBe(0)
  await expect(page.locator('[inert]')).toHaveCount(0)
})

test('the background sound and the balance act at once and are remembered', async ({ page }) => {
  await openMeditieren(page)
  await entry(page, 'Guten Morgen').click()

  const player = page.getByRole('dialog', { name: 'Geführte Meditation' })
  const sound = player.getByRole('combobox', { name: 'Hintergrundklang' })
  const balance = player.getByRole('slider', { name: 'Balance Stimme ↔ Hintergrund' })
  await expect(sound).toBeVisible()
  // Ohne Hintergrund gibt es nichts abzuwägen.
  await expect(balance).toHaveCount(0)

  await sound.selectOption({ label: 'Regen' })
  await expect.poll(async () => (await stored(page)).settings.guidedSound).toBe('regen')
  await expect(balance).toBeVisible()
  await expect(balance).toHaveValue('50')

  await balance.fill('20')
  await expect.poll(async () => (await stored(page)).settings.voiceBalance).toBe(0.2)
  // Der Timer behält seinen eigenen Hintergrund.
  expect((await stored(page)).settings.timerSound).toBeNull()

  await sound.selectOption({ label: 'Keiner' })
  await expect.poll(async () => (await stored(page)).settings.guidedSound).toBeNull()
  await expect(balance).toHaveCount(0)
  await sound.selectOption({ label: 'Wald mit Vögeln' })
  await expect.poll(async () => (await stored(page)).settings.guidedSound).toBe('wald')

  // Die nächste Meditation beginnt mit der gemerkten Wahl.
  await player.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()
  await entry(page, 'Ankommen im Atem').click()
  await expect(player.getByRole('heading', { name: 'Ankommen im Atem' })).toBeVisible()
  await expect(sound).toHaveValue('wald')
  await expect(balance).toHaveValue('20')
})

test.describe('when the file does not load', () => {
  // Ohne Service Worker: Sonst beantwortete er den Abruf an der Route vorbei.
  test.use({ serviceWorkers: 'block' })

  test('load error shows retry', async ({ page }) => {
    await page.route('**/audio/meditations/**', (route) => route.fulfill({ status: 404, body: 'nicht da' }))
    await openMeditieren(page)
    await entry(page, 'Guten Morgen').click()

    const player = page.getByRole('dialog', { name: 'Geführte Meditation' })
    await expect(player.getByText('Die Meditation konnte nicht geladen werden.')).toBeVisible()
    const retry = player.getByRole('button', { name: 'Erneut versuchen' })
    await expect(retry).toBeVisible()
    await expect(player.getByRole('timer')).toHaveCount(0)
    await expect(player.getByRole('button', { name: '15 Sekunden vor' })).toBeDisabled()

    // Ist die Datei wieder erreichbar, geht es weiter.
    await page.unroute('**/audio/meditations/**')
    await retry.click()
    await expect(player.getByRole('timer')).toBeVisible()
    await expect(player.getByText('Die Meditation konnte nicht geladen werden.')).toHaveCount(0)
    await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible()
    await expect(player.getByRole('button', { name: '15 Sekunden vor' })).toBeEnabled()
  })
})

test('a played meditation is saved; offline only saved ones can start', async ({ page, context }) => {
  await openMeditieren(page)

  // Beim ersten Abspielen wird die Datei im Hintergrund gespeichert.
  await entry(page, 'Drei-Minuten-Atempause').click()
  await page.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('button', { name: 'Fertig' }).click()
  const saved = page.getByRole('button', { name: /^Drei-Minuten-Atempause, \d+ Minuten, offline verfügbar$/ })
  await expect(saved).toBeVisible()
  await expect(saved).toContainText('✓ offline')

  // Der Status kommt aus dem Cache, auch nach dem Neuladen.
  await page.reload()
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Meditieren' }).click()
  await expect(saved).toBeVisible()
  await expect(entry(page, 'Guten Morgen')).not.toContainText('✓ offline')

  await context.setOffline(true)
  const hints = page.getByText('Nicht offline verfügbar', { exact: true })
  await expect(hints).toHaveCount(8)
  await expect(entry(page, 'Guten Morgen')).toBeDisabled()
  await expect(entry(page, 'Guten Morgen')).toContainText('Nicht offline verfügbar')
  await expect(saved).toBeEnabled()
  await expect(saved).not.toContainText('Nicht offline verfügbar')

  await context.setOffline(false)
  await expect(hints).toHaveCount(0)
  await expect(entry(page, 'Guten Morgen')).toBeEnabled()
})

test.describe('on a small phone', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  test('every control of the player is at least 48 px and nothing scrolls sideways', async ({ page }) => {
    await openMeditieren(page)
    await entry(page, 'Energie in der Mittagspause').click()
    const player = page.getByRole('dialog', { name: 'Geführte Meditation' })
    await player.getByRole('combobox', { name: 'Hintergrundklang' }).selectOption({ label: 'Braunes Rauschen' })

    const targets = [
      player.getByRole('button', { name: '15 Sekunden zurück' }),
      player.getByRole('button', { name: '15 Sekunden vor' }),
      player.getByRole('button', { name: 'Pause' }),
      player.getByRole('button', { name: 'Beenden' }),
      player.getByRole('combobox', { name: 'Hintergrundklang' }),
      player.getByRole('slider', { name: 'Balance Stimme ↔ Hintergrund' }),
    ]
    for (const target of targets) {
      await expect(target).toBeVisible()
      const box = (await target.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(48)
      expect(box.width).toBeGreaterThanOrEqual(48)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(360)
    }
    expect(await player.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  })
})
