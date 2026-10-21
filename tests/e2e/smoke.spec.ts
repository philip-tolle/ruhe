import { test, expect } from '@playwright/test'

test('app starts with title Ruhe', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveTitle('Ruhe')
})
