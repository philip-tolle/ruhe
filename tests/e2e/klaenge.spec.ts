import { test, expect } from '@playwright/test'

test('mix sounds, sleep timer and mini player', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Wald mit Vögeln' }).click()
  await expect(page.getByRole('button', { name: 'Wald mit Vögeln' })).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 })

  await nav.getByRole('button', { name: 'Heute' }).click()
  const mini = page.getByRole('region', { name: 'Wiedergabe' })
  await expect(mini).toContainText('Regen & Wald mit Vögeln')
  await mini.getByRole('button', { name: 'Pause' }).click()
  await expect(mini.getByRole('button', { name: 'Weiter' })).toBeVisible()

  await mini.getByText('Regen & Wald mit Vögeln').click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
  await page.getByRole('button', { name: 'Alle stoppen' }).click()
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(0)
  await nav.getByRole('button', { name: 'Heute' }).click()
  await expect(page.getByRole('region', { name: 'Wiedergabe' })).toHaveCount(0)
})
