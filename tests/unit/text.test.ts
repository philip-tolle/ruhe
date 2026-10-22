import { test, expect } from 'vitest'
import { softBreaks } from '../../src/lib/text'

const shy = '\u00ad'
const BREAKS = { Meeresrauschen: `Meeres${shy}rauschen`, Kohärentes: `Kohä${shy}rentes` }

test('listed words get their soft hyphens, everything around them stays', () => {
  expect(softBreaks('Meeresrauschen', BREAKS)).toBe(`Meeres${shy}rauschen`)
  expect(softBreaks('Kohärentes Atmen', BREAKS)).toBe(`Kohä${shy}rentes Atmen`)
  // Jedes Vorkommen, Satzzeichen und Bindestriche bleiben.
  expect(softBreaks('Meeresrauschen, Meeresrauschen-Klang', BREAKS)).toBe(`Meeres${shy}rauschen, Meeres${shy}rauschen-Klang`)
})

test('words not in the list, numbers and the empty text stay as they are', () => {
  expect(softBreaks('Unbekanntes Wort', BREAKS)).toBe('Unbekanntes Wort')
  expect(softBreaks('4-7-8', BREAKS)).toBe('4-7-8')
  expect(softBreaks('', BREAKS)).toBe('')
  expect(softBreaks('Meeresrauschen', {})).toBe('Meeresrauschen')
})

test('only whole words match, never a part of a longer word', () => {
  expect(softBreaks('Meeresrauschens', BREAKS)).toBe('Meeresrauschens')
  expect(softBreaks('Urmeeresrauschen', BREAKS)).toBe('Urmeeresrauschen')
})

test('names inherited from Object are not words of the list', () => {
  expect(softBreaks('constructor toString', BREAKS)).toBe('constructor toString')
})
