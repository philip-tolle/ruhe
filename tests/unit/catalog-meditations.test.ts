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

const CATEGORIES: Category[] = ['achtsamkeit', 'stress', 'fokus']

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
  test('neun Meditationen, je drei pro Thema, jede mit gültigem Thema', () => {
    expect(MEDITATIONS).toHaveLength(9)
    for (const category of CATEGORIES) expect(MEDITATIONS.filter((m) => m.category === category)).toHaveLength(3)
    expect(new Set(MEDITATIONS.map((m) => m.id)).size).toBe(9)
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
  test('Themen in der Reihenfolge Achtsamkeit, Stress, Fokus mit ihren Titeln', () => {
    expect(CATEGORY_TITLE).toEqual({
      achtsamkeit: 'Einsteiger & Achtsamkeit',
      stress: 'Stress & Ruhe',
      fokus: 'Fokus & Energie',
    })
    expect(byCategory().map((g) => [g.category, g.title])).toEqual([
      ['achtsamkeit', 'Einsteiger & Achtsamkeit'],
      ['stress', 'Stress & Ruhe'],
      ['fokus', 'Fokus & Energie'],
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

describe('suggestionFor: Thema nach Tageszeit', () => {
  const categoryAt = (hour: number, minute: number) => suggestionFor(at(2026, 10, 21, hour, minute)).category

  test('5 bis 11 Uhr: Fokus & Energie', () => {
    expect(categoryAt(5, 0)).toBe('fokus')
    expect(categoryAt(8, 30)).toBe('fokus')
    expect(categoryAt(10, 59)).toBe('fokus')
  })

  test('11 bis 17 Uhr: Stress & Ruhe', () => {
    expect(categoryAt(11, 0)).toBe('stress')
    expect(categoryAt(14, 0)).toBe('stress')
    expect(categoryAt(16, 59)).toBe('stress')
  })

  test('ab 17 Uhr bis vor 5 Uhr: Einsteiger & Achtsamkeit', () => {
    expect(categoryAt(17, 0)).toBe('achtsamkeit')
    expect(categoryAt(23, 59)).toBe('achtsamkeit')
    expect(categoryAt(0, 0)).toBe('achtsamkeit')
    expect(categoryAt(4, 59)).toBe('achtsamkeit')
  })

  test('liefert eine Meditation aus dem Katalog', () => {
    expect(MEDITATIONS).toContain(suggestionFor(at(2026, 10, 21, 9)))
  })

  // Thema und Stimmung (Motiv des Vorschlags) dürfen nie auseinanderlaufen: zu jeder Stunde, am Anfang und am Ende.
  test('zu jeder Stunde gehört das Thema zur Tageszeit: Morgen Fokus, Tag Stress, Abend Achtsamkeit', () => {
    const THEMA: Record<Tageszeit, Category> = { morgen: 'fokus', tag: 'stress', abend: 'achtsamkeit' }
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 59]) {
        expect(categoryAt(hour, minute), `${hour}:${minute}`).toBe(THEMA[tageszeit(at(2026, 10, 21, hour, minute))])
      }
    }
  })
})

describe('suggestionFor: Rotation nach Kalendertag', () => {
  // Unterschiedlich viele pro Thema, damit „mod Anzahl“ je Thema sichtbar wird.
  const list = [...many('achtsamkeit', 4), ...many('stress', 3), ...many('fokus', 2)]
  const idAt = (year: number, month: number, day: number, hour: number, minute = 0) =>
    suggestionFor(at(year, month, day, hour, minute), list).id

  test('über den Tag stabil: gleiche Meditation zu jeder Zeit im selben Thema und Tag', () => {
    expect(idAt(2026, 10, 21, 5, 0)).toBe(idAt(2026, 10, 21, 10, 59))
    expect(idAt(2026, 10, 21, 11, 0)).toBe(idAt(2026, 10, 21, 16, 59))
    expect(idAt(2026, 10, 21, 17, 0)).toBe(idAt(2026, 10, 21, 23, 59))
  })

  test('am nächsten Tag die nächste Meditation, nach der letzten wieder die erste', () => {
    const days = [10, 11, 12, 13, 14, 15]
    const ids = days.map((d) => idAt(2026, 6, d, 12))
    expect(ids.every((id) => id.startsWith('stress-'))).toBe(true)
    const index = ids.map((id) => Number(id.split('-')[1]))
    for (let i = 1; i < index.length; i++) expect(index[i]).toBe((index[i - 1] + 1) % 3)
    expect(new Set(index)).toEqual(new Set([0, 1, 2]))
  })

  test('jedes Thema rotiert über seine eigene Anzahl', () => {
    const indexOver = (hour: number, count: number) =>
      Array.from({ length: count * 2 }, (_, d) => Number(idAt(2026, 3, 1 + d, hour).split('-')[1]))
    const fokus = indexOver(8, 2)
    expect(fokus.every((i) => i === 0 || i === 1)).toBe(true)
    expect(fokus[2]).toBe(fokus[0])
    expect(fokus[1]).not.toBe(fokus[0])
    const achtsamkeit = indexOver(20, 4)
    expect(achtsamkeit.slice(4)).toEqual(achtsamkeit.slice(0, 4))
    expect(new Set(achtsamkeit).size).toBe(4)
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

  test('das Thema ohne Eintrag fällt auf die ganze Liste zurück; eine leere Liste ist ein Fehler', () => {
    const onlyStress = many('stress', 3)
    expect(suggestionFor(at(2026, 1, 2, 8), onlyStress).id).toBe('stress-1') // Morgen, aber kein Fokus
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
