import { test, expect } from 'vitest'
import { mediaTitle, soundTitles } from '../../src/lib/audio/media-title'
test('media titles', () => {
  expect(mediaTitle([], null)).toBe('Ruhe')
  expect(mediaTitle(['Regen'], null)).toBe('Regen')
  expect(mediaTitle(['Regen', 'Wald mit Vögeln'], 45)).toBe('Regen & Wald mit Vögeln · Sleep-Timer 45 Min')
  expect(mediaTitle(['Regen', 'Wind', 'Bach'], null)).toBe('Regen, Wind & Bach')
})

test('the title follows the playing sound, during a switch already the loading one', () => {
  expect(soundTitles({ volumes: {}, loading: [] })).toEqual([])
  expect(soundTitles({ volumes: { regen: 0.7 }, loading: [] })).toEqual(['Regen'])
  expect(soundTitles({ volumes: {}, loading: ['wald'] })).toEqual(['Wald mit Vögeln'])
})
