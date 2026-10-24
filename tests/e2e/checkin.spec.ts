import { test, expect, type Page } from '@playwright/test'
import { doubleTap } from './taps'

// Ruhe-Check-in auf dem Abschluss (Spec M6 §3). Eine Sitzung zählt erst ab 60 s; die Box-Atmung
// mit „1 Min“ läuft vier 16-s-Zyklen, also 64 s, und endet von selbst.
const WORDS = ['sehr unruhig', 'etwas unruhig', 'teils, teils', 'ruhig', 'ganz ruhig']
// Die schmalste Telefonbreite, für die die App gebaut ist (Spec M6 §3).
test.use({ viewport: { width: 360, height: 780 } })

async function openAtmen(page: Page) {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Atmen' }).click()
}

const calm = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ruhe.v1') ?? 'null')?.sessions?.[0]?.calm)
const row = (page: Page, name: 'Vorher' | 'Jetzt') => page.getByRole('radiogroup', { name })
const dot = (page: Page, name: 'Vorher' | 'Jetzt', word: string) => row(page, name).getByRole('radio', { name: word, exact: true })
const checked = (page: Page, name: 'Vorher' | 'Jetzt') => row(page, name).locator('[role="radio"][aria-checked="true"]')
// Was im Abschluss über den rechten Rand des Bildschirms ragt (der Player schneidet es sonst nur ab).
const overflowing = (page: Page) =>
  page.locator('.done').evaluate((done) => [...done.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).length)

test('after a counted session the calm can be noted before and now, changed and taken back', async ({ page }) => {
  test.setTimeout(120_000)
  await openAtmen(page)
  await page.getByRole('radio', { name: '1 Min' }).click()
  await page.getByRole('button', { name: 'Box-Atmung starten' }).click()
  await expect(page.getByText('1 Min geatmet')).toBeVisible({ timeout: 90_000 })

  // Die Karte: Frage, zwei Reihen mit je fünf Stufen, nichts gewählt, große Tippflächen, Hinweis unter „Fertig“.
  await expect(page.getByText('Magst du festhalten, wie ruhig du bist?')).toBeVisible()
  for (const name of ['Vorher', 'Jetzt'] as const) {
    await expect(row(page, name).getByRole('radio')).toHaveCount(5)
    for (const [i, radio] of (await row(page, name).getByRole('radio').all()).entries()) {
      await expect(radio).toHaveAccessibleName(WORDS[i])
      await expect(radio).toHaveAttribute('aria-checked', 'false')
      const box = (await radio.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(48)
      expect(box.height).toBeGreaterThanOrEqual(48)
    }
  }
  await expect(page.getByText('Ohne Antwort einfach „Fertig“.')).toBeVisible()

  // Antippen speichert sofort; ein anderer Punkt ändert, derselbe nimmt zurück.
  await dot(page, 'Vorher', 'etwas unruhig').click()
  await expect(dot(page, 'Vorher', 'etwas unruhig')).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => calm(page)).toEqual({ before: 2 })
  await expect(page.locator('.calm-row').first()).toContainText('etwas unruhig')
  await dot(page, 'Jetzt', 'ruhig').click()
  await expect.poll(() => calm(page)).toEqual({ before: 2, after: 4 })
  await dot(page, 'Jetzt', 'ganz ruhig').click()
  await expect.poll(() => calm(page)).toEqual({ before: 2, after: 5 })
  await dot(page, 'Jetzt', 'ganz ruhig').click()
  await expect.poll(() => calm(page)).toEqual({ before: 2 })
  await expect(checked(page, 'Jetzt')).toHaveCount(0)

  // Tastatur: Pfeile bewegen die Wahl samt Fokus, die Leertaste nimmt sie zurück.
  await dot(page, 'Vorher', 'etwas unruhig').focus()
  await page.keyboard.press('ArrowRight')
  await expect(dot(page, 'Vorher', 'teils, teils')).toHaveAttribute('aria-checked', 'true')
  await expect(dot(page, 'Vorher', 'teils, teils')).toBeFocused()
  await expect.poll(() => calm(page)).toEqual({ before: 3 })
  await page.keyboard.press('Space')
  await expect(checked(page, 'Vorher')).toHaveCount(0)
  await expect.poll(() => calm(page)).toBeUndefined()
  await dot(page, 'Vorher', 'etwas unruhig').click()
  await dot(page, 'Jetzt', 'ruhig').click()
  await expect.poll(() => calm(page)).toEqual({ before: 2, after: 4 })

  // Platz: nichts ragt über den Rand, auch bei 130 % Schrift; „Fertig“ bleibt erreichbar.
  expect(page.viewportSize()!.width).toBe(360)
  expect(await overflowing(page)).toBe(0)
  await page.evaluate(() => (document.documentElement.style.fontSize = '130%'))
  expect(await overflowing(page)).toBe(0)
  await page.getByRole('button', { name: 'Fertig' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('button', { name: 'Fertig' })).toBeInViewport()
  await page.evaluate(() => (document.documentElement.style.fontSize = ''))

  // Speichern scheitert: Der Punkt bleibt gewählt, „Ich“ zeigt den bekannten Hinweis, gespeichert bleibt der Stand davor.
  await page.evaluate(() => {
    const w = window as unknown as { __setItem: Storage['setItem'] }
    w.__setItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new DOMException('voll', 'QuotaExceededError')
    }
  })
  await dot(page, 'Jetzt', 'ganz ruhig').click()
  await expect(dot(page, 'Jetzt', 'ganz ruhig')).toHaveAttribute('aria-checked', 'true')
  await page.evaluate(() => {
    Storage.prototype.setItem = (window as unknown as { __setItem: Storage['setItem'] }).__setItem
  })
  // Die Zurück-Geste schließt den Abschluss wie bisher; das Angetippte ist schon festgehalten.
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atmen')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Ich' }).click()
  await expect(page.getByRole('alert')).toContainText('Speichern ist gerade nicht möglich')
  expect(await calm(page)).toEqual({ before: 2, after: 4 })

  await page.reload()
  expect(await calm(page)).toEqual({ before: 2, after: 4 })
})

test('a session under a minute shows no check-in', async ({ page }) => {
  await openAtmen(page)
  await page.getByRole('button', { name: 'Box-Atmung starten' }).click()
  await expect(page.getByRole('heading', { name: 'Atmen · Box-Atmung' })).toBeVisible()
  await page.getByRole('button', { name: 'Beenden' }).click()
  await expect(page.getByText('Unter einer Minute – das zählt noch nicht für die Statistik.')).toBeVisible()
  await expect(row(page, 'Vorher')).toHaveCount(0)
  await expect(page.getByText('Ohne Antwort einfach „Fertig“.')).toHaveCount(0)
})

// Auf niedrigen Bildschirmen liegt „Fertig“ (etwa 720 px hoch) oder ein Punkt von „Jetzt“ (etwa 640 px)
// genau dort, wo eben „Beenden“ war; der zweite Tipp eines Doppeltipps darf dort nichts auslösen.
for (const { height, x, y, lands } of [
  { height: 720, x: 0.5, y: 0.5, lands: '„Fertig“' },
  { height: 640, x: 0.32, y: 0.08, lands: 'a dot of „Jetzt“' },
]) {
  test.describe(`on a screen ${height} px high`, () => {
    test.use({ viewport: { width: 360, height } })

    test(`a double tap on „Beenden“ after a minute does nothing on ${lands}`, async ({ page }) => {
      test.setTimeout(120_000)
      await openAtmen(page)
      await page.getByRole('radio', { name: '1 Min' }).click()
      // 4-7-8 läuft 76 s; nach gut einer Minute zählt die Sitzung schon, ist aber noch nicht zu Ende.
      await page.getByRole('button', { name: '4-7-8 starten' }).click()
      await expect(page.getByRole('heading', { name: 'Atmen · 4-7-8' })).toBeVisible()
      await page.waitForTimeout(63_000)
      await doubleTap(page, page.getByRole('button', { name: 'Beenden' }), x, y)
      await expect(page.getByText('1 Min geatmet')).toBeVisible()
      await expect(page.getByText('Magst du festhalten, wie ruhig du bist?')).toBeVisible()
      await expect(checked(page, 'Vorher')).toHaveCount(0)
      await expect(checked(page, 'Jetzt')).toHaveCount(0)
      expect(await calm(page)).toBeUndefined()
    })
  })
}
