import { test, expect } from '@playwright/test'

test('switch sounds, sleep timer and mini player', async ({ page }) => {
  await page.goto('./')
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Klänge' }).click()
  const tiles = page.locator('button[aria-pressed]')
  await expect(tiles).toHaveText(['Regen', 'Meeresrauschen', 'Wind', 'Braunes Rauschen', 'Wald mit Vögeln', 'Kaminfeuer', 'Bach', 'Klangschalen'])

  await page.getByRole('button', { name: 'Regen' }).click()
  await expect(page.getByRole('button', { name: 'Regen' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('slider', { name: 'Lautstärke Regen' })).toBeVisible()
  await expect(page.getByText('Läuft endlos')).toBeVisible()

  await page.getByRole('radio', { name: '15 Min' }).click()
  await expect(page.getByText(/^Noch 1[45]:\d\d$/)).toBeVisible()

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()
  await page.getByRole('button', { name: 'Weiter' }).click()

  // Antippen wechselt: Es läuft immer nur ein Klang, der Sleep-Timer läuft weiter.
  await page.getByRole('button', { name: 'Wald mit Vögeln' }).click()
  await expect(page.getByRole('button', { name: 'Wald mit Vögeln' })).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 })
  await expect(page.getByRole('button', { name: 'Regen' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(1)
  await expect(page.getByRole('slider')).toHaveCount(1)
  await expect(page.getByRole('slider', { name: 'Lautstärke Wald mit Vögeln' })).toBeVisible()
  await expect(page.getByText(/^Noch 1[45]:\d\d$/)).toBeVisible()

  await nav.getByRole('button', { name: 'Heute' }).click()
  const mini = page.getByRole('region', { name: 'Wiedergabe' })
  const miniTitle = mini.getByRole('button', { name: 'Wald mit Vögeln', exact: true })
  await expect(miniTitle).toBeVisible()
  await expect(mini).not.toContainText('Regen')
  await mini.getByRole('button', { name: 'Pause' }).click()
  await expect(mini.getByRole('button', { name: 'Weiter' })).toBeVisible()

  await miniTitle.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
  await page.getByRole('button', { name: 'Stoppen', exact: true }).click()
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(0)
  await nav.getByRole('button', { name: 'Heute' }).click()
  await expect(page.getByRole('region', { name: 'Wiedergabe' })).toHaveCount(0)
})

test('status text does not claim "Läuft endlos" while paused', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Klänge' }).click()
  await page.getByRole('button', { name: 'Regen' }).click()
  await expect(page.getByText('Läuft endlos')).toBeVisible()

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()
  await expect(page.getByText('Läuft endlos')).toHaveCount(0)

  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.getByText('Läuft endlos')).toBeVisible()

  await page.getByRole('button', { name: 'Stoppen', exact: true }).click()
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(0)
})
