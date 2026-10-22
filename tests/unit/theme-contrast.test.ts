import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import type { Tageszeit } from '../../src/lib/time/tageszeit'

// Liest die Farbwerte der drei Stimmungen direkt aus src/app.css und prüft den Kontrast nach WCAG 2.x.
const css = readFileSync('src/app.css', 'utf8')

/** Inhalt des `{ … }`-Blocks, dessen öffnende Klammer ab `from` zuerst kommt (verschachtelte Blöcke zählen mit). */
function blockFrom(source: string, from: number): string {
  const open = source.indexOf('{', from)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i)
  }
  throw new Error('Block nicht geschlossen')
}

/** Block zu einem Selektor am Zeilenanfang (so trifft `:root {` nicht die eingerückten Blöcke in `@media`). */
function blockOf(selector: RegExp): string {
  const at = css.search(selector)
  if (at < 0) throw new Error(`Selektor nicht gefunden: ${selector}`)
  return blockFrom(css, at)
}

const MOODS: Record<Tageszeit, RegExp> = {
  abend: /^:root\s*\{/m,
  morgen: /^:root\[data-tageszeit='morgen'\]\s*\{/m,
  tag: /^:root\[data-tageszeit='tag'\]\s*\{/m,
}

const COLOR_TOKENS = [
  'sky-top',
  'sky-mid',
  'sky-bottom',
  'sky-horizon',
  'accent',
  'on-accent',
  'text',
  'text-muted',
  'hill-far',
  'hill-near',
] as const

type Rgb = [number, number, number]

const hex = (block: string, token: string): Rgb => {
  const m = block.match(new RegExp(`^\\s*--${token}:\\s*#([0-9a-f]{6})\\s*;`, 'mi'))
  if (!m) throw new Error(`--${token} fehlt oder ist kein #RRGGBB`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

type Overlay = { rgb: Rgb; alpha: number }

/** `rgb(238 240 250 / 0.1)` → Farbe und Deckkraft. */
const rgbAlpha = (value: string): Overlay => {
  const m = value.match(/rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)/)
  if (!m) throw new Error(`Kein rgb(r g b / a): ${value}`)
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: Number(m[4]) }
}

const overlayToken = (block: string, token: string): Overlay => {
  const m = block.match(new RegExp(`^\\s*--${token}:\\s*(rgb\\([^)]*\\))\\s*;`, 'm'))
  if (!m) throw new Error(`--${token} fehlt oder ist kein rgb(r g b / a)`)
  return rgbAlpha(m[1])
}

/** Alle Verlaufsstufen im Hintergrund von `.card` (die stärkste Aufhellung ist der ungünstigste Fall). */
const cardOverlays = (): Overlay[] => {
  const card = blockOf(/^\.card\s*\{/m)
  const background = card.match(/^\s*background:\s*linear-gradient\(([^;]*)\);/m)
  if (!background) throw new Error('.card hat keinen linear-gradient-Hintergrund')
  return [...background[1].matchAll(/rgb\([^)]*\)/g)].map((m) => rgbAlpha(m[0]))
}

const channel = (c: number) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const over = (top: Overlay, bottom: Rgb): Rgb =>
  [0, 1, 2].map((i) => Math.round(top.rgb[i] * top.alpha + bottom[i] * (1 - top.alpha))) as Rgb

describe('Kontrast je Stimmung (WCAG AA, 4,5:1)', () => {
  // Fläche der Karte: `--surface` (aus :root, gilt für alle Stimmungen) und die Verlaufsstufen von `.card`.
  const overlays = () => [overlayToken(blockOf(MOODS.abend), 'surface'), ...cardOverlays()]

  for (const mood of Object.keys(MOODS) as Tageszeit[]) {
    describe(mood, () => {
      test.each(['text', 'text-muted'] as const)('--%s auf der Karte über --sky-mid und --sky-bottom', (token) => {
        const block = blockOf(MOODS[mood])
        for (const sky of ['sky-mid', 'sky-bottom'] as const) {
          for (const overlay of overlays()) {
            const card = over(overlay, hex(block, sky))
            const ratio = contrast(hex(block, token), card)
            expect(ratio, `${mood}: --${token} auf Karte über --${sky} (Deckkraft ${overlay.alpha})`).toBeGreaterThanOrEqual(4.5)
          }
        }
      })

      test('--on-accent auf --accent', () => {
        const block = blockOf(MOODS[mood])
        expect(contrast(hex(block, 'on-accent'), hex(block, 'accent'))).toBeGreaterThanOrEqual(4.5)
      })
    })
  }
})

describe('Farbwerte der drei Stimmungen', () => {
  test.each(Object.keys(MOODS) as Tageszeit[])('%s setzt alle Farben als #RRGGBB und die Stern-Deckkraft', (mood) => {
    const block = blockOf(MOODS[mood])
    for (const token of COLOR_TOKENS) expect(() => hex(block, token), `${mood} --${token}`).not.toThrow()
    const stars = block.match(/^\s*--star-opacity:\s*([\d.]+)\s*;/m)
    expect(stars, `${mood} --star-opacity`).not.toBeNull()
    expect(Number(stars![1])).toBeGreaterThanOrEqual(0)
    expect(Number(stars![1])).toBeLessThanOrEqual(1)
  })

  test('der Abend behält die bisherigen Werte (außer dem gedämpften Text, siehe unten)', () => {
    const block = blockOf(MOODS.abend)
    expect(block).toMatch(/--sky-top:\s*#0b1026;/i)
    expect(block).toMatch(/--sky-mid:\s*#1b2350;/i)
    expect(block).toMatch(/--sky-bottom:\s*#3a2f5b;/i)
    expect(block).toMatch(/--sky-horizon:\s*#3a2f5b;/i)
    expect(block).toMatch(/--accent:\s*#f2c98a;/i)
    expect(block).toMatch(/--on-accent:\s*#0b1026;/i)
    expect(block).toMatch(/--text:\s*#eef0fa;/i)
    // Bisher #a9afcb: Auf der stärksten Kartenaufhellung (0,1) über --sky-bottom nur 4,21:1. Eine Spur heller
    // (#b3b8d2) erreicht 4,66:1; sichtbar ändert sich dadurch fast nichts.
    expect(block).toMatch(/--text-muted:\s*#b3b8d2;/i)
    expect(block).toMatch(/--star-opacity:\s*1\s*;/)
    expect(block).toMatch(/--surface:\s*rgb\(238 240 250 \/ 0\.07\);/)
    expect(block).toMatch(/--surface-border:\s*rgb\(238 240 250 \/ 0\.12\);/)
  })

  test('--gold ist in allen Stimmungen das Gold der Zierlinien', () => {
    expect(blockOf(MOODS.abend)).toMatch(/--gold:\s*#f2c98a;/i)
    // Die Stimmungsblöcke überschreiben es nicht.
    expect(blockOf(MOODS.morgen)).not.toMatch(/--gold:/)
    expect(blockOf(MOODS.tag)).not.toMatch(/--gold:/)
  })
})

describe('Übergang zwischen den Stimmungen', () => {
  test.each(COLOR_TOKENS)('--%s ist als <color> registriert (erbt, mit Anfangswert)', (token) => {
    const m = css.match(new RegExp(`@property --${token}\\s*\\{([^}]*)\\}`))
    expect(m, `@property --${token}`).not.toBeNull()
    expect(m![1]).toMatch(/syntax:\s*'<color>'/)
    expect(m![1]).toMatch(/inherits:\s*true/)
    expect(m![1]).toMatch(/initial-value:\s*#[0-9a-f]{6}/i)
  })

  test('--star-opacity ist als <number> registriert', () => {
    const m = css.match(/@property --star-opacity\s*\{([^}]*)\}/)
    expect(m, '@property --star-opacity').not.toBeNull()
    expect(m![1]).toMatch(/syntax:\s*'<number>'/)
    expect(m![1]).toMatch(/inherits:\s*true/)
    expect(m![1]).toMatch(/initial-value:\s*1\b/)
  })

  test('die 1,5 s langen Übergänge stehen nur unter prefers-reduced-motion: no-preference', () => {
    const media = blockOf(/^@media \(prefers-reduced-motion: no-preference\)\s*\{/m)
    const root = media.match(/:root\s*\{([^}]*)\}/)
    expect(root, ':root im Medienblock').not.toBeNull()
    for (const token of [...COLOR_TOKENS, 'star-opacity']) {
      expect(root![1], `Übergang für --${token}`).toMatch(new RegExp(`--${token}\\s+1\\.5s\\s+ease`))
    }
    // Außerhalb des Medienblocks gibt es keinen Übergang auf den Variablen.
    expect(css.replace(media, '')).not.toMatch(/transition:[^;]*--sky-/)
  })
})

describe('Kartenstil', () => {
  test('Karten sind weich: Rundung 28 px und Unschärfe 14 px dahinter', () => {
    const card = blockOf(/^\.card\s*\{/m)
    expect(card).toMatch(/border-radius:\s*28px;/)
    expect(card).toMatch(/(?<!-webkit-)backdrop-filter:\s*blur\(14px\);/)
    expect(card).toMatch(/-webkit-backdrop-filter:\s*blur\(14px\);/)
  })
})
