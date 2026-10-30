import { expect, test } from 'vitest'
import { COST_TAGS, FOCUS_MAX, FOCUS_SUGGESTIONS, GAVE_TAGS, TAG_MAX, tagsOf } from '../../src/lib/evening/words'

// Die Stichworte und Fokus-Vorschläge des Abend-Logbuchs (Spec M11 §3), wörtlich und in dieser Reihenfolge.
test('je 12 Stichworte für Geber und Räuber in der Reihenfolge der Spec', () => {
  expect(GAVE_TAGS).toEqual(['Bewegung', 'Draußen', 'Gute Gespräche', 'Fokus-Arbeit', 'Erfolg', 'Guter Schlaf', 'Gutes Essen', 'Musik', 'Lernen', 'Pause', 'Familie', 'Lachen'])
  expect(COST_TAGS).toEqual(['Wenig Schlaf', 'Bildschirm', 'Meetings', 'Konflikt', 'Zeitdruck', 'Unterbrechungen', 'Grübeln', 'Schweres Essen', 'Lärm', 'Viel Sitzen', 'Alkohol', 'Nachrichten'])
  expect(tagsOf('gave')).toBe(GAVE_TAGS)
  expect(tagsOf('cost')[0]).toBe('Wenig Schlaf')
})

test('sechs Fokus-Vorschläge', () => {
  expect(FOCUS_SUGGESTIONS).toEqual(['Dranbleiben', 'Mehr Schlaf', 'Mehr Bewegung', 'Weniger Bildschirm', 'Erst das Wichtige', 'Mehr Pausen'])
})

test('keine Doppelten und alles innerhalb der Grenzen', () => {
  const all = [...GAVE_TAGS, ...COST_TAGS]
  expect(new Set(all.map((t) => t.toLowerCase())).size).toBe(all.length)
  expect(new Set(FOCUS_SUGGESTIONS.map((t) => t.toLowerCase())).size).toBe(FOCUS_SUGGESTIONS.length)
  for (const tag of all) expect([...tag].length).toBeLessThanOrEqual(TAG_MAX)
  for (const focus of FOCUS_SUGGESTIONS) expect([...focus].length).toBeLessThanOrEqual(FOCUS_MAX)
})
