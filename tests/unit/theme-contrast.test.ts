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
  'accent',
  'on-accent',
  'text',
  'text-muted',
  'hill-far',
  'hill-far-bottom',
  'hill-near',
  'lake-top',
  'lake-bottom',
  'glint',
] as const

/** Farben mit Deckkraft, als `rgb(r g b / a)` (Schein über dem Horizont). */
const GLOW_TOKENS = ['horizon-glow'] as const

/** Alle mit `@property` registrierten Variablen. */
const REGISTERED = [...css.matchAll(/@property (--[\w-]+)/g)].map((m) => m[1])

/** Hinter Karten liegen beim Scrollen auch Berge und See (der Himmel steht fest, die Karten wandern darüber). */
const BACKDROPS = ['sky-mid', 'sky-bottom', 'hill-far', 'hill-far-bottom', 'hill-near', 'lake-top', 'lake-bottom'] as const

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
      test.each(['text', 'text-muted'] as const)('--%s auf der Karte über Himmel, Bergen und See', (token) => {
        const block = blockOf(MOODS[mood])
        for (const backdrop of BACKDROPS) {
          for (const overlay of overlays()) {
            const card = over(overlay, hex(block, backdrop))
            const ratio = contrast(hex(block, token), card)
            expect(ratio, `${mood}: --${token} auf Karte über --${backdrop} (Deckkraft ${overlay.alpha})`).toBeGreaterThanOrEqual(4.5)
          }
        }
      })

      // Der Akzent ist auch Schrift: Serie auf „Heute“, aktive Klangkachel, „… Min meditiert“ im Abschluss.
      test('--accent als Schrift auf der Karte über Himmel, Bergen und See', () => {
        const block = blockOf(MOODS[mood])
        for (const backdrop of BACKDROPS) {
          for (const overlay of overlays()) {
            const ratio = contrast(hex(block, 'accent'), over(overlay, hex(block, backdrop)))
            expect(ratio, `${mood}: --accent auf Karte über --${backdrop} (Deckkraft ${overlay.alpha})`).toBeGreaterThanOrEqual(4.5)
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
    for (const token of GLOW_TOKENS) expect(() => overlayToken(block, token), `${mood} --${token}`).not.toThrow()
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
    expect(block).toMatch(/--accent:\s*#f2c98a;/i)
    expect(block).toMatch(/--on-accent:\s*#0b1026;/i)
    expect(block).toMatch(/--text:\s*#eef0fa;/i)
    // Bisher #a9afcb: Auf der stärksten Kartenaufhellung (0,1) über --sky-bottom nur 4,21:1. Eine Spur heller
    // (#b3b8d2) erreicht 4,66:1; sichtbar ändert sich dadurch fast nichts.
    expect(block).toMatch(/--text-muted:\s*#b3b8d2;/i)
    expect(block).toMatch(/--star-opacity:\s*1\s*;/)
    // Berge, See, Glanz und Schein wie bisher fest in Sky.svelte eingetragen
    expect(block).toMatch(/--hill-far:\s*#3a3163;/i)
    expect(block).toMatch(/--hill-far-bottom:\s*#2a2552;/i)
    expect(block).toMatch(/--hill-near:\s*#171a3d;/i)
    expect(block).toMatch(/--lake-top:\s*#2d2757;/i)
    expect(block).toMatch(/--lake-bottom:\s*#0d1129;/i)
    expect(block).toMatch(/--glint:\s*#f2c98a;/i)
    expect(block).toMatch(/--horizon-glow:\s*rgb\(242 201 138 \/ 0\.16\);/)
    expect(block).toMatch(/--surface:\s*rgb\(238 240 250 \/ 0\.07\);/)
    expect(block).toMatch(/--surface-border:\s*rgb\(238 240 250 \/ 0\.12\);/)
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

  test.each(GLOW_TOKENS)('--%s ist als <color> registriert (erbt, Anfangswert mit Deckkraft)', (token) => {
    const m = css.match(new RegExp(`@property --${token}\\s*\\{([^}]*)\\}`))
    expect(m, `@property --${token}`).not.toBeNull()
    expect(m![1]).toMatch(/syntax:\s*'<color>'/)
    expect(m![1]).toMatch(/inherits:\s*true/)
    expect(m![1]).toMatch(/initial-value:\s*rgb\(\d+ \d+ \d+ \/ [\d.]+\)/)
  })

  test('--star-opacity ist als <number> registriert', () => {
    const m = css.match(/@property --star-opacity\s*\{([^}]*)\}/)
    expect(m, '@property --star-opacity').not.toBeNull()
    expect(m![1]).toMatch(/syntax:\s*'<number>'/)
    expect(m![1]).toMatch(/inherits:\s*true/)
    expect(m![1]).toMatch(/initial-value:\s*1\b/)
  })

  test('der Anfangswert jeder registrierten Variable ist der Abend', () => {
    const evening = blockOf(MOODS.abend)
    expect(REGISTERED).toEqual(expect.arrayContaining([...COLOR_TOKENS, ...GLOW_TOKENS, 'star-opacity'].map((t) => `--${t}`)))
    for (const name of REGISTERED) {
      const initial = css.match(new RegExp(`@property ${name}\\s*\\{[^}]*initial-value:\\s*([^;]+);`))![1].trim()
      const value = evening.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm'))
      expect(value, `${name} in :root`).not.toBeNull()
      expect(initial.toLowerCase(), name).toBe(value![1].trim().toLowerCase())
    }
  })

  test('die 1,5 s langen Übergänge stehen nur unter prefers-reduced-motion: no-preference', () => {
    const media = blockOf(/^@media \(prefers-reduced-motion: no-preference\)\s*\{/m)
    const root = media.match(/:root\s*\{([^}]*)\}/)
    expect(root, ':root im Medienblock').not.toBeNull()
    for (const name of REGISTERED) {
      expect(root![1], `Übergang für ${name}`).toMatch(new RegExp(`${name}\\s+1\\.5s\\s+ease`))
    }
    // Außerhalb des Medienblocks gibt es keinen Übergang auf einer der registrierten Variablen.
    const outside = css.replace(media, '')
    for (const name of REGISTERED) {
      expect(outside, `Übergang auf ${name} außerhalb des Medienblocks`).not.toMatch(new RegExp(`transition:[^;]*${name}\\b`))
    }
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

describe('Goldlinien, Waschung und Linienknopf (Meilenstein 4.1)', () => {
  const MOOD_NAMES = Object.keys(MOODS) as Tageszeit[]
  const SUPPORTS_NO_MIX = /^@supports not \(color: color-mix\(in srgb, red, red\)\)\s*\{/gm

  /** Wert einer Eigenschaft in der Stimmung, sonst der aus `:root` (so löst der Browser die Vererbung auf). */
  const moodValue = (mood: Tageszeit, token: string): string | undefined => {
    const find = (block: string) => block.match(new RegExp(`^\\s*--${token}:\\s*([^;]+);`, 'm'))?.[1].trim()
    return find(blockOf(MOODS[mood])) ?? find(blockOf(MOODS.abend))
  }

  /** Alle Regeln (Auswahl und Inhalt), deren Auswahlliste `selector` enthält – auch außerhalb des Blocks am Zeilenanfang. */
  const rulesWith = (selector: string): string[] =>
    [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1].split(',').some((s) => s.trim() === selector))
      .map((m) => m[2])

  test('--wash-opacity liegt in jeder Stimmung zwischen 0.2 und 0.45', () => {
    for (const mood of MOOD_NAMES) {
      const value = moodValue(mood, 'wash-opacity')
      expect(value, `${mood} --wash-opacity`).toBeDefined()
      expect(Number(value), `${mood} --wash-opacity`).toBeGreaterThanOrEqual(0.2)
      expect(Number(value), `${mood} --wash-opacity`).toBeLessThanOrEqual(0.45)
    }
  })

  test('--gold-line und --gold-line-strong stehen in :root', () => {
    const root = blockOf(MOODS.abend)
    expect(root).toMatch(/--gold-line:\s*rgb\(233 196 142 \/ 0\.26\);/)
    expect(root).toMatch(/--gold-line-strong:\s*rgb\(233 196 142 \/ 0\.7\);/)
    // In jeder Stimmung gleich: keine Stimmung überschreibt sie.
    for (const mood of MOOD_NAMES.filter((m) => m !== 'abend')) {
      expect(blockOf(MOODS[mood]), `${mood} überschreibt die Goldlinie`).not.toMatch(/--gold-line/)
    }
  })

  test('.card hat den Goldrand', () => {
    expect(blockOf(/^\.card\s*\{/m)).toMatch(/^\s*border:\s*1px solid var\(--gold-line\);/m)
  })

  test('.rule ist eine kurze Linie: 40 px breit, 1 px hoch, --gold-line-strong, 8 px Abstand', () => {
    const rule = blockOf(/^\.rule\s*\{/m)
    expect(rule).toMatch(/width:\s*40px;/)
    expect(rule).toMatch(/height:\s*1px;/)
    expect(rule).toMatch(/background:\s*var\(--gold-line-strong\);/)
    expect(rule).toMatch(/margin-top:\s*8px;/)
  })

  test('.rule-fade läuft von Gold (50 %) nach transparent aus und füllt den Rest der Zeile', () => {
    const fade = blockOf(/^\.rule-fade\s*\{/m)
    expect(fade).toMatch(/flex:\s*1\b/)
    expect(fade).toMatch(/height:\s*1px;/)
    expect(fade).toMatch(/linear-gradient\(\s*to right,\s*rgb\(233 196 142 \/ 0\.5\),\s*transparent\s*\)/)
  })

  describe('.button-line', () => {
    const FILL = /color-mix\(in srgb, var\(--accent\) (\d+)%, var\(--sky-mid\)\)/
    const line = () => blockOf(/^\.button-line\s*\{/m)

    test('Rand 1 px Akzent 55 %, Fläche Akzent 8 % über --sky-mid, Schrift im Akzent', () => {
      const block = line()
      expect(block).toMatch(/^\s*border:\s*1px solid var\(--accent\);/m) // Rückfall, wenn color-mix() fehlt
      expect(block).toMatch(/^\s*border-color:\s*color-mix\(in srgb, var\(--accent\) 55%, transparent\);/m)
      expect(block).toMatch(/^\s*background:\s*color-mix\(in srgb, var\(--accent\) 8%, var\(--sky-mid\)\);/m)
      expect(block).toMatch(/^\s*color:\s*var\(--accent\);/m)
    })

    test('die Fläche ist deckend, auch ohne color-mix(): dann --sky-mid', () => {
      // Deckend, weil die zweite Farbe der Mischung keine Durchsicht hat (kein `transparent`, kein Alpha).
      expect(line().match(FILL)).not.toBeNull()
      const fallbacks = [...css.matchAll(SUPPORTS_NO_MIX)].map((m) => blockFrom(css, m.index!))
      const rule = fallbacks.map((b) => b.match(/\.button-line\s*\{([^}]*)\}/)).find(Boolean)
      expect(rule, '@supports-Rückfall für .button-line').toBeTruthy()
      expect(rule![1]).toMatch(/background:\s*var\(--sky-mid\);/)
    })

    test('die Schrift im Akzent hat auf der Fläche in jeder Stimmung mindestens 4,5:1', () => {
      const share = Number(line().match(FILL)![1]) / 100
      for (const mood of MOOD_NAMES) {
        const block = blockOf(MOODS[mood])
        const fill = over({ rgb: hex(block, 'accent'), alpha: share }, hex(block, 'sky-mid'))
        expect(contrast(hex(block, 'accent'), fill), `${mood}: --accent auf der Fläche des Linienknopfs`).toBeGreaterThanOrEqual(4.5)
      }
    })

    test('hält die Knopf-Regeln ein: Berührfläche ≥ 48 px, Pillenform, Druck-Skalierung, sichtbarer Fokus', () => {
      const block = line()
      expect(Number(block.match(/min-height:\s*(\d+)px;/)?.[1]), 'min-height').toBeGreaterThanOrEqual(48)
      expect(block).toMatch(/border-radius:\s*999px;/)
      // Der Fokusring kommt aus der globalen `:focus-visible`-Regel mit --focus-ring; der Knopf darf ihn nicht abschalten.
      expect(block).not.toMatch(/outline:\s*(none|0)/)
      expect(rulesWith(':focus-visible').join('\n')).toMatch(/outline:\s*2px solid var\(--focus-ring\);/)
      expect(rulesWith('.button-line:active').join('\n')).toMatch(/transform:\s*scale\(0\.98\);/)
    })
  })
})

describe('OfflineMark', () => {
  // Erst im Test gelesen, damit eine fehlende Datei nur diese Tests rot färbt.
  const source = () => readFileSync('src/components/OfflineMark.svelte', 'utf8')

  test('ist ein Bild mit der Beschriftung „offline gespeichert“ und ohne Eigenschaften', () => {
    const mark = source()
    const svg = mark.match(/<svg[^>]*>/)?.[0] ?? ''
    expect(svg).toMatch(/\brole="img"/)
    expect(svg).toMatch(/\baria-label="offline gespeichert"/)
    expect(svg).toMatch(/\bclass="offline-mark"/)
    expect(svg).toMatch(/\bviewBox="0 0 16 16"/)
    expect(mark).not.toMatch(/\$props/)
  })

  test('zeichnet Kreis (r 6,3) und Häkchen mit Strich in der Textfarbe, 13 px', () => {
    const mark = source()
    const svg = mark.match(/<svg[^>]*>/)?.[0] ?? ''
    expect(mark).toMatch(/<circle[^>]*\br="6\.3"/)
    expect(mark).toMatch(/<path[^>]*\bd="M/)
    expect(svg).toMatch(/\bstroke="currentColor"/)
    expect(svg).toMatch(/\bfill="none"/)
    expect(mark).toMatch(/width:\s*13px;/)
    expect(mark).toMatch(/height:\s*13px;/)
  })
})
