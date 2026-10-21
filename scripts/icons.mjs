// Rendert die PNG-Icons der PWA aus public/icons/icon.svg (Chromium über Playwright):
//  - icon-192.png, icon-512.png: volles Motiv, randlos
//  - maskable-512.png: Motiv auf 80 % verkleinert und mittig auf vollflächigem #0B1026,
//    damit es in der Sicherheitszone (innere 80 %) jeder Android-Maske liegt; die Ränder
//    des verkleinerten Motivs laufen weich in den Hintergrund aus, sodass kein Rahmen bleibt
//
// Aufruf: npm run icons (braucht den Chromium von Playwright).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ICON_DIR = fileURLToPath(new URL('../public/icons/', import.meta.url))
// Die Größe steuert das umgebende Element, nicht width/height am Wurzelelement der Quelldatei.
const svg = readFileSync(`${ICON_DIR}icon.svg`, 'utf8').replace(/<svg[^>]*>/, (tag) =>
  tag.replace(/\s(?:width|height)="[^"]*"/g, ''),
)

const page = (size, scale, feather) => `<!doctype html>
<html><head><style>
  html, body { margin: 0; width: ${size}px; height: ${size}px; background: #0B1026; overflow: hidden; }
  body { display: grid; place-items: center; }
  svg { display: block; width: ${scale * 100}%; height: ${scale * 100}%; }
  ${feather ? 'svg { mask-image: radial-gradient(circle closest-side, #000 75%, transparent 100%); }' : ''}
</style></head><body>${svg}</body></html>`

const targets = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'maskable-512.png', size: 512, scale: 0.8, feather: true },
]

const browser = await chromium.launch()
try {
  for (const { file, size, scale, feather } of targets) {
    const tab = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    await tab.setContent(page(size, scale, feather))
    await tab.screenshot({ path: `${ICON_DIR}${file}`, type: 'png' })
    await tab.close()
    console.log(`${file} (${size}x${size})`)
  }
} finally {
  await browser.close()
}
