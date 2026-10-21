import { test, expect } from 'vitest'
import { intervalLabel, savedTimer, timerDisplay, timerSummary } from '../../src/lib/meditation/timer-view'
import { emptyData, type Settings } from '../../src/lib/stats/schema'

const settings = (over: Partial<Settings> = {}): Settings => ({ ...emptyData().settings, ...over })

test('saved timer settings are read with clamped minutes', () => {
  expect(savedTimer(settings())).toEqual({ minutes: 10, intervalMin: null, sound: null, lead: true })
  expect(savedTimer(settings({ timer: { minutes: 25, intervalMin: 5 }, timerSound: 'regen', timerLead: false })))
    .toEqual({ minutes: 25, intervalMin: 5, sound: 'regen', lead: false })
  expect(savedTimer(settings({ timer: { minutes: 500, intervalMin: null } })).minutes).toBe(120)
  expect(savedTimer(settings({ timer: { minutes: 0, intervalMin: null } })).minutes).toBe(1)
  expect(savedTimer(settings({ timer: { minutes: Number.NaN, intervalMin: null } })).minutes).toBe(10)
})

test('interval labels', () => {
  expect([null, 1, 2, 5, 10].map(intervalLabel)).toEqual(['Aus', 'Jede Minute', 'Alle 2 Min', 'Alle 5 Min', 'Alle 10 Min'])
})

test('card summary', () => {
  expect(timerSummary({ minutes: 10, intervalMin: null, sound: null })).toBe('10 Min · ohne Zwischenschale')
  expect(timerSummary({ minutes: 20, intervalMin: 5, sound: null })).toBe('20 Min · Klangschale alle 5 Min')
  expect(timerSummary({ minutes: 5, intervalMin: 1, sound: null })).toBe('5 Min · Klangschale jede Minute')
  expect(timerSummary({ minutes: 30, intervalMin: 10, sound: 'regen' })).toBe('30 Min · Klangschale alle 10 Min · Regen')
  expect(timerSummary({ minutes: 45, intervalMin: null, sound: 'wald' })).toBe('45 Min · ohne Zwischenschale · Wald mit Vögeln')
})

test('display during the lead counts down 10 … 1 with an empty ring', () => {
  const p = { lead: 10, length: 300 }
  expect(timerDisplay(p, 0)).toEqual({ arriving: 10, remaining: 300, progress: 0 })
  expect(timerDisplay(p, 0.4).arriving).toBe(10)
  expect(timerDisplay(p, 9.2)).toEqual({ arriving: 1, remaining: 300, progress: 0 })
})

test('display after the lead shows the counted time and progress', () => {
  const p = { lead: 10, length: 300 }
  expect(timerDisplay(p, 10)).toEqual({ arriving: null, remaining: 300, progress: 0 })
  expect(timerDisplay(p, 160)).toEqual({ arriving: null, remaining: 150, progress: 0.5 })
  expect(timerDisplay(p, 320)).toEqual({ arriving: null, remaining: -10, progress: 1 })
  expect(timerDisplay({ lead: 0, length: 60 }, 15)).toEqual({ arriving: null, remaining: 45, progress: 0.25 })
})
