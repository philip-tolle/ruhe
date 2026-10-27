import { test, expect } from '@playwright/test'
test('tab bar navigates between all six screens', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 21, 8, 0))
  await page.goto('./')
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await expect(nav.getByRole('button')).toHaveText(['Heute', 'Energie', 'Meditieren', 'Atmen', 'Klänge', 'Ich'])
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guten Morgen')
  await expect(nav.getByRole('button', { name: 'Heute' })).toHaveAttribute('aria-current', 'page')
  for (const label of ['Energie', 'Meditieren', 'Atmen', 'Ich']) {
    await nav.getByRole('button', { name: label }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label)
    if (label === 'Energie') await expect(page.getByRole('heading', { level: 2, name: 'Dein Akku' })).toBeVisible()
    if (label === 'Meditieren') await expect(page.getByRole('region', { name: 'Geführte Meditationen' })).toBeVisible()
  }
  await expect(page.getByRole('heading', { level: 2, name: 'Backup' })).toBeVisible() // Ich
  await nav.getByRole('button', { name: 'Atmen' }).click()
  await expect(page.getByRole('radiogroup', { name: 'Dauer' })).toBeVisible()
  await nav.getByRole('button', { name: 'Klänge' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
  await nav.getByRole('button', { name: 'Heute' }).click()
  // Auf „Heute“ führt die Zeile „Klänge“ der Aktivitäten dorthin (die Reiterleiste hat denselben Namen).
  await page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Aktivitäten' }) }).getByRole('button', { name: /^Klänge/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
})
