// Die Schritte des Morgen-Starts (Spec M10 §2.3): kurz und lang, ohne den Abschluss.
import { expect, test } from 'vitest'
import { morningSteps } from '../../src/lib/morning/steps'

test('der kurze Ablauf: Check-in, Aktivieren, Intention, Dankbarkeit, Big Domino', () => {
  expect(morningSteps('kurz')).toEqual(['checkin', 'aktivieren', 'intention', 'dankbarkeit', 'domino'])
})

test('der lange Ablauf schiebt „Vertiefen“ nach dem Aktivieren ein', () => {
  expect(morningSteps('lang')).toEqual(['checkin', 'aktivieren', 'vertiefen', 'intention', 'dankbarkeit', 'domino'])
})

test('der Abschluss gehört zu keiner Folge; er folgt erst nach dem Speichern', () => {
  for (const variant of ['kurz', 'lang'] as const) expect(morningSteps(variant)).not.toContain('abschluss')
})

test('jeder Aufruf liefert eine eigene Liste; Ändern verfälscht die nächste nicht', () => {
  morningSteps('kurz').push('abschluss')
  expect(morningSteps('kurz')).toHaveLength(5)
})
