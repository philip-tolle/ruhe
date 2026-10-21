import { test, expect } from '@playwright/test'

test('tab bar buttons are at least 48px tall and wide, and none is a toggle', async ({ page }) => {
  await page.goto('./')
  const buttons = page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button')
  await expect(buttons).toHaveCount(5)
  for (const button of await buttons.all()) {
    const box = await button.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(48)
    expect(box!.width).toBeGreaterThanOrEqual(48)
  }
  await expect(page.locator('button[aria-pressed]')).toHaveCount(0)
})

test('animations run only without reduced-motion preference', async ({ page }) => {
  const running = () => page.evaluate(() => document.getAnimations().length)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')
  await expect.poll(running).toBeGreaterThan(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(running).toBe(0)
})
