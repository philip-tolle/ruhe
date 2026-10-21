import { expect, type Locator, type Page } from '@playwright/test'

// Ein Doppeltipp auf einen Start-Knopf: Der zweite Tipp kommt 150 ms später an derselben Stelle
// an. Dann liegt dort schon der Player; `xFraction` wählt, wohin im Knopf getippt wird (links
// sitzt im Player „Pause“, rechts „Beenden“).
export async function doubleTap(page: Page, target: Locator, xFraction: number) {
  await target.click({ trial: true }) // wartet, bis der Knopf ruhig steht (Einblenden des Sheets)
  const box = (await target.boundingBox())!
  const x = box.x + box.width * xFraction
  const y = box.y + box.height / 2
  await page.touchscreen.tap(x, y)
  await page.waitForTimeout(150)
  await page.touchscreen.tap(x, y)
  await page.waitForTimeout(500) // was der zweite Tipp ausgelöst hätte, wäre jetzt zu sehen
}

// Der Player läuft: „Pause“ steht da, kein Abschluss, die Engine spielt.
export async function expectStillRunning(page: Page) {
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Weiter' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Fertig' })).toHaveCount(0)
  expect(await page.evaluate(() => navigator.mediaSession.playbackState)).toBe('playing')
}
