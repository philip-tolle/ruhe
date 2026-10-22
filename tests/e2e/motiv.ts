import { expect, type Locator } from '@playwright/test'

// Ein gemaltes Motiv ist Schmuck: leeres `alt`, feste Fläche in der erwarteten Größe, und die Datei
// ist wirklich geladen (kein kaputtes Bild hinter dem passenden `src`).
export async function expectMotiv(img: Locator, id: string, size: number) {
  await expect(img).toHaveAttribute('src', new RegExp(`/images/motive/${id}\\.webp$`))
  await expect(img).toHaveAttribute('alt', '')
  // Layout-Maße statt boundingBox(): Während das Einblenden des Bildschirms läuft (Verschiebung), meldet
  // boundingBox() Bruchteile eines Pixels mehr oder weniger.
  expect(await img.evaluate((el: HTMLImageElement) => [el.offsetWidth, el.offsetHeight])).toEqual([size, size])
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
}
