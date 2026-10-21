import { test, expect } from 'vitest'
import { greetingFor } from '../../src/lib/time/greeting'
const at = (h: number, m = 0) => new Date(2026, 9, 21, h, m)
test.each([
  [at(5), 'Guten Morgen'], [at(10, 59), 'Guten Morgen'],
  [at(11), 'Guten Tag'], [at(16, 59), 'Guten Tag'],
  [at(17), 'Guten Abend'], [at(0), 'Guten Abend'], [at(4, 59), 'Guten Abend'],
])('greetingFor(%s) = %s', (d, expected) => expect(greetingFor(d)).toBe(expected))
