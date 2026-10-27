import { describe, expect, test } from 'vitest'
import { focusSprintFrom, hackRunFrom, MIN_HACK_SECONDS, MIN_SPRINT_SECONDS } from '../../src/lib/energy/record'
import { BEFORE_HOURS, beforeLevel } from '../../src/lib/energy/insights'
import type { EnergyCheckin, SessionResult } from '../../src/lib/stats/schema'

const START = new Date('2026-10-21T12:00:00.000Z')
const minutesBefore = (min: number) => new Date(START.getTime() - min * 60_000).toISOString()
const checkin = (id: string, at: string, gefuehl: 1 | 2 | 3 | 4 | 5): EnergyCheckin => ({ id, at, levels: { koerper: 3, gefuehl, geist: 3, sinn: 3 } })
const hack = (seconds: number, ref = 'seufzer'): SessionResult => ({ kind: 'hack', ref, start: START, seconds })
const focus = (seconds: number, ref = 'focus-50', note?: string): SessionResult => ({ kind: 'focus', ref, start: START, seconds, ...(note === undefined ? {} : { note }) })

describe('Hack-Lauf ab 30 s', () => {
  test('die Grenzen', () => {
    expect(MIN_HACK_SECONDS).toBe(30)
    expect(hackRunFrom(hack(29.9), 'x', [])).toBeNull()
    expect(hackRunFrom(hack(30), 'x', [])).not.toBeNull()
    expect(hackRunFrom(hack(0), 'x', [])).toBeNull()
  })
  test('Sekunden abgerundet, Bereich aus dem Katalog, Beginn als ISO', () => {
    expect(hackRunFrom(hack(64.7), 'run-1', [])).toEqual({ id: 'run-1', at: '2026-10-21T12:00:00.000Z', hack: 'seufzer', area: 'gefuehl', seconds: 64 })
    expect(hackRunFrom(hack(120, 'tageslicht'), 'run-2', [])?.area).toBe('koerper')
  })
  test('ein unbekannter Hack oder ein unbrauchbarer Wert ergibt null', () => {
    expect(hackRunFrom(hack(64, 'gibt-es-nicht'), 'x', [])).toBeNull()
    expect(hackRunFrom(hack(NaN), 'x', [])).toBeNull()
    expect(hackRunFrom(hack(Infinity), 'x', [])).toBeNull()
    expect(hackRunFrom({ ...hack(64), start: new Date(NaN) }, 'x', [])).toBeNull()
  })
})

describe('Vorher aus dem Check-in', () => {
  test('1 Std. 59 Min davor zählt', () => {
    expect(BEFORE_HOURS).toBe(2)
    const run = hackRunFrom(hack(64), 'x', [checkin('c', minutesBefore(119), 2)])
    expect(run?.before).toBe(2)
  })
  test('2 Std. 1 Min davor ergibt kein before (auch kein Schlüssel)', () => {
    const run = hackRunFrom(hack(64), 'x', [checkin('c', minutesBefore(121), 2)])
    expect(run).not.toBeNull()
    expect(run).not.toHaveProperty('before')
  })
  test('ein Check-in nach dem Start zählt nicht', () => {
    const run = hackRunFrom(hack(64), 'x', [checkin('c', minutesBefore(-1), 2)])
    expect(run).not.toHaveProperty('before')
  })
  test('bei mehreren gilt der jüngste vor dem Start, in jeder Reihenfolge', () => {
    const old = checkin('a', minutesBefore(90), 1)
    const recent = checkin('b', minutesBefore(10), 4)
    const later = checkin('c', minutesBefore(-5), 5)
    expect(hackRunFrom(hack(64), 'x', [old, recent, later])?.before).toBe(4)
    expect(hackRunFrom(hack(64), 'x', [later, recent, old])?.before).toBe(4)
  })
  test('es zählt der Bereich des Hacks', () => {
    const c: EnergyCheckin = { id: 'c', at: minutesBefore(5), levels: { koerper: 5, gefuehl: 1, geist: 2, sinn: 3 } }
    expect(hackRunFrom(hack(64, 'seufzer'), 'x', [c])?.before).toBe(1)
    expect(hackRunFrom(hack(64, 'tageslicht'), 'x', [c])?.before).toBe(5)
  })
  test('beforeLevel: genau 2 Std. davor und genau beim Start zählen, ohne Check-ins null', () => {
    expect(beforeLevel([checkin('a', minutesBefore(120), 3)], 'gefuehl', START)).toBe(3)
    expect(beforeLevel([checkin('a', START.toISOString(), 4)], 'gefuehl', START)).toBe(4)
    expect(beforeLevel([], 'gefuehl', START)).toBeNull()
    expect(beforeLevel([checkin('a', minutesBefore(5), 3)], 'gefuehl', new Date(NaN))).toBeNull()
  })
})

describe('Sprint ab 300 s', () => {
  test('die Grenzen', () => {
    expect(MIN_SPRINT_SECONDS).toBe(300)
    expect(focusSprintFrom(focus(299), 'x')).toBeNull()
    expect(focusSprintFrom(focus(300), 'x')).toEqual({ id: 'x', at: '2026-10-21T12:00:00.000Z', planned: 50, seconds: 300 })
    expect(focusSprintFrom(focus(NaN), 'x')).toBeNull()
    expect(focusSprintFrom({ ...focus(600), start: new Date(NaN) }, 'x')).toBeNull()
  })
  test('geplante Dauer aus ref, Aufgabe aus note: getrimmt, Sekunden abgerundet', () => {
    expect(focusSprintFrom(focus(3000.4, 'focus-90', '  Kurskonzept  '), 'id-1')).toEqual({ id: 'id-1', at: '2026-10-21T12:00:00.000Z', planned: 90, seconds: 3000, task: 'Kurskonzept' })
    expect(focusSprintFrom(focus(600, 'focus-25'), 'x')?.planned).toBe(25)
  })
  test('eine leere Aufgabe entfällt, eine lange wird auf 80 Zeichen gekürzt', () => {
    expect(focusSprintFrom(focus(600, 'focus-50', '   '), 'x')).not.toHaveProperty('task')
    expect(focusSprintFrom(focus(600, 'focus-50', ''), 'x')).not.toHaveProperty('task')
    expect(focusSprintFrom(focus(600, 'focus-50', 'a'.repeat(120)), 'x')?.task).toBe('a'.repeat(80))
    // Gezählt werden Zeichen, kein Ersatzpaar wird zerrissen.
    expect(focusSprintFrom(focus(600, 'focus-50', 'a'.repeat(79) + '😀😀'), 'x')?.task).toBe('a'.repeat(79) + '😀')
  })
  test('ein anderes ref ergibt null', () => {
    for (const ref of ['focus-40', 'focus', 'focus-', 'focus-050', 'focus-50x', 'timer', '']) expect(focusSprintFrom(focus(600, ref), 'x')).toBeNull()
  })
})
