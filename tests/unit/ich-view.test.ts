import { describe, test, expect } from 'vitest'
import {
  calendarWeeks,
  dayLabel,
  importMessage,
  megabytes,
  monthTitle,
  MONTH_NAMES,
  offlineSummary,
  saveProgress,
  savePercent,
  saveResultMessage,
  savedTotals,
  savingLabel,
  shiftMonth,
  streakLabel,
  sumBytes,
  WEEKDAYS,
} from '../../src/lib/ui/ich-view'

test('month names are German and fixed', () => {
  expect(MONTH_NAMES).toEqual([
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
  ])
  expect(monthTitle(2026, 9)).toBe('Oktober 2026')
  expect(monthTitle(2027, 0)).toBe('Januar 2027')
  expect(monthTitle(2026, 2)).toBe('März 2026')
})

test('the week starts on Monday', () => {
  expect(WEEKDAYS.map(([short]) => short)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
  expect(WEEKDAYS.map(([, long]) => long)).toEqual([
    'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag',
  ])
})

test('calendar grid: October 2026 begins on a Thursday and ends on a Saturday', () => {
  expect(calendarWeeks(2026, 9)).toEqual([
    [null, null, null, 1, 2, 3, 4],
    [5, 6, 7, 8, 9, 10, 11],
    [12, 13, 14, 15, 16, 17, 18],
    [19, 20, 21, 22, 23, 24, 25],
    [26, 27, 28, 29, 30, 31, null],
  ])
})

test('calendar grid: a month starting on Monday has no leading blanks, 28 days make four full weeks', () => {
  const weeks = calendarWeeks(2027, 1) // Februar 2027, 1. = Montag
  expect(weeks).toHaveLength(4)
  expect(weeks[0]).toEqual([1, 2, 3, 4, 5, 6, 7])
  expect(weeks[3]).toEqual([22, 23, 24, 25, 26, 27, 28])
})

test('calendar grid: a month can need six weeks, and a Sunday start leads with six blanks', () => {
  // August 2026: 1. = Samstag, 31 Tage → sechs Wochen, die letzte nur mit dem 31.
  const weeks = calendarWeeks(2026, 7)
  expect(weeks).toHaveLength(6)
  expect(weeks[0]).toEqual([null, null, null, null, null, 1, 2])
  expect(weeks[4]).toEqual([24, 25, 26, 27, 28, 29, 30])
  expect(weeks[5]).toEqual([31, null, null, null, null, null, null])
  // Februar 2026: 1. = Sonntag
  expect(calendarWeeks(2026, 1)[0]).toEqual([null, null, null, null, null, null, 1])
})

test('calendar grid: leap day, every day appears once and in order, rows have seven cells', () => {
  const weeks = calendarWeeks(2028, 1) // Februar 2028, 29 Tage, 1. = Dienstag
  expect(weeks.flat().filter((d) => d !== null)).toEqual(Array.from({ length: 29 }, (_, i) => i + 1))
  for (const year of [2026, 2027, 2028]) {
    for (let month0 = 0; month0 < 12; month0++) {
      const grid = calendarWeeks(year, month0)
      expect(grid.length).toBeGreaterThanOrEqual(4)
      expect(grid.length).toBeLessThanOrEqual(6)
      for (const week of grid) expect(week).toHaveLength(7)
      const days = grid.flat().filter((d) => d !== null)
      expect(days).toEqual(Array.from({ length: new Date(year, month0 + 1, 0).getDate() }, (_, i) => i + 1))
      // Der Erste steht in der Spalte seines Wochentags (Montag = 0).
      expect(grid[0].indexOf(1)).toBe((new Date(year, month0, 1).getDay() + 6) % 7)
    }
  }
})

test('shiftMonth crosses year boundaries in both directions', () => {
  expect(shiftMonth(2026, 9, 1)).toEqual({ year: 2026, month0: 10 })
  expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month0: 0 })
  expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month0: 11 })
  expect(shiftMonth(2026, 9, -1)).toEqual({ year: 2026, month0: 8 })
  expect(shiftMonth(2026, 9, 14)).toEqual({ year: 2027, month0: 11 })
  expect(shiftMonth(2026, 0, -13)).toEqual({ year: 2024, month0: 11 })
})

test('accessible name of a meditated day', () => {
  expect(dayLabel(21, 9)).toBe('21. Oktober, meditiert')
  expect(dayLabel(3, 8)).toBe('3. September, meditiert')
  expect(dayLabel(1, 2)).toBe('1. März, meditiert')
})

test('streak label has singular and plural', () => {
  expect([0, 1, 2, 3, 30].map(streakLabel)).toEqual(['0 Tage', '1 Tag', '2 Tage', '3 Tage', '30 Tage'])
})

test('import message has singular and plural', () => {
  expect([0, 1, 2, 12].map(importMessage)).toEqual([
    '0 neue Sitzungen importiert.',
    '1 neue Sitzung importiert.',
    '2 neue Sitzungen importiert.',
    '12 neue Sitzungen importiert.',
  ])
})

test('megabytes are decimal, with one decimal place and a comma', () => {
  expect(megabytes(0)).toBe('0 MB')
  expect(megabytes(600_339)).toBe('0,6 MB')
  expect(megabytes(1_200_320)).toBe('1,2 MB')
  expect(megabytes(7_723_456)).toBe('7,7 MB')
  expect(megabytes(12_000_000)).toBe('12,0 MB')
})

test('offline summary names the saved meditations and music pieces and both sizes', () => {
  expect(offlineSummary({ saved: 3, total: 9 }, { saved: 2, total: 7 }, 12_400_000, 49_200_000)).toBe(
    '3 von 9 Meditationen und 2 von 7 Musikstücken offline gespeichert (12,4 MB von 49,2 MB)',
  )
  expect(offlineSummary({ saved: 0, total: 9 }, { saved: 0, total: 7 }, 0, 49_200_000)).toBe(
    '0 von 9 Meditationen und 0 von 7 Musikstücken offline gespeichert (0 MB von 49,2 MB)',
  )
})

test('saving label counts the file in progress, never beyond the total', () => {
  expect(savingLabel(0, 9)).toBe('Speichere 1 von 9 …')
  expect(savingLabel(2, 9)).toBe('Speichere 3 von 9 …')
  expect(savingLabel(8, 9)).toBe('Speichere 9 von 9 …')
  expect(savingLabel(9, 9)).toBe('Speichere 9 von 9 …')
})

test('save progress is the share of bytes in whole percent, kept between 0 and 100', () => {
  expect(savePercent(0, 1000)).toBe(0)
  expect(savePercent(250, 1000)).toBe(25)
  expect(savePercent(333, 1000)).toBe(33)
  expect(savePercent(1000, 1000)).toBe(100)
  expect(savePercent(1500, 1000)).toBe(100) // zu viel gezählt (nochmal geladen): nie über 100
  expect(savePercent(-5, 1000)).toBe(0)
  expect(savePercent(10, 0)).toBe(0) // nichts zu laden
})

describe('save result message', () => {
  test('everything saved', () => {
    expect(saveResultMessage({ saved: 16, failed: 0, quota: false }, 16)).toBe('Alle Meditationen und die Musik sind offline verfügbar.')
  })

  test('full storage keeps what was saved', () => {
    expect(saveResultMessage({ saved: 2, failed: 0, quota: true }, 9)).toBe(
      'Nicht genug Speicherplatz. Bereits Gespeichertes bleibt erhalten.',
    )
    // Speicher voll gewinnt auch dann, wenn vorher eine Datei fehlschlug.
    expect(saveResultMessage({ saved: 2, failed: 1, quota: true }, 9)).toBe(
      'Nicht genug Speicherplatz. Bereits Gespeichertes bleibt erhalten.',
    )
  })

  test('failed files are counted, the others stay saved', () => {
    expect(saveResultMessage({ saved: 8, failed: 1, quota: false }, 9)).toBe('8 von 9 gespeichert, 1 fehlgeschlagen.')
    expect(saveResultMessage({ saved: 0, failed: 9, quota: false }, 9)).toBe('0 von 9 gespeichert, 9 fehlgeschlagen.')
  })
})

describe('saved files and their size', () => {
  const files = [
    { url: 'a', bytes: 400 },
    { url: 'b', bytes: 600 },
    { url: 'c', bytes: 250 },
  ]

  test('sum of bytes', () => {
    expect(sumBytes(files)).toBe(1250)
    expect(sumBytes([])).toBe(0)
  })

  test('only files known to be saved count; unchecked and not saved do not', () => {
    expect(savedTotals(files, {})).toEqual({ count: 0, bytes: 0 })
    expect(savedTotals(files, { a: true, b: false })).toEqual({ count: 1, bytes: 400 })
    expect(savedTotals(files, { a: true, b: true, c: true })).toEqual({ count: 3, bytes: 1250 })
    expect(savedTotals(files, { x: true })).toEqual({ count: 0, bytes: 0 }) // fremde Adresse
  })
})

// Der Lauf meldet, wie `saveAll` es tut: die empfangenen Bytes (zusammen, nur gespeicherte Dateien samt
// der laufenden), dann „Datei gespeichert“, dann nochmals die Bytes ohne die Bruchstücke gescheiterter Dateien.
describe('save progress', () => {
  test('downloaded files: the share of bytes received', () => {
    const p = saveProgress(1000) // Dateien à 400 und 600
    expect(p.received(0)).toBe(0)
    expect(p.received(100)).toBe(10)
    expect(p.received(400)).toBe(40)
    expect(p.saved(400)).toBe(40)
    expect(p.received(400)).toBe(40)
    expect(p.received(700)).toBe(70)
    expect(p.received(1000)).toBe(100)
    expect(p.saved(600)).toBe(100)
  })

  test('a file that was there already counts at once, with the size from the catalog', () => {
    const p = saveProgress(1000) // 400 gespeichert, 600 zu laden
    expect(p.received(0)).toBe(0)
    expect(p.saved(400)).toBe(40) // keine Bytes empfangen, also schon da
    expect(p.received(0)).toBe(40)
    expect(p.received(300)).toBe(70)
    expect(p.received(600)).toBe(100)
    expect(p.saved(600)).toBe(100) // diese wurde geladen: zählt nicht doppelt
  })

  test('a file that was there already in the middle of a run', () => {
    const p = saveProgress(1000) // 300 geladen, 200 schon da, 500 geladen
    p.received(0)
    p.received(300)
    expect(p.saved(300)).toBe(30)
    p.received(300)
    expect(p.saved(200)).toBe(50) // seit der letzten Datei kamen keine Bytes
    expect(p.received(300)).toBe(50)
    expect(p.received(550)).toBe(75)
    expect(p.received(800)).toBe(100)
    expect(p.saved(500)).toBe(100)
  })

  test('every file there already: complete without a single byte received', () => {
    const p = saveProgress(1000)
    p.received(0)
    expect(p.saved(400)).toBe(40)
    p.received(0)
    expect(p.saved(600)).toBe(100)
  })

  test('the bar never goes back when a failed file drops its fragment', () => {
    const p = saveProgress(1000) // 500 scheitert bei 250, 500 ist schon da
    p.received(0)
    expect(p.received(250)).toBe(25)
    expect(p.received(0)).toBe(25) // gescheitert: Bruchstück fällt heraus, Anzeige bleibt
    expect(p.saved(500)).toBe(50) // die nächste war schon da (die Bytes standen wieder auf dem alten Wert)
  })

  test('nothing to load: 0', () => {
    const p = saveProgress(0)
    expect(p.received(0)).toBe(0)
    expect(p.saved(0)).toBe(0)
  })

  test('more bytes than expected stop at 100', () => {
    const p = saveProgress(1000)
    expect(p.received(1500)).toBe(100)
  })
})
