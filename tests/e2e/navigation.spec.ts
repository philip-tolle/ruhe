import { test, expect } from '@playwright/test'
test('tab bar navigates between all five screens', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 21, 8, 0))
  await page.goto('./')
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await expect(nav.getByRole('button')).toHaveText(['Heute', 'Meditieren', 'Atmen', 'Klänge', 'Ich'])
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guten Morgen')
  await expect(nav.getByRole('button', { name: 'Heute' })).toHaveAttribute('aria-current', 'page')
  const placeholders = [
    ['Meditieren', 'Kommen mit dem nächsten Update.'],
    ['Atmen', 'Kommt mit dem nächsten Update.'],
    ['Ich', 'Kommt mit dem nächsten Update.'],
  ]
  for (const [label, placeholder] of placeholders) {
    await nav.getByRole('button', { name: label }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label)
    await expect(page.getByText(placeholder)).toBeVisible()
  }
  await nav.getByRole('button', { name: 'Klänge' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
  await nav.getByRole('button', { name: 'Heute' }).click()
  await page.getByRole('button', { name: 'Zu den Klängen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
})
