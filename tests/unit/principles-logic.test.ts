process.env.TZ = 'Europe/Berlin'
// Reine Logik der Sammlung (Spec M12 §4): Textschlüssel, Kennungen, Prinzip der Woche, Erkenntnis des Tages,
// Wachstumsfelder und Einfügen. Alle Einträge sind erfunden und neutral (Spec M12 §3.2).
import { describe, expect, test } from 'vitest'
import { COLLECTION_ID, textKey } from '../../src/lib/principles/words'
import { newCollectionId } from '../../src/lib/principles/collection'

test('Zeitzone Europe/Berlin (sonst prüfen die Umstellungs-Tests nichts)', () => {
  expect([new Date(2026, 9, 24, 12).getTimezoneOffset(), new Date(2026, 9, 26, 12).getTimezoneOffset()]).toEqual([-120, -60])
})
describe('textKey', () => {
  test('Groß und klein, Leerraum in Folge, Ränder', () => expect(textKey('  Mehrweg\u00a0 statt\tEINWEG\n')).toBe('mehrweg statt einweg'))
  test('NFC: zerlegtes und zusammengesetztes „é“ sind gleich', () => {
    expect(textKey('Ein Schachkurs im Cafe\u0301')).toBe(textKey('Ein Schachkurs im Caf\u00e9'))
    expect(textKey('Ein Schachkurs im Cafe\u0301')).toBe('ein schachkurs im caf\u00e9')
  })
})
describe('newCollectionId', () => {
  test('Form: s- und 8 Hex-Zeichen', () => expect(newCollectionId(new Set())).toMatch(COLLECTION_ID))
  test('bei Kollision neu gezogen; Kennungen der Sammlung, derselben Einfügung und Verweise aus evenings zählen', () => {
    const draws = ['aaaaaaaa-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-111111111111', 'bbbbbbbb-2222-4222-8222-222222222222', 'cccccccc-3333-4333-8333-333333333333']
    const random = () => draws.shift()!
    const taken = new Set(['s-bbbbbbbb']) // etwa ein weekPrinciple aus evenings
    const first = newCollectionId(taken, random)
    taken.add(first) // wie addInsights: eben gezogen, dieselbe Einfügung
    expect([first, newCollectionId(taken, random)]).toEqual(['s-aaaaaaaa', 's-cccccccc'])
  })
})
