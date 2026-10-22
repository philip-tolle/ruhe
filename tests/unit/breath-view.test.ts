import { test, expect } from 'vitest'
import { BREATH_PATTERNS, breathAt, breathPlan, patternById, type BreathMoment } from '../../src/lib/breath/patterns'
import { circleScale, easedLevel, petalOffset, phaseChanged, phaseColor, phaseProgress, rhythmLabel, vibrationPattern } from '../../src/lib/breath/view'

const moment = (over: Partial<BreathMoment> = {}): BreathMoment => ({
  kind: 'ein',
  label: 'Einatmen',
  level: 0.25,
  startLevel: 0,
  endLevel: 1,
  phaseElapsed: 1,
  phaseLength: 4,
  secondsLeft: 3,
  done: false,
  ...over,
})

test('the circle scales between 0.45 and 1 with the breath level', () => {
  expect(circleScale(0)).toBeCloseTo(0.45)
  expect(circleScale(0.5)).toBeCloseTo(0.725)
  expect(circleScale(1)).toBeCloseTo(1)
})

test('the eased level starts and ends with its phase and passes the middle halfway', () => {
  expect(easedLevel(moment({ phaseElapsed: 0 }))).toBe(0)
  expect(easedLevel(moment({ phaseElapsed: 2 }))).toBeCloseTo(0.5)
  expect(easedLevel(moment({ phaseElapsed: 4 }))).toBeCloseTo(1)
  // start + (end − start) · (1 − cos(π·p)) / 2
  expect(easedLevel(moment({ phaseElapsed: 1 }))).toBeCloseTo((1 - Math.cos(Math.PI / 4)) / 2)
  expect(easedLevel(moment({ kind: 'aus', startLevel: 1, endLevel: 0, phaseElapsed: 1 }))).toBeCloseTo(1 - (1 - Math.cos(Math.PI / 4)) / 2)
  expect(easedLevel(moment({ startLevel: 0.8, endLevel: 1, phaseElapsed: 0.5, phaseLength: 1 }))).toBeCloseTo(0.9)
})

test('the eased level moves gently at the edges of a phase and rests while holding', () => {
  const linear = (m: BreathMoment) => m.startLevel + (m.endLevel - m.startLevel) * (m.phaseElapsed / m.phaseLength)
  for (const t of [0.2, 0.6]) {
    const rising = moment({ phaseElapsed: t })
    const falling = moment({ kind: 'aus', startLevel: 1, endLevel: 0, phaseElapsed: t })
    expect(easedLevel(rising)).toBeLessThan(linear(rising))
    expect(easedLevel(falling)).toBeGreaterThan(linear(falling))
  }
  expect(easedLevel(moment({ phaseElapsed: 3.8 }))).toBeGreaterThan(linear(moment({ phaseElapsed: 3.8 })))
  for (const t of [0, 1.3, 4]) expect(easedLevel(moment({ kind: 'halten', startLevel: 1, endLevel: 1, phaseElapsed: t }))).toBe(1)
})

test('the eased level follows the patterns without jumps, also across phase boundaries', () => {
  const bad: string[] = []
  for (const pattern of BREATH_PATTERNS) {
    const { cycle, length } = breathPlan(pattern.id, 1)
    let previous: number | null = null
    // 60 Bilder pro Sekunde, bis zum Ende der Übung
    for (let i = 0; i <= length * 60; i++) {
      const t = i / 60
      const m = breathAt(pattern.id, t, length)
      const level = easedLevel(m)
      if (level < 0 || level > 1) bad.push(`${pattern.id} t=${t}: ${level}`)
      if (previous !== null && Math.abs(level - previous) > 0.01) bad.push(`${pattern.id} t=${t}: ${previous} → ${level}`)
      previous = level
    }
    expect(easedLevel(breathAt(pattern.id, 0, length)), pattern.title).toBe(0)
    expect(easedLevel(breathAt(pattern.id, cycle - 1e-9, length)), pattern.title).toBeCloseTo(0, 6)
    expect(easedLevel(breathAt(pattern.id, length, length)), pattern.title).toBeCloseTo(0, 9)
  }
  expect(bad).toEqual([])
})

test('the phase ring fills with the phase and starts over with the next one', () => {
  expect(phaseProgress(breathAt('478', 0, 76))).toBe(0)
  expect(phaseProgress(breathAt('478', 2, 76))).toBeCloseTo(0.5)
  expect(phaseProgress(breathAt('478', 4, 76))).toBe(0) // Halten beginnt
  expect(phaseProgress(breathAt('478', 7.5, 76))).toBeCloseTo(0.5)
  expect(phaseProgress(breathAt('478', 76, 76))).toBe(1) // fertig: Ring voll
  expect(phaseProgress(moment({ phaseElapsed: 5 }))).toBe(1)
  expect(phaseProgress(moment({ phaseElapsed: -1 }))).toBe(0)
})

test('each phase has its own colour: lavender, gold, teal', () => {
  expect(phaseColor('ein')).toBe('#B7A8F0')
  expect(phaseColor('halten')).toBe('#F2C98A')
  expect(phaseColor('aus')).toBe('#8FD0D6')
})

test('rhythm labels join equal phases in a row with + and the others with -, with a decimal comma', () => {
  const label = (id: Parameters<typeof patternById>[0]) => rhythmLabel(patternById(id))
  expect(label('478')).toBe('4-7-8')
  expect(label('box')).toBe('4-4-4-4')
  expect(label('kohaerent')).toBe('5,5-5,5')
  expect(label('langes-ausatmen')).toBe('4-6')
  expect(label('seufzer')).toBe('3+1-6')
  expect(label('wechselatmung')).toBe('4-4-4-4')
})

test('the petals sit 0.04 inside at rest and 0.13 outside when fully open', () => {
  expect(petalOffset(0)).toBeCloseTo(0.04, 9)
  expect(petalOffset(1)).toBeCloseTo(-0.13, 9)
  expect(petalOffset(0.5)).toBeCloseTo(-0.045, 9)
  // 0.04 − 0.17 · level: Je weiter geöffnet, desto weiter nach außen (negativ).
  expect(petalOffset(0.25)).toBeCloseTo(0.04 - 0.17 * 0.25, 9)
})

test('each phase has its own vibration: one pulse, a short tap, two pulses', () => {
  expect(vibrationPattern('ein')).toEqual([200])
  expect(vibrationPattern('halten')).toEqual([60])
  expect(vibrationPattern('aus')).toEqual([150, 120, 150])
  // Nachatmen beim Seufzer ist eine Phase der Art „ein“.
  expect(vibrationPattern(breathAt('seufzer', 3.5, 60).kind)).toEqual([200])
  // Jeder Aufruf gibt ein eigenes Muster zurück; Ändern eines Ergebnisses ändert die nächsten nicht.
  vibrationPattern('aus').push(999)
  expect(vibrationPattern('aus')).toEqual([150, 120, 150])
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
