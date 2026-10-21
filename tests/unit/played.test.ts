import { test, expect } from 'vitest'
import { playedSeconds, rangesOf } from '../../src/lib/audio/played'

test('separate ranges add up', () => {
  expect(playedSeconds([{ start: 0, end: 10 }, { start: 20, end: 25.5 }], 60)).toBe(15.5)
  expect(playedSeconds([], 60)).toBe(0)
})

test('overlapping, touching, nested and unsorted ranges count once', () => {
  const ranges = [
    { start: 30, end: 40 },
    { start: 0, end: 10 },
    { start: 5, end: 15 },  // überlappt
    { start: 15, end: 20 }, // schließt an
    { start: 2, end: 3 },   // liegt innen
    { start: 35, end: 45 },
  ]
  expect(playedSeconds(ranges, 60)).toBe(20 + 15)
  // Ein Bereich, der nach einem Neuladen erneut gemeldet wird, zählt nicht doppelt.
  expect(playedSeconds([{ start: 0, end: 12 }, { start: 0, end: 12 }, { start: 8, end: 30 }], 60)).toBe(30)
})

test('ranges are limited to [0, duration]', () => {
  expect(playedSeconds([{ start: -5, end: 3 }], 60)).toBe(3)
  expect(playedSeconds([{ start: 50, end: 70 }], 60)).toBe(10)
  expect(playedSeconds([{ start: 61, end: 70 }, { start: -9, end: -1 }], 60)).toBe(0)
  expect(playedSeconds([{ start: 0, end: 100 }], 42.5)).toBe(42.5)
  expect(playedSeconds([{ start: 10, end: 5 }], 60)).toBe(0) // verkehrt herum: nichts
})

test('invalid values count nothing and the result is always finite', () => {
  for (const duration of [NaN, 0, -1]) expect(playedSeconds([{ start: 0, end: 10 }], duration)).toBe(0)
  expect(playedSeconds([{ start: NaN, end: 10 }, { start: 20, end: 25 }], 60)).toBe(5)
  expect(playedSeconds([{ start: 0, end: NaN }], 60)).toBe(0)
  // Unbekannte Länge eines Streams: begrenzt ist dann nichts, unendlich wird es trotzdem nie.
  expect(playedSeconds([{ start: 0, end: 12 }], Infinity)).toBe(12)
  expect(playedSeconds([{ start: 0, end: Infinity }], Infinity)).toBe(0)
})

test('rangesOf reads a TimeRanges object', () => {
  const starts = [0, 5]
  const ends = [1.5, 7]
  const ranges = { length: 2, start: (i: number) => starts[i], end: (i: number) => ends[i] }
  expect(rangesOf(ranges)).toEqual([{ start: 0, end: 1.5 }, { start: 5, end: 7 }])
  expect(rangesOf({ length: 0, start: () => 0, end: () => 0 })).toEqual([])
})
