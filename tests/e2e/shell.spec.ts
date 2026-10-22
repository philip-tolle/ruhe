import { test, expect, type Page } from '@playwright/test'

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

// Das Glas der Karten verwischt den Himmel nur, wenn kein Vorfahre Wurzel des Hintergrunds ist. Hielte die
// Einblendung von `.screen` ihr Ende fest (`both`/`forwards`), bliebe `.screen` eine solche Wurzel: Die Karten
// verwischten dann nur den (leeren) Bildschirm hinter sich, der Himmel schiene scharf hindurch.
test('after its entrance the screen holds no animation, and the cards keep their blur', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')
  const screen = page.locator('.screen')
  const card = page.locator('.card').first()
  await expect(card).toBeVisible()
  // Die Einblendung gibt es wirklich (sonst prüfte der Test nichts) …
  expect(await screen.evaluate((el) => getComputedStyle(el).animationName)).toBe('screen-in')
  // … und nach ihrem Ende bleibt nichts von ihr in Kraft.
  await expect.poll(() => screen.evaluate((el) => el.getAnimations().length)).toBe(0)
  expect(await card.evaluate((el) => getComputedStyle(el).backdropFilter)).toContain('blur(')
})

type Rect = { x: number; y: number; width: number; height: number }

// Größter Helligkeitssprung (0 … 255) zwischen zwei waagerecht benachbarten Bildpunkten, je Ausschnitt: Eine scharfe
// Kante springt weit, eine verwischte Fläche kaum. Ein Bildschirmfoto des ganzen Fensters (CSS-Pixel; ein Foto nur
// eines Ausschnitts zeichnet Chrome ohne das Glas ringsum), im Browser über ein Canvas gelesen: kein PNG-Decoder nötig.
async function sharpness(page: Page, rects: Rect[]): Promise<number[]> {
  const png = await page.screenshot({ scale: 'css' })
  return page.evaluate(
    async ({ src, rects }) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      return rects.map((rect) => {
        const { data, width, height } = ctx.getImageData(Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height))
        const light = (i: number) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
        let max = 0
        for (let y = 0; y < height; y++) {
          for (let x = 0; x + 1 < width; x++) {
            const i = (y * width + x) * 4
            max = Math.max(max, Math.abs(light(i + 4) - light(i)))
          }
        }
        return max
      })
    },
    { src: `data:image/png;base64,${png.toString('base64')}`, rects },
  )
}

test('a sharp pattern in the sky shows sharp beside a card and blurred under it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')
  const screen = page.locator('.screen')
  await expect(page.locator('.card').first()).toBeVisible()
  // Die Einblendung lief (getAnimations() rechnet den Stil vorher aus, eine anstehende Einblendung zählt also mit) und ist vorbei.
  await expect.poll(() => screen.evaluate((el) => el.getAnimations().every((a) => a.playState === 'finished'))).toBe(true)

  // Eine leere Karte (echte Klasse `.card`, echter Platz in `.screen`) oben im Bildschirm: Gemessen wird in ihrer
  // Mitte, wo kein eigener Inhalt scharfe Kanten hat und kein Rand der Karte stört (nahe am Rand verwischt Chrome
  // weniger). Dahinter im Himmel schwarz-weiße Streifen (je 4 px) über die ganze Breite.
  const box = await screen.evaluate((el) => {
    const card = document.createElement('div')
    card.className = 'card'
    card.setAttribute('aria-hidden', 'true')
    card.style.height = '240px'
    el.prepend(card)
    const r = card.getBoundingClientRect()
    const stripes = document.createElement('div')
    stripes.style.cssText = `position: absolute; left: 0; right: 0; top: ${r.top}px; height: ${r.height}px; background: repeating-linear-gradient(90deg, #fff 0 4px, #000 4px 8px);`
    document.querySelector('.sky')!.appendChild(stripes)
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })

  // Neben der Karte (Seitenrand): scharf, die Streifen sind also wirklich da. Unter der Karte: verwischt.
  const [beside, under] = await sharpness(page, [
    { x: 1, y: box.y + 60, width: box.x - 3, height: 120 },
    { x: box.x + 40, y: box.y + 60, width: box.width - 80, height: 120 },
  ])
  expect(beside).toBeGreaterThan(100)
  expect(under).toBeLessThan(30)
})
