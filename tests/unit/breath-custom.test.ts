import { describe, expect, test } from 'vitest'
import {
  CUSTOM_PATTERN_ID,
  customTitle,
  customToPattern,
  cyclePreview,
  defaultCustomPattern,
  newCustomPatternId,
  parseCustomPattern,
  resolvePattern,
  secondsLabel,
  stepSeconds,
  type CustomBreathPattern,
} from '../../src/lib/breath/custom'
import { patternById } from '../../src/lib/breath/patterns'

const custom = (overrides: Partial<CustomBreathPattern> = {}): CustomBreathPattern => ({
  id: 'eigen-0123abcd',
  name: 'Abendruhe',
  inhale: 4,
  holdIn: 2,
  exhale: 6,
  holdOut: 0,
  ...overrides,
})

describe('customToPattern', () => {
  test('vier Phasen, 0-s-Phasen entfallen', () => {
    const p = customToPattern(custom())
    expect(p.phases).toEqual([{ kind: 'ein', seconds: 4 }, { kind: 'halten', seconds: 2 }, { kind: 'aus', seconds: 6 }])
    expect(p.description).toBe('Einatmen 4 s · Halten 2 s · Ausatmen 6 s')
    expect(customToPattern(custom({ inhale: 4.5, holdIn: 0, exhale: 5.5 })).description).toBe('Einatmen 4,5 s · Ausatmen 5,5 s')
    const box = customToPattern(custom({ inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 }))
    expect(box.phases.map((phase) => phase.kind)).toEqual(['ein', 'halten', 'aus', 'halten'])
    expect(box.description).toBe('Einatmen 4 s · Halten 4 s · Ausatmen 4 s · Halten 4 s')
  })

  test('Titel: getrimmter Name oder „Eigenes Muster“, Kennung bleibt', () => {
    expect(customTitle(custom({ name: '  Abendruhe ' }))).toBe('Abendruhe')
    expect(customTitle(custom({ name: '' }))).toBe('Eigenes Muster')
    expect(customTitle(custom({ name: '   ' }))).toBe('Eigenes Muster')
    const p = customToPattern(custom({ name: ' Morgen ' }))
    expect([p.id, p.title, p.effect]).toEqual(['eigen-0123abcd', 'Morgen', 'Eigener Rhythmus'])
  })
})

test('stepSeconds: 0,5er-Schritte, an den Grenzen bleibt der Wert', () => {
  expect(stepSeconds('inhale', 4, 1)).toBe(4.5)
  expect(stepSeconds('inhale', 4, -1)).toBe(3.5)
  expect(stepSeconds('inhale', 2, -1)).toBe(2)
  expect(stepSeconds('inhale', 15, 1)).toBe(15)
  expect(stepSeconds('holdIn', 0, -1)).toBe(0)
  expect(stepSeconds('holdIn', 0, 1)).toBe(0.5)
  expect(stepSeconds('exhale', 20, 1)).toBe(20)
  expect(stepSeconds('holdOut', 20, 1)).toBe(20)
})

describe('parseCustomPattern', () => {
  test('ein gültiges Muster bleibt, ein langer Name wird gekürzt', () => {
    expect(parseCustomPattern(custom())).toEqual(custom())
    expect(parseCustomPattern(custom({ name: 'x'.repeat(40) }))).toEqual(custom({ name: 'x'.repeat(30) }))
    expect(parseCustomPattern(custom({ name: '' }))).toEqual(custom({ name: '' }))
  })

  test('ungültig: Name kein Text, falsche Kennung, Zahl außerhalb, kein Vielfaches von 0,5, Text, NaN', () => {
    const invalid: unknown[] = [
      null,
      'eigen-0123abcd',
      { ...custom(), name: 3 },
      custom({ id: 'eigen-xyz' }),
      custom({ id: '478' }),
      custom({ inhale: 1.5 }),
      custom({ inhale: 15.5 }),
      custom({ holdIn: -0.5 }),
      custom({ exhale: 21 }),
      custom({ holdOut: 20.5 }),
      custom({ inhale: 4.2 }),
      { ...custom(), exhale: 'sechs' },
      custom({ holdIn: Number.NaN }),
      { ...custom(), holdOut: undefined },
    ]
    for (const raw of invalid) expect(parseCustomPattern(raw), JSON.stringify(raw)).toBeNull()
  })
})

test('cyclePreview: Dauer eines Atemzugs und Atemzüge pro Minute', () => {
  expect(cyclePreview(custom())).toBe('Ein Atemzug dauert 12 s, etwa 5 pro Minute.')
  expect(cyclePreview(custom({ inhale: 4, holdIn: 7, exhale: 8 }))).toBe('Ein Atemzug dauert 19 s, etwa 3,2 pro Minute.')
  expect(cyclePreview(custom({ inhale: 5.5, holdIn: 0, exhale: 5.5 }))).toBe('Ein Atemzug dauert 11 s, etwa 5,5 pro Minute.')
  expect(cyclePreview(custom({ inhale: 5, holdIn: 1.5, exhale: 6 }))).toBe('Ein Atemzug dauert 12,5 s, etwa 4,8 pro Minute.')
})

test('secondsLabel mit Komma', () => {
  expect([secondsLabel(4), secondsLabel(5.5), secondsLabel(0)]).toEqual(['4 s', '5,5 s', '0 s'])
})

test('newCustomPatternId: Form eigen- und 8 Hex-Zeichen, jedes Mal neu', () => {
  const a = newCustomPatternId()
  const b = newCustomPatternId()
  expect(a).toMatch(CUSTOM_PATTERN_ID)
  expect(b).toMatch(CUSTOM_PATTERN_ID)
  expect(a).not.toBe(b)
})

test('defaultCustomPattern: leerer Name, 4-2-6-0', () => {
  expect(defaultCustomPattern('eigen-0123abcd')).toEqual(custom({ name: '' }))
})

test('resolvePattern: fest, eigen oder unbekannt', () => {
  expect(resolvePattern('box', [])).toBe(patternById('box'))
  expect(resolvePattern('eigen-0123abcd', [custom()])).toEqual(customToPattern(custom()))
  expect(resolvePattern('eigen-ffffffff', [custom()])).toBeNull()
  expect(resolvePattern('gibt-es-nicht', [custom()])).toBeNull()
})
