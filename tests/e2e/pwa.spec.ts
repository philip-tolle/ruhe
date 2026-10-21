import { test, expect } from '@playwright/test'

test('manifest matches spec', async ({ page, request }) => {
  await page.goto('./')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const m = await (await request.get(new URL(href!, page.url()).href)).json()
  expect(m).toMatchObject({ name: 'Ruhe', short_name: 'Ruhe', display: 'standalone', orientation: 'portrait',
    lang: 'de', start_url: '/ruhe/', scope: '/ruhe/', theme_color: '#0B1026', background_color: '#0B1026' })
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512', '512x512'])
  expect(m.icons[2].purpose).toBe('maskable')
  for (const i of m.icons) {
    const r = await request.get(new URL(i.src, page.url()).href)
    expect(r.status()).toBe(200); expect(r.headers()['content-type']).toContain('image/png')
  }
})

test('works offline after first visit', async ({ page, context }) => {
  await page.goto('./')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Guten (Morgen|Tag|Abend)$/)
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Klänge' }).click()
  await page.getByRole('button', { name: 'Kaminfeuer' }).click()
  await expect(page.getByRole('button', { name: 'Kaminfeuer' })).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 })
  await page.getByRole('button', { name: 'Regen' }).click()
  await expect(page.getByRole('button', { name: 'Regen' })).toHaveAttribute('aria-pressed', 'true')
})
