import { test, expect } from 'vitest'
import { durationLabel, FALLBACK_ID, meditationById } from '../../src/lib/content/catalog'
import { lastUsedCard, lastUsedStart, lastUsedSummary, streakLine } from '../../src/lib/ui/heute-view'
import type { ProgramSpec } from '../../src/lib/audio/program'
import type { LastUsed } from '../../src/lib/stats/schema'

test('streak line: days in a row, singular for one, an invitation for none', () => {
  expect(streakLine(0)).toBe('Heute ist ein guter Tag zum Anfangen.')
  expect(streakLine(1)).toBe('1 Tag in Folge')
  expect(streakLine(2)).toBe('2 Tage in Folge')
  expect(streakLine(3)).toBe('3 Tage in Folge')
  expect(streakLine(365)).toBe('365 Tage in Folge')
})

const timer = (over: Partial<Extract<LastUsed, { kind: 'timer' }>> = {}): LastUsed => ({
  kind: 'timer',
  minutes: 20,
  intervalMin: 5,
  sound: 'regen',
  lead: true,
  ...over,
})

// Das Programm, das „Erneut starten“ für diese Sitzung startet.
function programOf(last: LastUsed): ProgramSpec {
  const start = lastUsedStart(last)
  if (start.kind !== 'program') throw new Error(`erwartet: Programm, war: ${start.kind}`)
  return start.spec
}

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
  const program = programOf(timer({ minutes: 5, intervalMin: 2, sound: 'regen', lead: false }))
  expect(program).toMatchObject({ kind: 'timer', ref: 'timer', title: 'Meditation · 5 Min', background: 'regen' })
  // Ohne Vorlauf beginnt die gezählte Dauer sofort: 5 Min, Ausklingen danach.
  expect(program.lead).toBe(0)
  expect(program.length).toBe(300)

  const withLead = programOf(timer({ minutes: 20, intervalMin: null, sound: null, lead: true }))
  expect(withLead).toMatchObject({ title: 'Meditation · 20 Min', background: null, lead: 10, length: 1200 })
})

test('restarting a timer clamps stored minutes like any input', () => {
  expect(programOf(timer({ minutes: 500 })).length).toBe(120 * 60)
})

test('restarting a breathing exercise rebuilds the same exercise and duration', () => {
  const program = programOf({ kind: 'breath', pattern: 'box', minutes: 5 })
  expect(program).toMatchObject({ kind: 'breath', ref: 'box', title: 'Atmen · Box-Atmung', lead: 0, background: null })
  // 5 Min = 300 s → 19 Zyklen à 16 s (der laufende Zyklus wird zu Ende geführt).
  expect(program.length).toBe(19 * 16)

  expect(programOf({ kind: 'breath', pattern: 'kohaerent', minutes: 3 }).length).toBe(17 * 11)
})

const GUIDED_ID = 'drei-minuten-atempause'

test('last used: a guided meditation reads „Titel · n Min“ with the length of its file', () => {
  const m = meditationById(GUIDED_ID)!
  expect(lastUsedSummary({ kind: 'guided', id: GUIDED_ID })).toBe(`${m.title} · ${durationLabel(m)}`)
  expect(lastUsedSummary({ kind: 'guided', id: GUIDED_ID })).toMatch(/^Drei-Minuten-Atempause · \d+ Min$/)
  // Die Dauer kommt aus der Datei, nicht aus einer festen Zahl.
  expect(lastUsedSummary({ kind: 'guided', id: FALLBACK_ID })).toMatch(/^Ankommen im Atem · \d+ Min$/)
})

test('last used: an unknown guided meditation falls back to „Ankommen im Atem“', () => {
  const fallback = meditationById(FALLBACK_ID)!
  expect(lastUsedSummary({ kind: 'guided', id: 'gibt-es-nicht' })).toBe(`${fallback.title} · ${durationLabel(fallback)}`)
  expect(lastUsedStart({ kind: 'guided', id: 'gibt-es-nicht' })).toEqual({ kind: 'guided', meditation: fallback })
})

test('restarting a guided meditation starts the meditation of the catalog', () => {
  const start = lastUsedStart({ kind: 'guided', id: GUIDED_ID })
  expect(start).toEqual({ kind: 'guided', meditation: meditationById(GUIDED_ID) })
})

test('restarting a timer or an exercise starts a program', () => {
  expect(lastUsedStart(timer({ minutes: 5 })).kind).toBe('program')
  expect(lastUsedStart({ kind: 'breath', pattern: 'box', minutes: 5 }).kind).toBe('program')
})

test('the card „Zuletzt genutzt“ without a session offers „Ankommen im Atem“ to start', () => {
  const card = lastUsedCard(undefined)
  const fallback = meditationById(FALLBACK_ID)!
  expect(card.last).toEqual({ kind: 'guided', id: FALLBACK_ID })
  expect(card.summary).toBe(`${fallback.title} · ${durationLabel(fallback)}`)
  // Es gibt noch nichts zu wiederholen.
  expect(card.action).toBe('Jetzt starten')
})

test('the card „Zuletzt genutzt“ falls back, too, when the stored meditation is unknown', () => {
  const card = lastUsedCard({ kind: 'guided', id: 'gibt-es-nicht' })
  expect(card.last).toEqual({ kind: 'guided', id: FALLBACK_ID })
  expect(card.summary).toMatch(/^Ankommen im Atem · \d+ Min$/)
  expect(card.action).toBe('Jetzt starten')
})

test('the card „Zuletzt genutzt“ keeps a known session and offers to start it again', () => {
  const guided: LastUsed = { kind: 'guided', id: GUIDED_ID }
  expect(lastUsedCard(guided)).toEqual({ last: guided, summary: lastUsedSummary(guided), action: 'Erneut starten' })

  const breath: LastUsed = { kind: 'breath', pattern: 'kohaerent', minutes: 3 }
  expect(lastUsedCard(breath)).toEqual({ last: breath, summary: 'Kohärentes Atmen · 3 Min', action: 'Erneut starten' })

  const stored = timer({ minutes: 5 })
  expect(lastUsedCard(stored)).toEqual({ last: stored, summary: 'Timer · 5 Min', action: 'Erneut starten' })
})
