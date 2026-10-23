import { test, expect } from 'vitest'
import { breathRate } from '../../src/lib/audio/breath-sound'

test('breathRate fits the sound to the phase within 0.75…1.25', () => {
  expect(breathRate(3.6, 4)).toBeCloseTo(0.9, 10)
  expect(breathRate(3.6, 1)).toBe(1.25)       // Nachatmen beim Seufzer
  expect(breathRate(6.3, 8)).toBeCloseTo(0.7875, 10)
  expect(breathRate(3.6, 5.5)).toBe(0.75)     // langsamer nicht: Das Geräusch endet vor der Phase
  expect(breathRate(6.3, 4)).toBe(1.25)       // schneller nicht: Der Rest wird ausgeblendet
})
