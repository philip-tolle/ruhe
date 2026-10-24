import { test, expect } from 'vitest'
import { BREATH_PATTERNS, BREATH_MINUTES, breathPlan, breathAt, patternById, PHASE_LABEL } from '../../src/lib/breath/patterns'
import { customToPattern } from '../../src/lib/breath/custom'

test('patterns', () => {
  expect(BREATH_PATTERNS.map(p => p.title)).toEqual(['4-7-8', 'Box-Atmung', 'Kohärentes Atmen', 'Langes Ausatmen', 'Physiologischer Seufzer', 'Wechselatmung'])
  expect(PHASE_LABEL).toEqual({ ein: 'Einatmen', halten: 'Halten', aus: 'Ausatmen' })
})
test('new patterns: lengths, labels and circle level', () => {
  expect(breathPlan('langes-ausatmen', 3).length).toBe(180)
  expect([breathPlan('seufzer', 1).cycle, breathPlan('seufzer', 1).length]).toEqual([10, 60])
  expect(breathPlan('wechselatmung', 1).length).toBe(64)
  expect(breathAt('seufzer', 1.5, 60)).toMatchObject({ kind: 'ein', label: 'Einatmen', level: expect.closeTo(0.4) })
  expect(breathAt('seufzer', 3.5, 60)).toMatchObject({ kind: 'ein', label: 'Nachatmen', level: expect.closeTo(0.9) })
  expect(breathAt('seufzer', 7, 60)).toMatchObject({ kind: 'aus', label: 'Ausatmen', level: expect.closeTo(0.5) })
  expect([1, 5, 9, 13].map(t => breathAt('wechselatmung', t, 64).label)).toEqual(['Links einatmen', 'Rechts ausatmen', 'Rechts einatmen', 'Links ausatmen'])
  expect([breathAt('box', 6, 64).level, breathAt('box', 14, 64).level]).toEqual([1, 0]) // Halten nach ein bzw. aus
})
test('plans finish the running cycle', () => {
  const p = breathPlan('478', 1)
  expect([p.cycle, p.cycles, p.length]).toEqual([19, 4, 76])
  expect(p.cues.slice(0, 4)).toEqual([{ at: 0, kind: 'ein' }, { at: 4, kind: 'halten' }, { at: 11, kind: 'aus' }, { at: 19, kind: 'ein' }])
  expect(p.cues).toHaveLength(12)
  expect(breathPlan('kohaerent', 3).length).toBe(187)
  expect(breathPlan('box', 10).length).toBe(608)
})
test('moment at a point in time', () => {
  expect(breathAt('478', 5, 76)).toEqual({ kind: 'halten', label: 'Halten', level: 1, startLevel: 1, endLevel: 1, phaseElapsed: 1, phaseLength: 7, secondsLeft: 6, done: false })
  expect(breathAt('kohaerent', -2, 187)).toMatchObject({ kind: 'ein', phaseElapsed: 0, done: false })
  expect(breathAt('478', 76, 76)).toMatchObject({ done: true })
})

test('pattern list: texts, order of ids, lookup and minutes', () => {
  expect(BREATH_PATTERNS.map(p => p.id)).toEqual(['478', 'box', 'kohaerent', 'langes-ausatmen', 'seufzer', 'wechselatmung'])
  expect(BREATH_PATTERNS.map(p => p.description)).toEqual([
    'Einatmen 4 s · Halten 7 s · Ausatmen 8 s',
    'Einatmen 4 s · Halten 4 s · Ausatmen 4 s · Halten 4 s',
    'Einatmen 5,5 s · Ausatmen 5,5 s',
    'Einatmen 4 s · Ausatmen 6 s',
    'Einatmen 3 s · kurz Nachatmen 1 s · langsam Ausatmen 6 s',
    'Je 4 s: links ein · rechts aus · rechts ein · links aus. Das andere Nasenloch hältst du mit dem Finger zu.',
  ])
  expect(BREATH_PATTERNS.map(p => p.phases.map(ph => ph.seconds))).toEqual([[4, 7, 8], [4, 4, 4, 4], [5.5, 5.5], [4, 6], [3, 1, 6], [4, 4, 4, 4]])
  expect(patternById('box').title).toBe('Box-Atmung')
  expect(BREATH_MINUTES).toEqual([1, 3, 5, 10])
})

test('every pattern has its effect', () => {
  expect(BREATH_PATTERNS.map(p => [p.id, p.effect])).toEqual([
    ['478', 'Einschlafen'],
    ['box', 'Konzentration'],
    ['kohaerent', 'Balance'],
    ['langes-ausatmen', 'Entspannung'],
    ['seufzer', 'Schnell beruhigen'],
    ['wechselatmung', 'Ausgleich'],
  ])
})

test('plan cues: one per phase start, also for fractional phases', () => {
  const p = breathPlan('kohaerent', 1)
  expect([p.cycle, p.cycles, p.length]).toEqual([11, 6, 66])
  expect(p.cues.slice(0, 4)).toEqual([{ at: 0, kind: 'ein' }, { at: 5.5, kind: 'aus' }, { at: 11, kind: 'ein' }, { at: 16.5, kind: 'aus' }])
  expect(p.cues).toHaveLength(12)
  expect(breathPlan('box', 1).cues.map(c => c.kind).slice(0, 5)).toEqual(['ein', 'halten', 'aus', 'halten', 'ein'])
})

test('a time exactly on a phase boundary belongs to the next phase, also after many cycles', () => {
  const { cycles, length } = breathPlan('kohaerent', 10)
  expect(cycles).toBe(55)
  for (let c = 0; c < cycles; c++) {
    expect(breathAt('kohaerent', c * 11, length)).toMatchObject({ kind: 'ein', phaseElapsed: 0, secondsLeft: 6 })
    expect(breathAt('kohaerent', c * 11 + 5.5, length)).toMatchObject({ kind: 'aus', phaseElapsed: 0, secondsLeft: 6 })
  }
  expect(breathAt('478', 4, 76)).toMatchObject({ kind: 'halten', phaseElapsed: 0, secondsLeft: 7 })
  expect(breathAt('478', 19, 76)).toMatchObject({ kind: 'ein', phaseElapsed: 0, secondsLeft: 4 })
})

test('countdown rounds up and never exceeds the phase length', () => {
  expect(breathAt('478', 10.2, 76)).toMatchObject({ kind: 'halten', secondsLeft: 1 })
  expect(breathAt('kohaerent', 0.1, 187)).toMatchObject({ kind: 'ein', secondsLeft: 6 }) // ceil(5,4)
  expect(breathAt('kohaerent', 5.4, 187)).toMatchObject({ kind: 'ein', secondsLeft: 1 })
})

test('sweep over all patterns: values stay in range', () => {
  const bad: string[] = []
  for (const p of BREATH_PATTERNS) {
    for (const minutes of BREATH_MINUTES) {
      const { cycle, cycles, length } = breathPlan(p.id, minutes)
      if (length !== cycles * cycle || length < minutes * 60 || length >= minutes * 60 + cycle) bad.push(`${p.id} ${minutes}: length ${length}`)
      for (let i = 0; i < length * 10; i++) {
        const t = i * 0.1 // 0,1 ist binär nicht exakt: Rundungsfehler an den Phasengrenzen sind gewollt
        const m = breathAt(p.id, t, length)
        const ok = !m.done && m.phaseElapsed >= 0 && m.phaseElapsed < m.phaseLength &&
          m.secondsLeft >= 1 && m.secondsLeft <= Math.ceil(m.phaseLength) && m.level >= 0 && m.level <= 1 &&
          m.startLevel >= 0 && m.startLevel <= 1 && m.endLevel >= 0 && m.endLevel <= 1
        if (!ok) bad.push(`${p.id} ${minutes} t=${t}: ${JSON.stringify(m)}`)
      }
    }
  }
  expect(bad).toEqual([])
})

test('every cycle starts and ends at level 0', () => {
  for (const p of BREATH_PATTERNS) {
    const { cycle, cycles, length } = breathPlan(p.id, 3)
    for (let c = 0; c < cycles; c++) {
      expect(breathAt(p.id, c * cycle, length).level).toBe(0)
      expect(breathAt(p.id, (c + 1) * cycle - 1e-9, length).level).toBeCloseTo(0, 6)
    }
  }
})

test('a moment knows the level at the start and at the end of its phase', () => {
  const ends = (id: Parameters<typeof breathAt>[0], t: number, length: number) => {
    const { label, startLevel, endLevel } = breathAt(id, t, length)
    return [label, startLevel, endLevel]
  }
  expect([2, 6, 15].map(t => ends('478', t, 76))).toEqual([['Einatmen', 0, 1], ['Halten', 1, 1], ['Ausatmen', 1, 0]])
  expect([2, 6, 10, 14].map(t => ends('box', t, 64))).toEqual([['Einatmen', 0, 1], ['Halten', 1, 1], ['Ausatmen', 1, 0], ['Halten', 0, 0]])
  expect([1, 3.5, 7].map(t => ends('seufzer', t, 60))).toEqual([['Einatmen', 0, 0.8], ['Nachatmen', 0.8, 1], ['Ausatmen', 1, 0]])
  // In jedem Zyklus wieder dieselben Stände.
  expect(ends('478', 19 * 3 + 6, 76)).toEqual(['Halten', 1, 1])
})

test('the linear level runs from the start level to the end level of the phase', () => {
  const bad: string[] = []
  for (const p of BREATH_PATTERNS) {
    const { length } = breathPlan(p.id, 1)
    for (let t = 0; t < length; t += 0.25) {
      const m = breathAt(p.id, t, length)
      const expected = m.startLevel + (m.endLevel - m.startLevel) * (m.phaseElapsed / m.phaseLength)
      if (!(Math.abs(m.level - expected) <= 1e-9)) bad.push(`${p.id} t=${t}: ${JSON.stringify(m)}`)
    }
  }
  expect(bad).toEqual([])
})

test('done: last phase, level 0, nothing left', () => {
  expect(breathAt('478', 76, 76)).toEqual({ kind: 'aus', label: 'Ausatmen', level: 0, startLevel: 1, endLevel: 0, phaseElapsed: 8, phaseLength: 8, secondsLeft: 0, done: true })
  expect(breathAt('wechselatmung', 500, 64)).toMatchObject({ kind: 'aus', label: 'Links ausatmen', level: 0, secondsLeft: 0, done: true })
})

test('before the start and invalid times begin the first phase', () => {
  expect(breathAt('seufzer', -0.5, 60)).toEqual({ kind: 'ein', label: 'Einatmen', level: 0, startLevel: 0, endLevel: 0.8, phaseElapsed: 0, phaseLength: 3, secondsLeft: 3, done: false })
  expect(breathAt('seufzer', NaN, 60)).toMatchObject({ kind: 'ein', phaseElapsed: 0, done: false })
})

test('breathPlan und breathAt mit einem Muster-Objekt (eigenes Muster 4-2-6-0)', () => {
  const p = customToPattern({ id: 'eigen-0123abcd', name: 'Abendruhe', inhale: 4, holdIn: 2, exhale: 6, holdOut: 0 })
  const plan = breathPlan(p, 1)
  expect([plan.cycle, plan.cycles, plan.length]).toEqual([12, 5, 60])
  expect(plan.cues.slice(0, 4)).toEqual([{ at: 0, kind: 'ein' }, { at: 4, kind: 'halten' }, { at: 6, kind: 'aus' }, { at: 12, kind: 'ein' }])
  expect(breathAt(p, 5, 60)).toMatchObject({ kind: 'halten', label: 'Halten', level: 1 })
  expect(breathAt(p, 9, 60)).toMatchObject({ kind: 'aus', level: 0.5 })
  expect(breathPlan(patternById('box'), 3)).toEqual(breathPlan('box', 3))
  expect(breathAt(patternById('478'), 5, 76)).toEqual(breathAt('478', 5, 76))
})
