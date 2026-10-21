import { test, expect } from 'vitest'
import { createRng } from '../../src/lib/random'
test('same seed gives same sequence, values in [0,1)', () => {
  const a = createRng(42), b = createRng(42), c = createRng(43)
  const sa = Array.from({ length: 1000 }, a), sb = Array.from({ length: 1000 }, b)
  expect(sa).toEqual(sb)
  expect(Array.from({ length: 1000 }, c)).not.toEqual(sa)
  expect(sa.every(v => v >= 0 && v < 1)).toBe(true)
})
