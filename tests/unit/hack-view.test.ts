import { describe, expect, test } from 'vitest'
import { HACKS, hackById, type Hack } from '../../src/lib/energy/hacks'
import { areaLine, linkTitle, resetPick, roundLabel, startLabel, stepLabel } from '../../src/lib/energy/hack-view'

function hack(id: string): Hack {
  const h = hackById(id)
  if (!h) throw new Error(`Hack fehlt: ${id}`)
  return h
}

describe('Zeilen und Beschriftungen der Hack-Oberfläche', () => {
  test('„{Bereich} · {n} Min“ nennt den Bereich des Hacks und seine Nenndauer', () => {
    expect(areaLine(hack('seufzer'))).toBe('Gefühl · 1 Min')
    expect(areaLine(hack('kopf-leeren'))).toBe('Geist · 3 Min')
    expect(areaLine(hack('power-pause'))).toBe('Körper · 10 Min')
    expect(areaLine(hack('werte-anker'))).toBe('Sinn · 2 Min')
  })

  test('„Starten · m:ss“ zeigt die Laufzeit, bei Takt-Hacks mit ganzen Zyklen', () => {
    expect(startLabel(hack('seufzer'))).toBe('Starten · 1:04') // 8 Zyklen à 8 s
    expect(startLabel(hack('wach-atmung'))).toBe('Starten · 1:00')
    expect(startLabel(hack('bewegungs-snack'))).toBe('Starten · 2:00')
    expect(startLabel(hack('power-pause'))).toBe('Starten · 10:00')
    for (const h of HACKS) expect(startLabel(h), h.id).toMatch(/^Starten · \d+:\d\d$/)
  })

  test('der Verweis „Passt dazu“ trägt den Titel der Atemübung, ohne Verweis nichts', () => {
    expect(linkTitle(hack('seufzer'))).toBe('Physiologischer Seufzer')
    expect(linkTitle(hack('kopf-leeren'))).toBeNull()
    // Jeder Verweis des Katalogs führt zu einer Übung, die es gibt.
    for (const h of HACKS) if (h.link) expect(linkTitle(h), h.id).toMatch(/\S/)
  })

  test('„Schritt {i} von {n}“ zählt ab 1', () => {
    expect(stepLabel(0, 4)).toBe('Schritt 1 von 4')
    expect(stepLabel(3, 4)).toBe('Schritt 4 von 4')
  })

  test('„Runde {r} von {n}“ entfällt bei einer einzigen Runde', () => {
    expect(roundLabel(4, 8)).toBe('Runde 4 von 8')
    expect(roundLabel(1, 8)).toBe('Runde 1 von 8')
    expect(roundLabel(1, 1)).toBeNull()
  })

  test('der Reset zeigt den Eintrag skip % Länge und fängt eine leere Folge ab', () => {
    const sequence = ['a', 'b', 'c']
    expect(resetPick(sequence, 0)).toBe('a')
    expect(resetPick(sequence, 2)).toBe('c')
    expect(resetPick(sequence, 3)).toBe('a') // nach dem letzten wieder von vorn
    expect(resetPick(sequence, 7)).toBe('b')
    expect(resetPick([], 0)).toBeNull() // keine Teilung durch 0
    expect(resetPick([], 5)).toBeNull()
  })
})
