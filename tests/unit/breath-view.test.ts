import { test, expect } from 'vitest'
import { BREATH_PATTERNS, breathAt, breathPlan, type BreathMoment } from '../../src/lib/breath/patterns'
import { circleScale, phaseChanged } from '../../src/lib/breath/view'

const moment = (over: Partial<BreathMoment> = {}): BreathMoment => ({
  kind: 'ein',
  label: 'Einatmen',
  level: 0.5,
  phaseElapsed: 1,
  phaseLength: 4,
  secondsLeft: 3,
  done: false,
  ...over,
})

test('the circle scales between 0.6 and 1 with the breath level', () => {
  expect(circleScale(0)).toBeCloseTo(0.6)
  expect(circleScale(0.5)).toBeCloseTo(0.8)
  expect(circleScale(1)).toBeCloseTo(1)
})

test('the first frame is no phase change', () => {
  expect(phaseChanged(null, moment())).toBe(false)
})

test('the same phase on the next frame is no change', () => {
  expect(phaseChanged(moment({ phaseElapsed: 1 }), moment({ phaseElapsed: 1.02 }))).toBe(false)
  expect(phaseChanged(moment({ phaseElapsed: 1 }), moment({ phaseElapsed: 1 }))).toBe(false)
})

test('another kind or label is a change', () => {
  expect(phaseChanged(moment(), moment({ kind: 'halten', label: 'Halten', phaseElapsed: 0 }))).toBe(true)
  expect(phaseChanged(moment(), moment({ label: 'Nachatmen', phaseElapsed: 0 }))).toBe(true)
})

test('two equal phases in a row are told apart by the phase starting over', () => {
  expect(phaseChanged(moment({ phaseElapsed: 3.9 }), moment({ phaseElapsed: 0.1 }))).toBe(true)
})

test('every pattern changes phase exactly at its phase boundaries, once per boundary', () => {
  for (const pattern of BREATH_PATTERNS) {
    const { length, cues } = breathPlan(pattern.id, 1)
    let previous: BreathMoment | null = null
    let changes = 0
    // 60 Bilder pro Sekunde, bis zum Ende der Übung
    for (let t = 0; t < length; t += 1 / 60) {
      const next = breathAt(pattern.id, t, length)
      if (phaseChanged(previous, next)) changes++
      previous = next
    }
    // Jede Phase außer der ersten beginnt mit einem Wechsel.
    expect(changes, pattern.title).toBe(cues.length - 1)
  }
})
