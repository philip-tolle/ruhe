import { test, expect } from '@playwright/test'

// Der Browser läuft in Berlin, die Uhr steht fest; so hängt kein Test von der Zeitzone des Rechners ab.
test.use({ timezoneId: 'Europe/Berlin' })

test.describe('prepaint', () => {
  // Alle App-Skripte werden abgebrochen: Bleibt die Stimmung trotzdem gesetzt, kam sie aus dem
  // Inline-Skript in index.html und nicht aus der App.
  test.beforeEach(async ({ page }) => {
    await page.route('**/assets/*.js', (route) => route.abort())
  })

  test('prepaint: the mood is set before the app script runs', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-22T08:00:00+02:00'))
    await page.goto('./')
    await expect(page.locator('html')).toHaveAttribute('data-tageszeit', 'morgen')
    // Die App selbst ist nicht gestartet.
    await expect(page.locator('#app')).toBeEmpty()
  })

  test('prepaint: the evening is the default late in the day', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-22T20:00:00+02:00'))
    await page.goto('./')
    await expect(page.locator('html')).toHaveAttribute('data-tageszeit', 'abend')
    await expect(page.locator('#app')).toBeEmpty()
  })
})
