// Farben und Kontrast, gerechnet aus berechneten Farben des Browsers (`getComputedStyle`): rgb(), rgba() und
// color(srgb …), je mit optionaler Deckkraft. Kanäle 0 … 255, Deckkraft 0 … 1.
export type Rgba = [number, number, number, number]

export function parseColor(css: string): Rgba {
  const m = css.match(/^(rgba?|color)\(\s*(?:srgb\s+)?(.+?)\s*\)$/)
  if (!m) throw new Error(`Farbe nicht lesbar: ${css}`)
  const parts = m[2].split(/[\s,/]+/).filter(Boolean).map(Number)
  const scale = m[1] === 'color' ? 255 : 1
  return [parts[0] * scale, parts[1] * scale, parts[2] * scale, parts[3] ?? 1]
}

// Eine Farbe mit Deckkraft über einem Untergrund: das Ergebnis ist deckend.
export const over = ([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1]

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

// Kontrastverhältnis nach WCAG, ab 4,5 für normalen Text.
export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
