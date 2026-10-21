import { test, expect } from 'vitest'
import { mediaTitle } from '../../src/lib/audio/media-title'
test('media titles', () => {
  expect(mediaTitle([], null)).toBe('Ruhe')
  expect(mediaTitle(['Regen'], null)).toBe('Regen')
  expect(mediaTitle(['Regen', 'Wald mit Vögeln'], 45)).toBe('Regen & Wald mit Vögeln · Sleep-Timer 45 Min')
  expect(mediaTitle(['Regen', 'Wind', 'Bach'], null)).toBe('Regen, Wind & Bach')
})
