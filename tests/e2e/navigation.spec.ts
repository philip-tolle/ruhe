import { test, expect } from '@playwright/test'
test('tab bar navigates between all five screens', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 21, 8, 0))
  await page.goto('./')
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await expect(nav.getByRole('button')).toHaveText(['Heute', 'Meditieren', 'Atmen', 'Klänge', 'Ich'])
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guten Morgen')
  await expect(nav.getByRole('button', { name: 'Heute' })).toHaveAttribute('aria-current', 'page')
  // Reiter, die noch nicht fertig sind, zeigen einen Platzhaltertext; Atmen und Ich haben Inhalt.
  const placeholders: [string, string | null][] = [
    ['Meditieren', 'Kommen mit dem nächsten Update.'],
    ['Atmen', null],
    ['Ich', null],
  ]
  for (const [label, placeholder] of placeholders) {
    await nav.getByRole('button', { name: label }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label)
    if (placeholder) await expect(page.getByText(placeholder)).toBeVisible()
  }
  await expect(page.getByRole('heading', { level: 2, name: 'Backup' })).toBeVisible() // Ich
  await nav.getByRole('button', { name: 'Atmen' }).click()
  await expect(page.getByRole('radiogroup', { name: 'Dauer' })).toBeVisible()
  await nav.getByRole('button', { name: 'Klänge' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
  await nav.getByRole('button', { name: 'Heute' }).click()
  await page.getByRole('button', { name: 'Zu den Klängen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klänge')
})
