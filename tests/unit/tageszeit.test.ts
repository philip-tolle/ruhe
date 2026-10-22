import { test, expect } from 'vitest'
import { tageszeit, GREETING } from '../../src/lib/time/tageszeit'
import { greetingFor } from '../../src/lib/time/greeting'

const at = (h: number, m = 0) => new Date(2026, 9, 22, h, m)

test.each([
  [at(4, 59), 'abend'],
  [at(5, 0), 'morgen'],
  [at(10, 59), 'morgen'],
  [at(11, 0), 'tag'],
  [at(16, 59), 'tag'],
  [at(17, 0), 'abend'],
  [at(23, 59), 'abend'],
  [at(0, 0), 'abend'],
])('tageszeit at every boundary: %s = %s', (d, expected) => {
  expect(tageszeit(d)).toBe(expected)
})

test('greetingFor agrees with tageszeit for all 24 hours', () => {
  for (let h = 0; h < 24; h++) {
    expect(greetingFor(at(h))).toBe(GREETING[tageszeit(at(h))])
  }
})

test('GREETING has the exact German texts', () => {
  expect(GREETING).toEqual({ morgen: 'Guten Morgen', tag: 'Guten Tag', abend: 'Guten Abend' })
})
