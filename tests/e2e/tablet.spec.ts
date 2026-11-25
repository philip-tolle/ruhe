import { test, expect, type Locator, type Page } from '@playwright/test'

// Tablet (Haupt-Spec, Nachtrag „Tablet“): Ab 600 px Breite füllt die Inhaltsspalte den Bildschirm, bis 880 px, mit 32 px Rand.
// Blätter, die Wiedergabeleisten und die Reiterleiste gehen mit; Abläufe und Player bleiben so schmal wie auf dem Handy.
// Geprüft bei 800 px Breite, so breit wie ein 10-Zoll-Tablet im Hochformat. Auf dem Handy ändert sich nichts.
test.use({ timezoneId: 'Europe/Berlin' })

// Der 28. Oktober 2026 liegt in der Winterzeit (MEZ, +01:00).
const at = (time: string) => new Date(`2026-10-28T${time}+01:00`)

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' })
const checkInSheet = (page: Page) => page.getByRole('dialog', { name: 'Wie voll ist dein Akku?' })

/** Linker und rechter Rand des Kastens von `target` in CSS-Pixeln. */
async function edges(target: Locator) {
  const box = (await target.boundingBox())!
  return { left: Math.round(box.x), right: Math.round(box.x + box.width) }
}

const paddingLeft = (target: Locator) => target.evaluate((el) => getComputedStyle(el).paddingLeft)

test.describe('tablet at 800px', () => {
  test.use({ viewport: { width: 800, height: 1280 } })

  test('the column fills the width and the cards keep a 32px margin', async ({ page }) => {
    await page.clock.setFixedTime(at('14:00'))
    await page.goto('./')
    expect(await edges(page.locator('main'))).toEqual({ left: 0, right: 800 })
    expect(await paddingLeft(page.locator('main'))).toBe('32px')
    expect(await edges(page.locator('main .card').first())).toEqual({ left: 32, right: 768 })
  })

  test('the tab bar spreads its six tabs over the whole width', async ({ page }) => {
    await page.goto('./')
    const tabs = nav(page).getByRole('button')
    await expect(tabs).toHaveCount(6)
    expect((await edges(tabs.first())).left).toBe(8)
    expect((await edges(tabs.last())).right).toBe(792)
  })

  test('a sheet is as wide as the screen and its content lines up with the cards', async ({ page }) => {
    await page.clock.setFixedTime(at('14:00'))
    await page.goto('./')
    await page.getByRole('button', { name: 'Check-in', exact: true }).click()
    await expect(checkInSheet(page)).toBeVisible()
    expect(await edges(checkInSheet(page))).toEqual({ left: 0, right: 800 })
    expect(await paddingLeft(checkInSheet(page))).toBe('32px')
  })

  // Neben dem Blatt ist kein Platz mehr; darüber bleibt die Abdunklung, ein Tipp dort schließt es wie auf dem Handy.
  test('a tap above the full-width sheet closes it', async ({ page }) => {
    await page.clock.setFixedTime(at('14:00'))
    await page.goto('./')
    await page.getByRole('button', { name: 'Check-in', exact: true }).click()
    await expect(checkInSheet(page)).toBeVisible()
    await page.waitForTimeout(600) // Danebentippen ist kurz nach dem Öffnen gesperrt (400 ms)
    expect((await checkInSheet(page).boundingBox())!.y).toBeGreaterThan(100)
    await page.touchscreen.tap(400, 40)
    await expect(checkInSheet(page)).toHaveCount(0)
  })

  test('the playback bars under "Klänge" and on the other tabs line up with the cards', async ({ page }) => {
    await page.goto('./')
    await nav(page).getByRole('button', { name: 'Klänge' }).click()
    await page.getByRole('button', { name: 'Regen', exact: true }).click()
    const dock = page.locator('.dock .bar')
    await expect(dock).toBeVisible()
    expect(await edges(dock)).toEqual({ left: 32, right: 768 })

    await nav(page).getByRole('button', { name: 'Heute' }).click()
    const mini = page.getByRole('region', { name: 'Wiedergabe' }).locator('.bar')
    await expect(mini).toBeVisible()
    expect(await edges(mini)).toEqual({ left: 32, right: 768 })
  })

  test('the morning flow stays as narrow as on the phone, centered', async ({ page }) => {
    await page.clock.setFixedTime(at('07:00'))
    await page.goto('./')
    await page.getByRole('button', { name: 'Kurz · 5 Min', exact: true }).click()
    const flow = page.getByRole('dialog', { name: 'Morgen-Start', exact: true })
    await expect(flow).toBeVisible()
    expect(await edges(flow.locator('.host'))).toEqual({ left: 160, right: 640 })
    expect(await edges(flow.locator('.top .bar'))).toEqual({ left: 176, right: 624 })
    expect(await paddingLeft(flow.locator('.step .content').first())).toBe('16px')
  })

  // Die Waschung füllt die Ecke neben dem Motiv; in der breiten Kachel bleibt sie so klein wie im Kalender, statt
  // dreifach vergrößert über die Kachel zu laufen.
  test('the breathing tiles keep a small watercolor wash in their corner', async ({ page }) => {
    await page.goto('./')
    await nav(page).getByRole('button', { name: 'Atmen' }).click()
    const wash = page.locator('main .tile .waschung').first()
    await expect(wash).toBeVisible()
    expect((await wash.boundingBox())!.width).toBeLessThanOrEqual(120)
  })

  // Sonne und Mond stehen in Höhe der Begrüßung, auch auf einem hohen Bildschirm, wo 6 % der Höhe tiefer reichen: Die
  // Karten laufen jetzt bis unter sie.
  test('the sun and the moon stay above the first card on a tall screen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }) // Karten ohne Einblenden, der Mond ohne Schweben
    await page.setViewportSize({ width: 800, height: 1333 })
    for (const [time, body] of [['14:00', '.sun-tag'], ['21:00', '.moon']] as const) {
      await page.clock.setFixedTime(at(time))
      await page.goto('./')
      await nav(page).getByRole('button', { name: 'Meditieren' }).click()
      const disc = (await page.locator(body).boundingBox())!
      const card = (await page.locator('main .card').first().boundingBox())!
      expect(disc.y + disc.height, `${body} über der ersten Karte`).toBeLessThanOrEqual(card.y)
    }
  })
})

test.describe('wider than the column at 1200px', () => {
  test.use({ viewport: { width: 1200, height: 1280 } })

  test('the playback bars stay as wide as the cards', async ({ page }) => {
    await page.goto('./')
    await nav(page).getByRole('button', { name: 'Klänge' }).click()
    await page.getByRole('button', { name: 'Regen', exact: true }).click()
    const dock = page.locator('.dock .bar')
    await expect(dock).toBeVisible()
    expect(await edges(dock)).toEqual({ left: 192, right: 1008 })

    await nav(page).getByRole('button', { name: 'Heute' }).click()
    const mini = page.getByRole('region', { name: 'Wiedergabe' }).locator('.bar')
    await expect(mini).toBeVisible()
    expect(await edges(mini)).toEqual(await edges(page.locator('main .card').first()))
  })
})

test.describe('phone at 412px', () => {
  test.use({ viewport: { width: 412, height: 839 } })

  test('the column and the sheets keep their 16px margin', async ({ page }) => {
    await page.clock.setFixedTime(at('14:00'))
    await page.goto('./')
    expect(await paddingLeft(page.locator('main'))).toBe('16px')
    expect(await edges(page.locator('main .card').first())).toEqual({ left: 16, right: 396 })
    expect((await edges(nav(page).getByRole('button').first())).left).toBe(8)
    await page.getByRole('button', { name: 'Check-in', exact: true }).click()
    await expect(checkInSheet(page)).toBeVisible()
    expect(await edges(checkInSheet(page))).toEqual({ left: 0, right: 412 })
    expect(await paddingLeft(checkInSheet(page))).toBe('16px')
  })
})
