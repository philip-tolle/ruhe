import { describe, test, expect } from 'vitest'
import {
  calendarWeeks,
  dayLabel,
  importMessage,
  megabytes,
  monthTitle,
  MONTH_NAMES,
  offlineSummary,
  savePercent,
  saveResultMessage,
  savingLabel,
  shiftMonth,
  streakLabel,
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

test('offline summary names the saved meditations and their size', () => {
  expect(offlineSummary(0, 9, 0)).toBe('0 von 9 Meditationen offline gespeichert (0 MB)')
  expect(offlineSummary(1, 9, 360_326)).toBe('1 von 9 Meditationen offline gespeichert (0,4 MB)')
  expect(offlineSummary(9, 9, 7_723_456)).toBe('9 von 9 Meditationen offline gespeichert (7,7 MB)')
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
    expect(saveResultMessage({ saved: 9, failed: 0, quota: false }, 9)).toBe('Alle Meditationen sind offline verfügbar.')
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
