import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import {
  audioUrl,
  byCategory,
  CATEGORY_TITLE,
  durationLabel,
  FALLBACK_ID,
  MEDITATIONS,
  meditationById,
  suggestionFor,
  type Category,
  type Meditation,
} from '../../src/lib/content/catalog'
import { tageszeit, type Tageszeit } from '../../src/lib/time/tageszeit'

const CATEGORIES: Category[] = ['achtsamkeit', 'stress', 'fokus', 'mitgefuehl', 'gefuehle', 'alltag']
// Themen des Vorschlags je Tageszeit (Spec M7 §6).
const PAIR: Record<Tageszeit, readonly [Category, Category]> = {
  morgen: ['fokus', 'alltag'],
  tag: ['stress', 'gefuehle'],
  abend: ['achtsamkeit', 'mitgefuehl'],
}

const meditation = (id: string, category: Category, overrides: Partial<Meditation> = {}): Meditation => ({
  id,
  title: `Titel ${id}`,
  category,
  description: `Beschreibung ${id}.`,
  minutes: 5,
  file: `audio/meditations/${id}.mp3`,
  duration: 300,
  bytes: 1000,
  version: '0123456789',
  placeholder: false,
  ...overrides,
})
const many = (category: Category, count: number) => Array.from({ length: count }, (_, i) => meditation(`${category}-${i}`, category))

/** Lokale Zeit. Monat 1–12. */
const at = (year: number, month: number, day: number, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute)

describe('Daten', () => {
  test('18 Meditationen: je vier in den bisherigen, je zwei in den neuen Themen, jede mit gültigem Thema', () => {
    expect(MEDITATIONS).toHaveLength(18)
    const count = (category: Category) => MEDITATIONS.filter((m) => m.category === category).length
    expect(CATEGORIES.map(count)).toEqual([4, 4, 4, 2, 2, 2])
    expect(new Set(MEDITATIONS.map((m) => m.id)).size).toBe(18)
  })

  test('Datei, Version und Größe stimmen mit der MP3 unter public/ überein (Manifest nicht veraltet)', () => {
    for (const m of MEDITATIONS) {
      expect(m.file).toBe(`audio/meditations/${m.id}.mp3`)
      const path = `public/${m.file}`
      expect(m.version, m.id).toBe(createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 10))
      expect(m.bytes, m.id).toBe(statSync(path).size)
    }
  })

  test('Ersatz-id „Ankommen im Atem“ ist im Katalog', () => {
    expect(FALLBACK_ID).toBe('ankommen-im-atem')
    expect(meditationById(FALLBACK_ID)?.title).toBe('Ankommen im Atem')
  })

  test('meditationById findet eine Meditation oder gibt null zurück', () => {
    expect(meditationById('guten-morgen')).toBe(MEDITATIONS.find((m) => m.id === 'guten-morgen'))
    expect(meditationById('gibt-es-nicht')).toBeNull()
    expect(meditationById('')).toBeNull()
  })
})

describe('byCategory', () => {
  test('sechs Themen in der Reihenfolge Achtsamkeit, Stress, Fokus, Mitgefühl, Gefühle, Alltag mit ihren Titeln', () => {
    expect(CATEGORY_TITLE).toEqual({
      achtsamkeit: 'Einsteiger & Achtsamkeit',
      stress: 'Stress & Ruhe',
      fokus: 'Fokus & Energie',
      mitgefuehl: 'Mitgefühl & Freundlichkeit',
      gefuehle: 'Gefühle & Loslassen',
      alltag: 'Achtsam im Alltag',
    })
    expect(byCategory().map((g) => [g.category, g.title])).toEqual([
      ['achtsamkeit', 'Einsteiger & Achtsamkeit'],
      ['stress', 'Stress & Ruhe'],
      ['fokus', 'Fokus & Energie'],
      ['mitgefuehl', 'Mitgefühl & Freundlichkeit'],
      ['gefuehle', 'Gefühle & Loslassen'],
      ['alltag', 'Achtsam im Alltag'],
    ])
  })

  test('jede Meditation steht genau einmal in ihrem Thema, in Katalog-Reihenfolge', () => {
    const groups = byCategory()
    for (const g of groups) {
      expect(g.items.length).toBeGreaterThan(0)
      expect(g.items.every((m) => m.category === g.category)).toBe(true)
      expect(g.items).toEqual(MEDITATIONS.filter((m) => m.category === g.category))
    }
    expect(groups.flatMap((g) => g.items.map((m) => m.id)).sort()).toEqual(MEDITATIONS.map((m) => m.id).sort())
  })
})

describe('suggestionFor: Themenpaar nach Tageszeit', () => {
  const categoryAt = (hour: number, minute: number) => suggestionFor(at(2026, 10, 21, hour, minute)).category
  // An sechs Tagen hintereinander kommt jede Meditation des Paars einmal dran.
  const categoriesOverWeek = (hour: number) =>
    new Set(Array.from({ length: 6 }, (_, d) => suggestionFor(at(2026, 10, 19 + d, hour)).category))

  test('5 bis 11 Uhr: Fokus & Energie oder Achtsam im Alltag', () => {
    for (const [hour, minute] of [[5, 0], [8, 30], [10, 59]]) expect(PAIR.morgen).toContain(categoryAt(hour, minute))
    expect(categoriesOverWeek(8)).toEqual(new Set(['fokus', 'alltag']))
  })

  test('11 bis 17 Uhr: Stress & Ruhe oder Gefühle & Loslassen', () => {
    for (const [hour, minute] of [[11, 0], [14, 0], [16, 59]]) expect(PAIR.tag).toContain(categoryAt(hour, minute))
    expect(categoriesOverWeek(14)).toEqual(new Set(['stress', 'gefuehle']))
  })

  test('ab 17 Uhr bis vor 5 Uhr: Einsteiger & Achtsamkeit oder Mitgefühl & Freundlichkeit', () => {
    for (const [hour, minute] of [[17, 0], [23, 59], [0, 0], [4, 59]]) expect(PAIR.abend).toContain(categoryAt(hour, minute))
    expect(categoriesOverWeek(20)).toEqual(new Set(['achtsamkeit', 'mitgefuehl']))
  })

  // Review Focus 1: an jeder Grenze springt der Vorschlag ins nächste Paar, an jedem Tag der Woche.
  test('Grenzen 4:59/5:00, 10:59/11:00, 16:59/17:00 trennen die Paare', () => {
    const BOUNDS: [number, number, Tageszeit][] = [
      [4, 59, 'abend'], [5, 0, 'morgen'], [10, 59, 'morgen'], [11, 0, 'tag'], [16, 59, 'tag'], [17, 0, 'abend'],
    ]
    for (let d = 0; d < 6; d++) {
      for (const [hour, minute, zeit] of BOUNDS) {
        const category = suggestionFor(at(2026, 10, 19 + d, hour, minute)).category
        expect(PAIR[zeit], `Tag ${d}, ${hour}:${minute}`).toContain(category)
      }
    }
  })

  test('liefert eine Meditation aus dem Katalog', () => {
    expect(MEDITATIONS).toContain(suggestionFor(at(2026, 10, 21, 9)))
  })

  // Thema und Stimmung (Motiv des Vorschlags) dürfen nie auseinanderlaufen: zu jeder Stunde, am Anfang und am Ende.
  test('zu jeder Stunde gehört das Thema zum Paar der Tageszeit', () => {
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 59]) {
        const when = at(2026, 10, 21, hour, minute)
        expect(PAIR[tageszeit(when)], `${hour}:${minute}`).toContain(suggestionFor(when).category)
      }
    }
  })
})

describe('suggestionFor: Rotation nach Kalendertag', () => {
  // Unterschiedlich viele je Paar, damit „mod Anzahl“ je Paar sichtbar wird; die neuen Themen stehen wie im
  // Katalog hinter den bisherigen.
  const list = [
    ...many('achtsamkeit', 3), ...many('stress', 2), ...many('fokus', 1),
    ...many('mitgefuehl', 1), ...many('gefuehle', 1), ...many('alltag', 1),
  ]
  const idAt = (year: number, month: number, day: number, hour: number, minute = 0) =>
    suggestionFor(at(year, month, day, hour, minute), list).id

  test('über den Tag stabil: gleiche Meditation zu jeder Zeit im selben Thema und Tag', () => {
    expect(idAt(2026, 10, 21, 5, 0)).toBe(idAt(2026, 10, 21, 10, 59))
    expect(idAt(2026, 10, 21, 11, 0)).toBe(idAt(2026, 10, 21, 16, 59))
    expect(idAt(2026, 10, 21, 17, 0)).toBe(idAt(2026, 10, 21, 23, 59))
  })

  test('am nächsten Tag die nächste Meditation, nach der letzten wieder die erste, über beide Themen in Katalog-Reihenfolge', () => {
    const pool = ['stress-0', 'stress-1', 'gefuehle-0']
    const ids = [10, 11, 12, 13, 14, 15].map((d) => idAt(2026, 6, d, 12))
    const first = pool.indexOf(ids[0])
    expect(first).toBeGreaterThanOrEqual(0)
    expect(ids).toEqual(ids.map((_, i) => pool[(first + i) % 3]))
  })

  test('jedes Paar rotiert über seine eigene Anzahl', () => {
    const over = (hour: number, count: number) => Array.from({ length: count * 2 }, (_, d) => idAt(2026, 3, 1 + d, hour))
    const morgen = over(8, 2)
    expect(new Set(morgen)).toEqual(new Set(['fokus-0', 'alltag-0']))
    expect(morgen[2]).toBe(morgen[0])
    expect(morgen[1]).not.toBe(morgen[0])
    const abend = over(20, 4)
    expect(abend.slice(4)).toEqual(abend.slice(0, 4))
    expect(new Set(abend)).toEqual(new Set(['achtsamkeit-0', 'achtsamkeit-1', 'achtsamkeit-2', 'mitgefuehl-0']))
  })

  test('aus dem echten Katalog: sechs Tage um 8 Uhr sechs verschiedene, am siebten wieder die erste; über die Tageszeit stabil', () => {
    const ids = Array.from({ length: 7 }, (_, d) => suggestionFor(at(2026, 10, 19 + d, 8)).id)
    expect(new Set(ids.slice(0, 6)).size).toBe(6)
    expect(ids[6]).toBe(ids[0])
    const TIMES: Record<Tageszeit, [number, number][]> = {
      morgen: [[5, 0], [8, 0], [10, 59]],
      tag: [[11, 0], [14, 0], [16, 59]],
      abend: [[0, 0], [4, 59], [17, 0], [23, 59]],
    }
    for (let d = 0; d < 7; d++) {
      for (const [zeit, times] of Object.entries(TIMES)) {
        const day = times.map(([hour, minute]) => suggestionFor(at(2026, 10, 19 + d, hour, minute)).id)
        expect(new Set(day).size, `Tag ${d}, ${zeit}`).toBe(1)
      }
    }
  })

  test('der Tag des Jahres zählt ab 0 (1. Januar), auch im Schaltjahr', () => {
    const week = many('stress', 7)
    const pick = (y: number, m: number, d: number) => suggestionFor(at(y, m, d), week).id
    expect(pick(2026, 1, 1)).toBe('stress-0')
    expect(pick(2026, 1, 2)).toBe('stress-1')
    expect(pick(2026, 3, 1)).toBe('stress-3') // Tag 59
    expect(pick(2026, 12, 31)).toBe('stress-0') // Tag 364
    expect(pick(2028, 12, 31)).toBe('stress-1') // Tag 365 im Schaltjahr
  })

  test('ein Paar ohne Eintrag fällt auf die ganze Liste zurück; eine leere Liste ist ein Fehler', () => {
    const onlyStress = many('stress', 3)
    expect(suggestionFor(at(2026, 1, 2, 8), onlyStress).id).toBe('stress-1') // Morgen, aber weder Fokus noch Alltag
    const onlyAlltag = many('alltag', 2)
    expect(suggestionFor(at(2026, 1, 2, 8), onlyAlltag).id).toBe('alltag-1') // ein Thema des Paars genügt
    expect(suggestionFor(at(2026, 1, 2, 20), [...onlyStress, ...onlyAlltag]).id).toBe('stress-1') // Abend: Rückfall
    expect(() => suggestionFor(at(2026, 1, 2, 8), [])).toThrow()
  })
})

describe('suggestionFor: Zeitumstellung', () => {
  const original = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'Europe/Berlin'
  })
  afterAll(() => {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })

  test('die Prüfung läuft wirklich mit Sommer- und Winterzeit', () => {
    expect(at(2026, 3, 28).getTimezoneOffset()).toBe(-60)
    expect(at(2026, 3, 30).getTimezoneOffset()).toBe(-120)
    expect(at(2026, 10, 26).getTimezoneOffset()).toBe(-60)
  })

  test('jeder Kalendertag des Jahres bekommt die Nummer seines Datums, kurz nach Mitternacht und kurz davor', () => {
    const list = [...many('achtsamkeit', 7), ...many('stress', 7), ...many('fokus', 7)]
    for (let day = 0; day < 365; day++) {
      for (const [hour, minute] of [[0, 30], [23, 30]]) {
        const when = new Date(2026, 0, 1 + day, hour, minute)
        expect(suggestionFor(when, list).id, when.toString()).toBe(`achtsamkeit-${day % 7}`)
      }
    }
  })
})

describe('durationLabel', () => {
  const label = (duration: number) => durationLabel(meditation('x', 'stress', { duration }))

  test('rundet auf ganze Minuten', () => {
    expect(label(299.6)).toBe('5 Min')
    expect(label(300.1)).toBe('5 Min')
    expect(label(600.1)).toBe('10 Min')
    expect(label(89)).toBe('1 Min')
    expect(label(90)).toBe('2 Min')
  })

  test('mindestens 1 Min', () => {
    expect(label(20)).toBe('1 Min')
    expect(label(0)).toBe('1 Min')
  })

  test('aus der echten Datei: Katalogdauern sind die Zielminuten', () => {
    for (const m of MEDITATIONS) expect(durationLabel(m), m.id).toBe(`${m.minutes} Min`)
  })
})

describe('audioUrl', () => {
  test('Adresse über assetUrl mit der Version als Abfrage', () => {
    const m = meditation('guten-morgen', 'fokus', { version: 'a1b2c3d4e5' })
    expect(audioUrl(m)).toBe(`${import.meta.env.BASE_URL}audio/meditations/guten-morgen.mp3?v=a1b2c3d4e5`)
  })

  test('neue Aufnahme, neue Adresse', () => {
    const before = meditation('guten-morgen', 'fokus', { version: 'aaaaaaaaaa' })
    const after = { ...before, version: 'bbbbbbbbbb' }
    expect(audioUrl(after)).not.toBe(audioUrl(before))
  })

  test('jede Meditation hat eine eigene Adresse mit 10-stelliger Hex-Version', () => {
    const urls = MEDITATIONS.map(audioUrl)
    expect(new Set(urls).size).toBe(MEDITATIONS.length)
    for (const url of urls) expect(url).toMatch(/audio\/meditations\/[a-z-]+\.mp3\?v=[0-9a-f]{10}$/)
  })
})
