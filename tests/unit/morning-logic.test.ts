process.env.TZ = 'Europe/Berlin'
import { describe, expect, test } from 'vitest'
import {
  MORNING_FROM, MORNING_UNTIL,
  exerciseOfDay, morningCard, morningCount, morningCountLine, nextExercise, openDomino, ownValues, ownWords,
  suggestions, todayEntry,
} from '../../src/lib/morning/logic'
import { INTENTIONS_DEFAULT, MORNING_EXERCISES } from '../../src/lib/morning/words'
import { dayKey } from '../../src/lib/stats/summary'
import type { MorningEntry } from '../../src/lib/stats/schema'

// Lokale Zeiten, damit die Tests von der Zeitzone des Rechners nicht abhängen. 27.10.2026 ist ein Dienstag,
// die Zeitumstellung (Sommerzeit endet) war am Sonntag, 25.10.2026.
const d = (day: number, h = 12, min = 0) => new Date(2026, 9, day, h, min)
const NOW = d(27, 15)
/** `back` Kalendertage vor dem 27.10.2026, um `h:min` Uhr. */
const ago = (back: number, h = 8, min = 0) => new Date(2026, 9, 27 - back, h, min)

/** Ein Eintrag am Tag und Zeitpunkt `at`; `day` ist der lokale Kalendertag davon. */
const entry = (at: Date, extra: Partial<MorningEntry> = {}): MorningEntry => ({
  day: dayKey(at),
  at: at.toISOString(),
  variant: 'kurz',
  ...extra,
})

test('Zeitzone Europe/Berlin (sonst prüft der Zeitumstellungs-Test nichts)', () => {
  expect([d(24).getTimezoneOffset(), d(26).getTimezoneOffset()]).toEqual([-120, -60])
})

describe('Karte nach Uhrzeit', () => {
  test('Fenster 4:00 bis 10:59', () => {
    expect([MORNING_FROM, MORNING_UNTIL]).toEqual([4, 11])
  })
  test('ohne Eintrag: 3:59 nichts, 4:00 und 10:59 „Guten Morgen“, 11:00 nichts', () => {
    expect(morningCard([], d(27, 3, 59))).toBeNull()
    expect(morningCard([], d(27, 4, 0))).toBe('guten-morgen')
    expect(morningCard([], d(27, 10, 59))).toBe('guten-morgen')
    expect(morningCard([], d(27, 11, 0))).toBeNull()
  })
  test('Eintrag von gestern zählt nicht für heute', () => {
    const e = entry(ago(1))
    expect(morningCard([e], d(27, 9))).toBe('guten-morgen')
    expect(morningCard([e], d(27, 15))).toBeNull()
  })
})

describe('Dein Tag bis Mitternacht', () => {
  test('Eintrag von heute 14:00: „Dein Tag“, zu jeder Stunde des Tages', () => {
    const e = entry(d(27, 14))
    for (const h of [0, 3, 4, 7, 10, 11, 14, 20]) expect(morningCard([e], d(27, h)), `${h}:00`).toBe('dein-tag')
    expect(morningCard([e], d(27, 23, 59))).toBe('dein-tag')
  })
  test('Eintrag von gestern: am Folgetag um 0:00 nichts, um 4:00 „Guten Morgen“', () => {
    const e = entry(d(26, 14))
    expect(morningCard([e], d(26, 23, 59))).toBe('dein-tag')
    expect(morningCard([e], d(27, 0, 0))).toBeNull()
    expect(morningCard([e], d(27, 3, 59))).toBeNull()
    expect(morningCard([e], d(27, 4, 0))).toBe('guten-morgen')
  })
  test('todayEntry: der Eintrag von heute, sonst null; bei zwei Einträgen der mit späterem `at`', () => {
    const gestern = entry(ago(1))
    const heute = entry(d(27, 8))
    expect(todayEntry([gestern, heute], NOW)).toBe(heute)
    expect(todayEntry([heute, gestern], NOW)).toBe(heute)
    expect(todayEntry([gestern], NOW)).toBeNull()
    expect(todayEntry([], NOW)).toBeNull()
    const früher = entry(d(27, 6)), später = entry(d(27, 9))
    expect(todayEntry([später, früher], NOW)).toBe(später)
  })
})

describe('Übung des Tages', () => {
  test('drei aufeinanderfolgende Tage ergeben drei verschiedene Übungen in der Reihenfolge der Liste', () => {
    const ids = [d(10, 12), d(11, 12), d(12, 12)].map(exerciseOfDay)
    expect(new Set(ids).size).toBe(3)
    const start = MORNING_EXERCISES.indexOf(ids[0])
    expect(ids).toEqual([0, 1, 2].map((i) => MORNING_EXERCISES[(start + i) % 3]))
  })
  test('feste Werte: 1.1.1970 (Tag 0) ist die erste Übung; der 27.10.2026 (Tag 20 753) die dritte', () => {
    expect(exerciseOfDay(new Date(1970, 0, 1, 12))).toBe('strecken')
    expect(exerciseOfDay(new Date(1970, 0, 2, 12))).toBe('wasser-licht')
    expect(exerciseOfDay(new Date(1970, 0, 3, 12))).toBe('wach-klopfen')
    expect(Date.UTC(2026, 9, 27) / 86_400_000).toBe(20_753)
    expect(exerciseOfDay(d(27))).toBe('wach-klopfen')
    expect(exerciseOfDay(d(28))).toBe('strecken')
  })
  test('Tage vor 1970 rechnen nicht ins Negative: der 31.12.1969 ist die dritte Übung', () => {
    expect(exerciseOfDay(new Date(1969, 11, 31, 12))).toBe('wach-klopfen')
    expect(exerciseOfDay(new Date(1969, 11, 30, 12))).toBe('wasser-licht')
  })
  test('23:59 und 0:00 desselben Kalendertags ergeben dieselbe Übung', () => {
    for (const day of [10, 24, 25, 26, 27]) {
      expect(exerciseOfDay(d(day, 23, 59)), `${day}.10. spät`).toBe(exerciseOfDay(d(day, 0, 0)))
    }
  })
  test('über die Zeitumstellung 25./26.10.2026 bleibt die Folge lückenlos', () => {
    const days = [23, 24, 25, 26, 27, 28]
    for (const h of [0, 1, 12, 23]) {
      const ids = days.map((day) => exerciseOfDay(d(day, h)))
      const start = MORNING_EXERCISES.indexOf(ids[0])
      expect(ids, `${h} Uhr`).toEqual(days.map((_, i) => MORNING_EXERCISES[(start + i) % 3]))
    }
  })
  test('nextExercise: die nächste der Reihenfolge, nach der dritten wieder die erste', () => {
    expect(nextExercise('strecken')).toBe('wasser-licht')
    expect(nextExercise('wasser-licht')).toBe('wach-klopfen')
    expect(nextExercise('wach-klopfen')).toBe('strecken')
  })
})

describe('Vorschläge', () => {
  test('mit Bereich die sechs Wörter des Bereichs, ohne Bereich die Standardliste', () => {
    expect(suggestions('geist')[0]).toBe('klar')
    expect(suggestions('geist')).toHaveLength(6)
    expect(suggestions('koerper')[0]).toBe('geerdet')
    expect(suggestions(null)).toBe(INTENTIONS_DEFAULT)
  })
})

describe('Eigene Wörter und Werte', () => {
  test('ownWords: die jüngsten zuerst, ohne Vorschlagswörter, ohne Doppelte (jüngste Schreibweise)', () => {
    const words = ['klar', 'Großzügig', 'wild', 'Wild', 'frei', 'ruhig im Sturm']
    const list = words.map((intention, i) => entry(ago(words.length - i), { intention }))
    expect(ownWords(list)).toEqual(['ruhig im Sturm', 'frei', 'Wild'])
  })
  test('ownWords: Reihenfolge der Liste spielt keine Rolle, `day` und dann `at` entscheiden', () => {
    const alt = entry(ago(2), { intention: 'alt' })
    const mittel = entry(ago(1, 7), { intention: 'mittel' })
    const neu = entry(ago(1, 9), { intention: 'neu' })
    expect(ownWords([neu, alt, mittel])).toEqual(['neu', 'mittel', 'alt'])
    expect(ownWords([alt, mittel, neu])).toEqual(['neu', 'mittel', 'alt'])
  })
  test('ownWords: höchstens drei; Einträge ohne Intention, leere und Vorschläge anderer Bereiche zählen nicht', () => {
    const list = [
      entry(ago(7), { intention: 'eins' }),
      entry(ago(6), { intention: 'zwei' }),
      entry(ago(5), { intention: 'drei' }),
      entry(ago(4), { intention: 'vier' }),
      entry(ago(3), { intention: '   ' }),
      entry(ago(2), { intention: ' Geerdet ' }),
      entry(ago(1)),
    ]
    expect(ownWords(list)).toEqual(['vier', 'drei', 'zwei'])
    expect(ownWords([])).toEqual([])
  })
  test('ownWords: Leerraum am Rand zählt nicht, Doppelte ohne Rücksicht auf Groß- und Kleinschreibung', () => {
    const list = [entry(ago(2), { intention: 'Ruhig' }), entry(ago(1), { intention: '  ruhig ' })]
    expect(ownWords(list)).toEqual(['ruhig'])
  })
  test('ownValues: filtert die Werteliste, sonst dieselbe Regel', () => {
    const werte = ['Mut', 'Demut', 'GEDULD', 'demut', 'Zuversicht', 'Dankbarkeit', 'Weite']
    const list = werte.map((value, i) => entry(ago(werte.length - i), { variant: 'lang', value }))
    expect(ownValues(list)).toEqual(['Weite', 'Dankbarkeit', 'Zuversicht'])
  })
  test('ownValues: eigene Wörter der Intention werden hier nicht gemischt', () => {
    const list = [entry(ago(1), { intention: 'frei', value: 'Ruhe', variant: 'lang' })]
    expect(ownValues(list)).toEqual(['Ruhe'])
    expect(ownWords(list)).toEqual(['frei'])
  })
})

describe('Big Domino von gestern', () => {
  test('gestern offen: der Text', () => {
    expect(openDomino([entry(ago(1), { domino: 'Steuer machen' })], NOW)).toBe('Steuer machen')
  })
  test('gestern erledigt: null', () => {
    const done = entry(ago(1), { domino: 'Steuer machen', dominoDone: ago(1, 17).toISOString() })
    expect(openDomino([done], NOW)).toBeNull()
  })
  test('drei Tage alt gilt noch, vier Tage alt nicht mehr', () => {
    expect(openDomino([entry(ago(3), { domino: 'Drei' })], NOW)).toBe('Drei')
    expect(openDomino([entry(ago(4), { domino: 'Vier' })], NOW)).toBeNull()
  })
  test('nur ein Eintrag von heute: null, auch mit Big Domino', () => {
    expect(openDomino([entry(d(27, 8), { domino: 'Heute' })], NOW)).toBeNull()
    expect(openDomino([], NOW)).toBeNull()
  })
  test('bei mehreren gilt der jüngste vor heute, unabhängig von der Reihenfolge', () => {
    const alt = entry(ago(3), { domino: 'alt' })
    const gestern = entry(ago(1), { domino: 'gestern' })
    const heute = entry(d(27, 8), { domino: 'heute' })
    expect(openDomino([alt, gestern, heute], NOW)).toBe('gestern')
    expect(openDomino([heute, gestern, alt], NOW)).toBe('gestern')
  })
  test('nur der jüngste vor heute zählt: ohne Big Domino oder erledigt kein Rückgriff auf ältere', () => {
    const alt = entry(ago(3), { domino: 'alt' })
    expect(openDomino([alt, entry(ago(1))], NOW)).toBeNull()
    expect(openDomino([alt, entry(ago(2), { domino: 'x', dominoDone: ago(2, 18).toISOString() })], NOW)).toBeNull()
  })
  test('ein Eintrag aus der Zukunft (Uhr verstellt) wird nicht als „gestern“ genommen', () => {
    const gestern = entry(ago(1), { domino: 'gestern' })
    const morgen = entry(d(28, 8), { domino: 'morgen' })
    expect(openDomino([gestern, morgen], NOW)).toBe('gestern')
  })
  test('dreimal zurück zählt Kalendertage, auch über die Zeitumstellung', () => {
    // 28.10. 0:30 minus 3 Kalendertage ist der 25.10. (25 Stunden lang), minus 4 der 24.10.
    const now = d(28, 0, 30)
    expect(openDomino([entry(d(25, 12), { domino: 'Sonntag' })], now)).toBe('Sonntag')
    expect(openDomino([entry(d(24, 12), { domino: 'Samstag' })], now)).toBeNull()
    // 26.10. 23:30: drei Tage zurück ist der 23.10., vier der 22.10.
    const spät = d(26, 23, 30)
    expect(openDomino([entry(d(23, 8), { domino: 'Freitag' })], spät)).toBe('Freitag')
    expect(openDomino([entry(d(22, 8), { domino: 'Donnerstag' })], spät)).toBeNull()
  })
})

describe('Zählung der letzten 7 Tage', () => {
  test('heute, vor 3 und vor 6 Tagen zählen; vor 7 Tagen nicht', () => {
    expect(morningCount([entry(d(27, 8)), entry(ago(3)), entry(ago(6))], NOW)).toBe(3)
    expect(morningCount([entry(d(27, 8)), entry(ago(3)), entry(ago(6)), entry(ago(7))], NOW)).toBe(3)
    expect(morningCount([entry(ago(7))], NOW)).toBe(0)
    expect(morningCount([], NOW)).toBe(0)
  })
  test('Einträge in der Zukunft zählen nicht', () => {
    expect(morningCount([entry(d(28, 8))], NOW)).toBe(0)
  })
  test('je Tag nur einmal, auch bei zwei Einträgen am selben Tag', () => {
    expect(morningCount([entry(ago(1, 7)), entry(ago(1, 9))], NOW)).toBe(1)
  })
  test('über die Zeitumstellung wird nach Kalendertagen gezählt', () => {
    // 26.10. 23:30: sechs Kalendertage zurück ist der 20.10.; 24-Stunden-Schritte landeten schon am 21.10.
    const now = d(26, 23, 30)
    expect(morningCount([entry(d(20, 8)), entry(d(22, 8)), entry(d(26, 8))], now)).toBe(3)
    expect(morningCount([entry(d(19, 8)), entry(d(20, 8))], now)).toBe(1)
    // 25.10. 0:30: gestern ist der 24.10., sechs zurück der 19.10.
    const früh = d(25, 0, 30)
    expect(morningCount([entry(d(19, 8)), entry(d(24, 8)), entry(d(25, 8))], früh)).toBe(3)
    expect(morningCount([entry(d(18, 8))], früh)).toBe(0)
  })
  test('morningCountLine', () => {
    expect(morningCountLine(4)).toBe('Morgen-Start an 4 der letzten 7 Tage')
    expect(morningCountLine(1)).toBe('Morgen-Start an 1 der letzten 7 Tage')
  })
})
