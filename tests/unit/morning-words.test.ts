import { expect, test } from 'vitest'
import { AREAS } from '../../src/lib/energy/areas'
import { hackById } from '../../src/lib/energy/hacks'
import {
  DOMINO_MAX,
  GRATITUDE_MAX,
  INTENTIONS,
  INTENTIONS_DEFAULT,
  INTENTION_MAX,
  MORNING_EXERCISES,
  VALUES,
  VALUE_MAX,
} from '../../src/lib/morning/words'

// Wortlisten aus Spec M10 §3.2 und §3.3.
test('Intentions-Wörter je schwächstem Bereich: sechs Vorschläge', () => {
  expect(INTENTIONS).toEqual({
    koerper: ['geerdet', 'kraftvoll', 'leicht', 'beweglich', 'sanft mit mir', 'achtsam'],
    gefuehl: ['gelassen', 'freundlich', 'zuversichtlich', 'verbunden', 'geduldig', 'heiter'],
    geist: ['klar', 'fokussiert', 'wach', 'neugierig', 'gesammelt', 'entschieden'],
    sinn: ['mutig', 'ausgerichtet', 'dankbar', 'großzügig', 'echt', 'entschlossen'],
  })
  for (const a of AREAS) expect(INTENTIONS[a], a).toHaveLength(6)
})

test('ohne Check-in gilt die Standardliste mit sechs Wörtern', () => {
  expect(INTENTIONS_DEFAULT).toEqual(['klar', 'gelassen', 'mutig', 'freundlich', 'fokussiert', 'dankbar'])
  expect(INTENTIONS_DEFAULT).toHaveLength(6)
})

test('zwölf Werte für den langen Morgen-Start', () => {
  expect(VALUES).toEqual([
    'Geduld', 'Mut', 'Klarheit', 'Freundlichkeit', 'Ehrlichkeit', 'Fokus',
    'Gelassenheit', 'Großzügigkeit', 'Neugier', 'Verlässlichkeit', 'Disziplin', 'Leichtigkeit',
  ])
  expect(VALUES).toHaveLength(12)
})

test('jedes Vorschlagswort passt in sein Feld, ohne Doppelte je Liste', () => {
  const lists = [...Object.values(INTENTIONS), INTENTIONS_DEFAULT]
  for (const list of lists) {
    expect(new Set(list.map((w) => w.toLowerCase())).size).toBe(list.length)
    for (const w of list) {
      expect(w, w).toBe(w.trim())
      expect(w.length, w).toBeGreaterThan(0)
      expect(w.length, w).toBeLessThanOrEqual(INTENTION_MAX)
    }
  }
  expect(new Set(VALUES).size).toBe(VALUES.length)
  for (const v of VALUES) expect(v.length, v).toBeLessThanOrEqual(VALUE_MAX)
})

test('Längengrenzen: Intention 40, Dankbarkeit 120, Wert 40, Big Domino 80', () => {
  expect([INTENTION_MAX, GRATITUDE_MAX, VALUE_MAX, DOMINO_MAX]).toEqual([40, 120, 40, 80])
})

test('Übungen des Morgens: feste Reihenfolge, alle sind Körper-Hacks des Katalogs', () => {
  expect(MORNING_EXERCISES).toEqual(['strecken', 'wasser-licht', 'wach-klopfen'])
  for (const id of MORNING_EXERCISES) {
    const h = hackById(id)
    expect(h, id).not.toBeNull()
    expect(h?.area, id).toBe('koerper')
    expect(h?.guide, id).toBe('schritte')
  }
})
