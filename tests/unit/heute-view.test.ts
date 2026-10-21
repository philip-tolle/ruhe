import { test, expect } from 'vitest'
import { lastUsedProgram, lastUsedSummary, streakLine, type ProgramLastUsed } from '../../src/lib/ui/heute-view'
import type { LastUsed } from '../../src/lib/stats/schema'

test('streak line: days in a row, singular for one, an invitation for none', () => {
  expect(streakLine(0)).toBe('Heute ist ein guter Tag zum Anfangen.')
  expect(streakLine(1)).toBe('1 Tag in Folge')
  expect(streakLine(2)).toBe('2 Tage in Folge')
  expect(streakLine(3)).toBe('3 Tage in Folge')
  expect(streakLine(365)).toBe('365 Tage in Folge')
})

const timer = (over: Partial<Extract<LastUsed, { kind: 'timer' }>> = {}): ProgramLastUsed => ({
  kind: 'timer',
  minutes: 20,
  intervalMin: 5,
  sound: 'regen',
  lead: true,
  ...over,
})

test('last used: a timer reads „Timer · n Min“', () => {
  expect(lastUsedSummary(timer())).toBe('Timer · 20 Min')
  expect(lastUsedSummary(timer({ minutes: 1, intervalMin: null, sound: null, lead: false }))).toBe('Timer · 1 Min')
})

test('last used: a breathing exercise reads „Übung · n Min“ with the title of the pattern', () => {
  expect(lastUsedSummary({ kind: 'breath', pattern: '478', minutes: 1 })).toBe('4-7-8 · 1 Min')
  expect(lastUsedSummary({ kind: 'breath', pattern: 'kohaerent', minutes: 3 })).toBe('Kohärentes Atmen · 3 Min')
  expect(lastUsedSummary({ kind: 'breath', pattern: 'seufzer', minutes: 10 })).toBe('Physiologischer Seufzer · 10 Min')
})

test('last used: the text shows the minutes that actually start', () => {
  // Gespeicherte Minuten laufen wie jede Eingabe durch clampMinutes (1 … 120).
  expect(lastUsedSummary(timer({ minutes: 500 }))).toBe('Timer · 120 Min')
  expect(lastUsedSummary(timer({ minutes: 0.2 }))).toBe('Timer · 1 Min')
})

test('restarting a timer rebuilds exactly the stored settings', () => {
  const program = lastUsedProgram(timer({ minutes: 5, intervalMin: 2, sound: 'regen', lead: false }))
  expect(program).toMatchObject({ kind: 'timer', ref: 'timer', title: 'Meditation · 5 Min', background: 'regen' })
  // Ohne Vorlauf beginnt die gezählte Dauer sofort: 5 Min, Ausklingen danach.
  expect(program.lead).toBe(0)
  expect(program.length).toBe(300)

  const withLead = lastUsedProgram(timer({ minutes: 20, intervalMin: null, sound: null, lead: true }))
  expect(withLead).toMatchObject({ title: 'Meditation · 20 Min', background: null, lead: 10, length: 1200 })
})

test('restarting a timer clamps stored minutes like any input', () => {
  expect(lastUsedProgram(timer({ minutes: 500 })).length).toBe(120 * 60)
})

test('restarting a breathing exercise rebuilds the same exercise and duration', () => {
  const program = lastUsedProgram({ kind: 'breath', pattern: 'box', minutes: 5 })
  expect(program).toMatchObject({ kind: 'breath', ref: 'box', title: 'Atmen · Box-Atmung', lead: 0, background: null })
  // 5 Min = 300 s → 19 Zyklen à 16 s (der laufende Zyklus wird zu Ende geführt).
  expect(program.length).toBe(19 * 16)

  expect(lastUsedProgram({ kind: 'breath', pattern: 'kohaerent', minutes: 3 }).length).toBe(17 * 11)
})
