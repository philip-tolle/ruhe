process.env.TZ = 'Europe/Berlin'
import { describe, expect, test } from 'vitest'
import {
  EVENING_FROM,
  chosenLine, dominoLine, eveningCard, eveningCount, eveningCountLine, eveningEntry, hasReview, logbookDay,
  morningEntry, morningReminder, ownFocus, ownTags, shiftDay, tagCountLine, weekRangeLine, weekReview,
} from '../../src/lib/evening/logic'
import { eveningSteps } from '../../src/lib/evening/steps'
import { isSunday } from '../../src/lib/stats/summary'
import type { EveningEntry, MorningEntry } from '../../src/lib/stats/schema'

// Lokale Zeiten (Berlin). 29.10.2026 ist ein Donnerstag, 1.11.2026 ein Sonntag; die Sommerzeit endete am Sonntag,
// 25.10.2026, und begann am Sonntag, 29.3.2026. Alle Einträge sind ausgedacht.
const t = (month: number, day: number, h: number, min = 0) => new Date(2026, month - 1, day, h, min)
const oct = (day: number, h: number, min = 0) => t(10, day, h, min)

const evening = (day: string, extra: Partial<EveningEntry> = {}): EveningEntry => ({ day, at: `${day}T20:00:00.000Z`, ...extra })
const morning = (day: string, extra: Partial<MorningEntry> = {}): MorningEntry => ({ day, at: `${day}T06:00:00.000Z`, variant: 'kurz', ...extra })

test('Zeitzone Europe/Berlin (sonst prüfen die Umstellungs-Tests nichts)', () => {
  expect([oct(24, 12).getTimezoneOffset(), oct(26, 12).getTimezoneOffset()]).toEqual([-120, -60])
})

describe('Logbuch-Tag', () => {
  test('vor 4:00 gilt der Vortag', () => {
    expect(logbookDay(oct(29, 3, 59))).toBe('2026-10-28')
    expect(logbookDay(oct(29, 4, 0))).toBe('2026-10-29')
    expect(logbookDay(oct(29, 0, 0))).toBe('2026-10-28')
    expect(logbookDay(oct(29, 23, 59))).toBe('2026-10-29')
  })
  test('an den Umstellungstagen bleibt die Grenze 4:00', () => {
    expect(logbookDay(t(3, 29, 3, 30))).toBe('2026-03-28')
    expect(logbookDay(t(3, 29, 4, 30))).toBe('2026-03-29')
    expect(logbookDay(oct(25, 3, 30))).toBe('2026-10-24')
    expect(logbookDay(oct(25, 4, 30))).toBe('2026-10-25')
  })
  test('shiftDay rechnet im Kalender', () => {
    expect(shiftDay('2026-10-25', -1)).toBe('2026-10-24')
    expect(shiftDay('2026-03-29', 1)).toBe('2026-03-30')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDay('2026-11-01', -6)).toBe('2026-10-26')
  })
  test('isSunday', () => {
    expect(isSunday('2026-11-01')).toBe(true)
    expect(isSunday('2026-11-02')).toBe(false)
    expect(isSunday('2026-10-25')).toBe(true)
  })
})

describe('Karte auf „Heute“', () => {
  test('ohne Eintrag: „Tag abschließen“ von 18:00 bis 3:59', () => {
    expect(EVENING_FROM).toBe(18)
    const none: EveningEntry[] = []
    expect(eveningCard(none, oct(29, 3, 59))).toBe('tag-abschliessen')
    expect(eveningCard(none, oct(29, 4, 0))).toBeNull()
    expect(eveningCard(none, oct(29, 10, 59))).toBeNull()
    expect(eveningCard(none, oct(29, 11, 0))).toBeNull()
    expect(eveningCard(none, oct(29, 17, 59))).toBeNull()
    expect(eveningCard(none, oct(29, 18, 0))).toBe('tag-abschliessen')
    expect(eveningCard(none, oct(30, 0, 30))).toBe('tag-abschliessen')
  })
  test('mit Eintrag des Logbuch-Tages: „Dein Abend“, außer im Morgen-Fenster', () => {
    const list = [evening('2026-10-29')]
    expect(eveningCard(list, oct(29, 14))).toBe('dein-abend')
    expect(eveningCard(list, oct(29, 20))).toBe('dein-abend')
    expect(eveningCard(list, oct(30, 0, 30))).toBe('dein-abend')
    expect(eveningCard(list, oct(30, 4, 0))).toBeNull()
    expect(eveningCard(list, oct(29, 8))).toBeNull()
    // Ein Eintrag von gestern zählt heute Abend nicht.
    expect(eveningCard(list, oct(30, 20))).toBe('tag-abschliessen')
  })
  test('eveningEntry: bei zwei Einträgen am Tag der mit späterem at', () => {
    const a = { ...evening('2026-10-29'), at: '2026-10-29T19:00:00.000Z', learned: 'früh' }
    const b = { ...evening('2026-10-29'), at: '2026-10-29T21:00:00.000Z', learned: 'spät' }
    expect(eveningEntry([b, a], '2026-10-29')).toBe(b)
    expect(eveningEntry([a, b], '2026-10-29')).toBe(b)
    expect(eveningEntry([a], '2026-10-28')).toBeNull()
  })
})

describe('Schritte und Rückblick', () => {
  test('eveningSteps', () => {
    expect(eveningSteps(false, false)).toEqual(['checkin', 'geber', 'raeuber', 'gelernt', 'besser'])
    expect(eveningSteps(true, false)).toEqual(['checkin', 'geber', 'raeuber', 'rueckblick', 'gelernt', 'besser'])
    expect(eveningSteps(false, true)).toEqual(['checkin', 'geber', 'raeuber', 'gelernt', 'besser', 'woche'])
    expect(eveningSteps(true, true)).toEqual(['checkin', 'geber', 'raeuber', 'rueckblick', 'gelernt', 'besser', 'woche'])
  })
  test('morningEntry: der Morgen-Eintrag eines Tages, bei zwei der mit späterem at', () => {
    const a = morning('2026-10-29', { domino: 'früh' })
    const b = { ...morning('2026-10-29', { domino: 'spät' }), at: '2026-10-29T08:00:00.000Z' }
    expect(morningEntry([b, a], '2026-10-29')).toBe(b)
    expect(morningEntry([a], '2026-10-28')).toBeNull()
  })
  test('hasReview: Big Domino oder Intention des Morgen-Eintrags dieses Tages', () => {
    expect(hasReview([morning('2026-10-29', { domino: 'Konzept' })], '2026-10-29')).toBe(true)
    expect(hasReview([morning('2026-10-29', { intention: 'klar' })], '2026-10-29')).toBe(true)
    expect(hasReview([morning('2026-10-29', { gratitude: 'Kaffee' })], '2026-10-29')).toBe(false)
    expect(hasReview([morning('2026-10-28', { domino: 'Konzept' })], '2026-10-29')).toBe(false)
    expect(hasReview([], '2026-10-29')).toBe(false)
  })
})

describe('eigene Stichworte und Fokus-Wörter', () => {
  test('ownTags: ohne Vorschläge, ohne Doppelte, neueste zuerst, höchstens 8, je Seite', () => {
    const list = [
      evening('2026-10-20', { gave: ['Kochen', 'bewegung', 'Spaziergang mit Hund'], cost: ['Pendeln'] }),
      evening('2026-10-22', { gave: ['kochen', 'Lesen'] }),
      evening('2026-10-21', { gave: ['Sauna'] }),
    ]
    expect(ownTags(list, 'gave')).toEqual(['kochen', 'Lesen', 'Sauna', 'Spaziergang mit Hund'])
    expect(ownTags(list, 'cost')).toEqual(['Pendeln'])
    const many = [evening('2026-10-20', { gave: Array.from({ length: 12 }, (_, i) => `Eigen ${i}`) })]
    expect(ownTags(many, 'gave')).toHaveLength(8)
    expect(ownTags(many, 'gave')[0]).toBe('Eigen 0')
  })
  test('ownFocus: ohne Vorschläge, neueste zuerst, höchstens 3', () => {
    const list = [
      evening('2026-10-04', { weekFocus: 'Geduld' }),
      evening('2026-10-11', { weekFocus: 'mehr schlaf' }),
      evening('2026-10-18', { weekFocus: 'Lesen' }),
      evening('2026-10-25', { weekFocus: 'Ordnung' }),
      evening('2026-11-01', { weekFocus: 'Ruhe' }),
    ]
    expect(ownFocus(list)).toEqual(['Ruhe', 'Ordnung', 'Lesen'])
  })
})

describe('Wochenauswertung', () => {
  const evenings = [
    evening('2026-10-19', { gave: ['Musik', 'Musik'] }), // vor der Woche: zählt nicht
    evening('2026-10-26', { gave: ['Bewegung', 'Musik'], cost: ['Bildschirm'], learned: 'Erstens' }),
    evening('2026-10-28', { gave: ['Bewegung', 'Draußen'], cost: ['Bildschirm', 'Lärm'], learned: 'Zweitens' }),
    evening('2026-10-30', { gave: ['Draußen', 'Musik'], cost: ['Lärm'] }),
    evening('2026-10-31', { gave: ['Bewegung', 'Lachen'], learned: 'Drittens' }),
  ]
  const mornings = [
    morning('2026-10-26', { domino: 'A', dominoDone: '2026-10-26T10:00:00.000Z' }),
    morning('2026-10-27', { domino: 'B' }),
    morning('2026-10-29', { intention: 'klar' }),
    morning('2026-10-31', { domino: 'C', dominoDone: '2026-10-31T10:00:00.000Z' }),
    morning('2026-10-20', { domino: 'alt', dominoDone: '2026-10-20T10:00:00.000Z' }),
  ]

  test('Zählung je Tag, Rangfolge Zahl → jüngster Tag → alphabetisch, Top 3', () => {
    const review = weekReview(evenings, mornings, '2026-11-01')
    expect(review.from).toBe('2026-10-26')
    expect(review.to).toBe('2026-11-01')
    expect(review.days).toBe(4)
    // Bewegung 3; Musik 2 (zuletzt 30.); Draußen 2 (zuletzt 30.) → gleicher jüngster Tag: alphabetisch Draußen vor Musik.
    expect(review.gave).toEqual([{ tag: 'Bewegung', count: 3 }, { tag: 'Draußen', count: 2 }, { tag: 'Musik', count: 2 }])
    expect(review.cost).toEqual([{ tag: 'Lärm', count: 2 }, { tag: 'Bildschirm', count: 2 }])
    expect(review.learned).toEqual(['Drittens', 'Zweitens', 'Erstens'])
  })
  test('Big Dominos je Tag, alt → neu', () => {
    const review = weekReview(evenings, mornings, '2026-11-01')
    expect(review.dominos).toEqual(['geschafft', 'offen', 'keiner', 'keiner', 'keiner', 'geschafft', 'keiner'])
    expect([review.dominoDone, review.dominoSet]).toEqual([2, 3])
    expect(dominoLine(review)).toBe('2 von 3 geschafft')
    expect(dominoLine(weekReview([], [], '2026-11-01'))).toBeNull()
  })
  test('der Entwurf ersetzt den Eintrag des Tages und zählt mit', () => {
    const draft = evening('2026-11-01', { gave: ['Lachen', 'Lachen'], learned: 'Heute' })
    const review = weekReview(evenings, mornings, '2026-11-01', draft)
    expect(review.days).toBe(5)
    expect(review.gave[0]).toEqual({ tag: 'Bewegung', count: 3 })
    expect(review.gave).toContainEqual({ tag: 'Lachen', count: 2 })
    expect(review.learned[0]).toBe('Heute')
    // Ein gespeicherter Eintrag desselben Tages wird nicht doppelt gezählt.
    const saved = [...evenings, evening('2026-11-01', { gave: ['Pause'] })]
    expect(weekReview(saved, mornings, '2026-11-01', draft).gave.find((g) => g.tag === 'Pause')).toBeUndefined()
  })
  test('eine Woche über die Zeitumstellung umfasst genau sieben Kalendertage', () => {
    const list = ['2026-10-18', '2026-10-19', '2026-10-25'].map((day) => evening(day, { gave: ['Musik'] }))
    const review = weekReview(list, [], '2026-10-25')
    expect([review.from, review.to, review.days]).toEqual(['2026-10-19', '2026-10-25', 2])
    expect(review.dominos).toHaveLength(7)
  })
  test('Zeilen', () => {
    const review = weekReview(evenings, mornings, '2026-10-29')
    expect(weekRangeLine({ ...review, from: '2026-10-23', to: '2026-10-29', days: 5 })).toBe('23. Oktober bis 29. Oktober · Logbuch an 5 Tagen')
    expect(weekRangeLine({ ...review, from: '2026-12-28', to: '2027-01-03', days: 1 })).toBe('28. Dezember bis 3. Januar · Logbuch an 1 Tag')
    expect(tagCountLine({ tag: 'Bewegung', count: 4 })).toBe('Bewegung · 4×')
  })
})

describe('Erinnerung im Morgen-Start und Zählung', () => {
  test('morningReminder: 1 % besser vom Vortag, Wochenfokus 1 bis 7 Tage alt', () => {
    const list = [
      evening('2026-10-29', { better: 'Handy aus bis 10 Uhr' }),
      evening('2026-10-25', { weekFocus: 'Mehr Schlaf' }),
    ]
    expect(morningReminder(list, oct(30, 7))).toEqual({ better: 'Handy aus bis 10 Uhr', weekFocus: 'Mehr Schlaf' })
    expect(morningReminder(list, oct(31, 7)).better).toBeNull()
    // Fokus vom 25.10.: am 26.10. (1 Tag) und am 1.11. (7 Tage) gültig, am 25.10. selbst und am 2.11. (8 Tage) nicht.
    expect(morningReminder(list, oct(26, 7)).weekFocus).toBe('Mehr Schlaf')
    expect(morningReminder(list, t(11, 1, 7)).weekFocus).toBe('Mehr Schlaf')
    expect(morningReminder(list, oct(25, 21)).weekFocus).toBeNull()
    expect(morningReminder(list, t(11, 2, 7)).weekFocus).toBeNull()
    // Der jüngste gewinnt.
    const two = [...list, evening('2026-11-01', { weekFocus: 'Dranbleiben' })]
    expect(morningReminder(two, t(11, 2, 7)).weekFocus).toBe('Dranbleiben')
    expect(morningReminder([], oct(30, 7))).toEqual({ better: null, weekFocus: null })
  })
  test('eveningCount: Tage mit Eintrag unter dem Logbuch-Tag und den 6 Tagen davor', () => {
    const list = ['2026-10-22', '2026-10-23', '2026-10-27', '2026-10-29'].map((day) => evening(day))
    expect(eveningCount(list, oct(29, 21))).toBe(3)
    expect(eveningCount(list, oct(30, 1))).toBe(3) // 0:30 gehört noch zum 29.
    expect(eveningCount(list, oct(30, 21))).toBe(2)
    expect(eveningCountLine(5)).toBe('Logbuch an 5 der letzten 7 Tage')
  })
  test('chosenLine', () => {
    expect(chosenLine(0)).toBe('Nichts gewählt')
    expect(chosenLine(1)).toBe('1 gewählt')
    expect(chosenLine(3)).toBe('3 gewählt')
  })
})
