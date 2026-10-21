process.env.TZ = 'Europe/Berlin'
import { test, expect } from 'vitest'
import { streak, totalMinutes, daysInMonth, dayKey, MIN_SECONDS } from '../../src/lib/stats/summary'
const s = (start: Date, seconds = 600) => ({ id: start.toISOString(), start: start.toISOString(), kind: 'timer' as const, ref: 'timer', seconds })
const d = (y: number, m: number, day: number, h = 8, min = 0) => new Date(y, m - 1, day, h, min)

test('timezone is Europe/Berlin (sonst prüfen die Sommerzeit-Tests nichts)', () => {
  expect([d(2026, 3, 28).getTimezoneOffset(), d(2026, 3, 30).getTimezoneOffset()]).toEqual([-60, -120])
})
test('streak counts back from today, or from yesterday if today is empty', () => {
  const ss = [s(d(2026, 10, 19)), s(d(2026, 10, 20)), s(d(2026, 10, 21))]
  expect(streak(ss, d(2026, 10, 21, 22))).toBe(3)
  expect(streak(ss.slice(0, 2), d(2026, 10, 21, 22))).toBe(2)   // heute noch nicht meditiert
  expect(streak(ss.slice(0, 2), d(2026, 10, 22, 0, 1))).toBe(0)  // gestern auch nicht → gerissen
  expect(streak([], d(2026, 10, 21))).toBe(0)
})
test('streak ends at the first day without a session and ignores several sessions per day', () => {
  const ss = [s(d(2026, 10, 15)), s(d(2026, 10, 17)), s(d(2026, 10, 17, 20)), s(d(2026, 10, 18)), s(d(2026, 10, 18, 9)), s(d(2026, 10, 19))]
  expect(streak(ss, d(2026, 10, 19, 12))).toBe(3)
  expect(streak(ss, d(2026, 10, 20, 12))).toBe(3) // heute leer, ab gestern gezählt
})
test('session just before midnight counts for that day', () => {
  expect(dayKey(d(2026, 10, 20, 23, 50))).toBe('2026-10-20')
  expect(streak([s(d(2026, 10, 20, 23, 50)), s(d(2026, 10, 21, 0, 10))], d(2026, 10, 21, 12))).toBe(2)
})
test('dayKey is local and zero padded', () => {
  expect(dayKey(d(2026, 1, 5, 0, 0))).toBe('2026-01-05')
  expect(dayKey(new Date('2026-10-20T22:30:00.000Z'))).toBe('2026-10-21') // 00:30 MESZ
})
test('streak survives the DST switch', () => {
  const ss = [s(d(2026, 3, 28, 23, 30)), s(d(2026, 3, 29, 9)), s(d(2026, 3, 30, 9))]
  expect(streak(ss, d(2026, 3, 30, 20))).toBe(3)
  expect(streak(ss, d(2026, 3, 30, 0, 30))).toBe(3) // 24 h früher wäre der 28. statt des 29.
})
test('streak survives the end of DST (25-hour day)', () => {
  const ss = [s(d(2026, 10, 24, 0, 30)), s(d(2026, 10, 25, 23, 30)), s(d(2026, 10, 26, 0, 30))]
  expect(streak(ss, d(2026, 10, 26, 12))).toBe(3)
  expect(streak(ss, d(2026, 10, 27, 0, 5))).toBe(3) // heute leer, gestern zählt
  expect(streak(ss, d(2026, 10, 26, 23, 30))).toBe(3) // 48 h früher wäre wieder der 25. statt des 24.
})
test('streak crosses month and year boundaries', () => {
  const ss = [s(d(2025, 12, 30)), s(d(2025, 12, 31)), s(d(2026, 1, 1))]
  expect(streak(ss, d(2026, 1, 1, 21))).toBe(3)
})
test('totals and calendar days', () => {
  expect(totalMinutes([s(d(2026, 10, 1), 90), s(d(2026, 10, 2), 61)])).toBe(2)
  expect([...daysInMonth([s(d(2026, 10, 1)), s(d(2026, 10, 1, 20)), s(d(2026, 11, 3))], 2026, 9)]).toEqual([1])
})
test('totals sum seconds before rounding down', () => {
  expect(totalMinutes([])).toBe(0)
  expect(totalMinutes([s(d(2026, 10, 1), 59)])).toBe(0)
  expect(totalMinutes([s(d(2026, 10, 1), 59), s(d(2026, 10, 2), 59)])).toBe(1) // 118 s
})
test('calendar days respect month, year and local midnight', () => {
  const ss = [s(d(2026, 10, 31, 23, 59)), s(d(2026, 11, 1, 0, 1)), s(d(2025, 10, 15)), s(d(2026, 10, 15))]
  expect([...daysInMonth(ss, 2026, 9)].sort((a, b) => a - b)).toEqual([15, 31])
  expect([...daysInMonth(ss, 2026, 10)]).toEqual([1])
  expect(daysInMonth([], 2026, 9).size).toBe(0)
})
test('minimum session length', () => expect(MIN_SECONDS).toBe(60))
