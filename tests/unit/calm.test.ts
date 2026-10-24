process.env.TZ = 'Europe/Berlin'
import { test, expect } from 'vitest'
import { CALM_LEVELS, calmEffect, calmTrend } from '../../src/lib/stats/calm'
import type { CalmLevel, Session, SessionKind } from '../../src/lib/stats/schema'

// „Heute“ ist der 10.11.2026, 20 Uhr; 29 Tage zurück ist der 12.10., dazwischen liegt die Zeitumstellung am 25.10.
const NOW = new Date(2026, 10, 10, 20)
let n = 0
function s(daysBack: number, hour: number, kind: SessionKind, before?: CalmLevel, after?: CalmLevel): Session {
  const start = new Date(2026, 10, 10 - daysBack, hour)
  const session: Session = { id: `s${n++}`, start: start.toISOString(), kind, ref: kind === 'breath' ? 'box' : kind, seconds: 300 }
  if (before !== undefined || after !== undefined) session.calm = { ...(before && { before }), ...(after && { after }) }
  return session
}

test('timezone is Europe/Berlin (sonst prüft der Zeitumstellungs-Test nichts)', () => {
  expect([new Date(2026, 9, 24).getTimezoneOffset(), new Date(2026, 9, 26).getTimezoneOffset()]).toEqual([-120, -60])
})

test('CALM_LEVELS are the five words and colours of the spec', () => {
  expect(CALM_LEVELS.map((l) => [l.level, l.word, l.color])).toEqual([
    [1, 'sehr unruhig', '#E7A29A'],
    [2, 'etwas unruhig', '#E9B894'],
    [3, 'teils, teils', '#E6CF9A'],
    [4, 'ruhig', '#B9D3C0'],
    [5, 'ganz ruhig', '#8FD0D6'],
  ])
})

test('no effect below three pairs; sessions with one value do not count', () => {
  const sessions = [s(0, 8, 'breath', 2, 4), s(1, 8, 'breath', 1, 3), s(2, 8, 'breath', 2), s(3, 8, 'timer', undefined, 5), s(4, 8, 'timer', 1), s(5, 8, 'guided', undefined, 4)]
  expect(calmEffect(sessions, NOW)).toBeNull()
})

test('effect is the mean of after − before with its count', () => {
  const sessions = [s(0, 8, 'breath', 2, 4), s(1, 8, 'breath', 1, 2), s(2, 8, 'breath', 3, 3), s(3, 8, 'timer', 4)]
  expect(calmEffect(sessions, NOW)).toMatchObject({ mean: 1, count: 3 })
})

test('the window is today and the 29 days before, by calendar day, across the clock change', () => {
  const base = [s(0, 8, 'breath', 3, 3), s(1, 8, 'breath', 3, 3), s(2, 8, 'breath', 3, 3)]
  expect(calmEffect([...base, s(29, 23, 'breath', 1, 4)], NOW)).toMatchObject({ mean: 0.75, count: 4 })
  expect(calmEffect([...base, s(30, 23, 'breath', 1, 4)], NOW)).toMatchObject({ mean: 0, count: 3 })
})

test('sessions dated after today count nowhere', () => {
  const sessions = [s(0, 8, 'breath', 2, 3), s(1, 8, 'breath', 2, 3), s(2, 8, 'breath', 2, 3), s(35, 8, 'timer', 4), s(36, 8, 'timer', 4), s(37, 8, 'timer', 4)]
  const future = [s(-1, 8, 'breath', 1, 5), s(-5, 8, 'timer', 1, 5)]
  expect(calmEffect([...sessions, ...future], NOW)).toEqual(calmEffect(sessions, NOW))
  expect(calmTrend([...sessions, ...future], NOW)).toEqual(calmTrend(sessions, NOW))
})

test('the split needs three pairs per kind; timer and guided are both meditation', () => {
  const breath = [s(0, 8, 'breath', 2, 4), s(1, 8, 'breath', 2, 4), s(2, 8, 'breath', 2, 4)]
  const meditation = [s(3, 8, 'timer', 2, 3), s(4, 8, 'timer', 2, 3), s(5, 8, 'guided', 2, 3)]
  expect(calmEffect([...breath, ...meditation], NOW)).toEqual({ mean: 1.5, count: 6, breath: 2, meditation: 1 })
  expect(calmEffect([...breath.slice(1), ...meditation], NOW)).toEqual({ mean: 1.4, count: 5, breath: null, meditation: 1 })
})

test('trend compares the before values of both windows, each needing three', () => {
  const recent = [s(0, 8, 'breath', 4), s(5, 8, 'timer', 3, 5), s(29, 8, 'guided', 5)]
  const previous = [s(30, 8, 'breath', 2), s(59, 8, 'timer', 3, 3)]
  expect(calmTrend([...recent, ...previous], NOW)).toBeNull()
  expect(calmTrend([...recent, ...previous, s(45, 8, 'breath', 1)], NOW)).toEqual({ recent: 4, previous: 2 })
  expect(calmTrend([...recent, ...previous, s(60, 8, 'breath', 1)], NOW)).toBeNull()
})
