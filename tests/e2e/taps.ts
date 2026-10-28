import { expect, type Locator, type Page } from '@playwright/test'

// Ein Doppeltipp auf einen Start-Knopf: Der zweite Tipp kommt 150 ms später an derselben Stelle
// an. Dann liegt dort schon der Player; `xFraction` wählt, wohin im Knopf getippt wird (links
// sitzt im Player „Pause“, rechts „Beenden“), `yFraction` (Standard: Mitte) die Höhe darin. Gibt die
// getippte Stelle zurück.
export async function doubleTap(page: Page, target: Locator, xFraction: number, yFraction = 0.5) {
  await target.click({ trial: true }) // wartet, bis der Knopf ruhig steht (Einblenden des Sheets)
  const box = (await target.boundingBox())!
  const x = box.x + box.width * xFraction
  const y = box.y + box.height * yFraction
  await page.touchscreen.tap(x, y)
  await page.waitForTimeout(150)
  await page.touchscreen.tap(x, y)
  await page.waitForTimeout(500) // was der zweite Tipp ausgelöst hätte, wäre jetzt zu sehen
  return { x, y }
}

// Der Player läuft: „Pause“ steht da, kein Abschluss, die Engine spielt.
export async function expectStillRunning(page: Page) {
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Weiter' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Fertig' })).toHaveCount(0)
  expect(await page.evaluate(() => navigator.mediaSession.playbackState)).toBe('playing')
}

// Stellt die Höhe des Bildschirms so ein, dass `button` (fest am Bildschirm, etwa mittig in einem Dialog) senkrecht auf der Höhe
// von `under` liegt, einem Knopf der Seite darunter. Schließt der erste Tipp auf `button` den Dialog, trifft der zweite eines
// Doppeltipps an derselben Stelle `under`. Die Höhe folgt der Lage von `button` bei zwei Höhen (mittig wandert er mit der
// halben, unten mit der ganzen Änderung der Höhe). Gibt den Bruchteil der Breite von `button` zurück, an dem die Mitte
// von `under` liegt: der Wert für `doubleTap`. Prüft zuletzt, dass sich die beiden wirklich überdecken.
export async function putOver(page: Page, button: Locator, under: Locator): Promise<number> {
  const centerY = async (target: Locator) => {
    const box = (await target.boundingBox())!
    return box.y + box.height / 2
  }
  const { width, height } = page.viewportSize()!
  const before = await centerY(button)
  await page.setViewportSize({ width, height: height - 100 })
  const smaller = await centerY(button)
  const slope = (before - smaller) / 100 // 0,5 mittig, 1 unten
  expect(slope, 'der Knopf ist fest am Bildschirm').toBeGreaterThan(0)
  const wanted = Math.round(height - 100 + ((await centerY(under)) - smaller) / slope)
  await page.setViewportSize({ width, height: wanted })

  const [b, u] = [(await button.boundingBox())!, (await under.boundingBox())!]
  const [x, y] = [u.x + u.width / 2, u.y + u.height / 2]
  expect(x, 'Mitte des unteren Knopfs liegt waagrecht im oberen').toBeGreaterThanOrEqual(b.x)
  expect(x).toBeLessThanOrEqual(b.x + b.width)
  expect(y, 'Mitte des unteren Knopfs liegt senkrecht im oberen').toBeGreaterThanOrEqual(b.y)
  expect(y).toBeLessThanOrEqual(b.y + b.height)
  return (x - b.x) / b.width
}
