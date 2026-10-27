process.env.TZ = 'Europe/Berlin'
import { describe, expect, test } from 'vitest'
import {
  FRESH_HOURS, PATTERN_MIN, PATTERN_HINT, WHAT_WORKS_HINT,
  cellLabel, cellLevel, effectLabel, focusLine, freshCheckin, hackStats, hasPatternData, headerLine,
  latestCheckin, patternSentences, weakestArea, weekGrid, whatWorks,
} from '../../src/lib/energy/insights'
import type { EnergyArea, EnergyLevel } from '../../src/lib/energy/areas'
import type { EnergyCheckin, FocusSprint, HackRun } from '../../src/lib/stats/schema'

// Lokale Zeiten, damit die Tests von der Zeitzone des Rechners nicht abhängen. 27.10.2026 ist ein Dienstag.
const d = (day: number, h = 12, min = 0) => new Date(2026, 9, day, h, min)
const NOW = d(27, 15)
/** `back` Kalendertage vor dem 27.10.2026, um `h:min` Uhr. */
const ago = (back: number, h = 12, min = 0) => new Date(2026, 9, 27 - back, h, min)

type Lv = Partial<Record<EnergyArea, number>>
let seq = 0
const ci = (at: Date, lv: Lv = {}): EnergyCheckin => ({
  id: `c${++seq}`,
  at: at.toISOString(),
  levels: { koerper: 3, gefuehl: 3, geist: 3, sinn: 3, ...lv } as Record<EnergyArea, EnergyLevel>,
})
const lvl = (n: number) => n as EnergyLevel
const run = (hack: string, before: number | undefined, after: number | undefined, at: Date = ago(1)): HackRun => ({
  id: `r${++seq}`,
  at: at.toISOString(),
  hack,
  area: 'geist',
  seconds: 120,
  ...(before === undefined ? {} : { before: lvl(before) }),
  ...(after === undefined ? {} : { after: lvl(after) }),
})
/** Wirkungen eines Hacks als Läufe: je Wert ein bewerteter Lauf (Stufen bleiben zwischen 1 und 5). */
const effects = (hack: string, ...deltas: number[]) => deltas.map((x) => (x >= 0 ? run(hack, 1, 1 + x) : run(hack, 5, 5 + x)))
const sprint = (at: Date, seconds: number): FocusSprint => ({ id: `s${++seq}`, at: at.toISOString(), planned: 50, seconds })

test('Zeitzone Europe/Berlin (sonst prüft der Sommerzeit-Test nichts)', () => {
  expect([d(24).getTimezoneOffset(), d(26).getTimezoneOffset()]).toEqual([-120, -60])
})

describe('neuester und frischer Check-in', () => {
  test('Konstanten', () => {
    expect(FRESH_HOURS).toBe(3)
    expect(PATTERN_MIN).toBe(7)
  })
  test('latestCheckin: der mit dem größten Zeitpunkt, unabhängig von der Reihenfolge; leer ergibt null', () => {
    const a = ci(ago(2)), b = ci(ago(0, 9)), c = ci(ago(1))
    expect(latestCheckin([b, a, c])).toBe(b)
    expect(latestCheckin([a, c, b])).toBe(b)
    expect(latestCheckin([])).toBeNull()
  })
  test('frisch: Check-in von 23:30 ist am Folgetag um 1:00 frisch, um 2:31 nicht mehr', () => {
    const c = ci(d(26, 23, 30))
    expect(freshCheckin([c], d(27, 1, 0))).toBe(c)
    expect(freshCheckin([c], d(27, 2, 30))).toBe(c)
    expect(freshCheckin([c], d(27, 2, 31))).toBeNull()
  })
  test('ein Check-in in der Zukunft ist nicht frisch; ein früherer gültiger gilt weiter', () => {
    const future = ci(d(27, 15, 5))
    const valid = ci(d(27, 14, 0))
    expect(freshCheckin([future], NOW)).toBeNull()
    expect(freshCheckin([future, valid], NOW)).toBe(valid)
    expect(freshCheckin([ci(NOW)], NOW)).not.toBeNull()
  })
  test('frisch: von mehreren gültigen der jüngste; ohne Check-ins null', () => {
    const older = ci(d(27, 13, 0)), newer = ci(d(27, 14, 30))
    expect(freshCheckin([newer, older], NOW)).toBe(newer)
    expect(freshCheckin([], NOW)).toBeNull()
  })
})

describe('Kopfzeile', () => {
  test('Check-in von 23:30: um 23:45 „vor 15 Min“, am Folgetag um 1:00 „Noch kein Check-in heute“', () => {
    const c = ci(d(26, 23, 30))
    expect(headerLine([c], d(26, 23, 45))).toBe('Letzter Check-in vor 15 Min')
    expect(headerLine([c], d(27, 1, 0))).toBe('Noch kein Check-in heute')
  })
  test('unter einer Minute zählt als 1 Min, ab 60 Min in vollen Stunden abgerundet', () => {
    const c = ci(d(27, 9, 0))
    expect(headerLine([c], d(27, 9, 0))).toBe('Letzter Check-in vor 1 Min')
    expect(headerLine([c], new Date(2026, 9, 27, 9, 0, 59))).toBe('Letzter Check-in vor 1 Min')
    expect(headerLine([c], d(27, 9, 59))).toBe('Letzter Check-in vor 59 Min')
    expect(headerLine([c], d(27, 10, 0))).toBe('Letzter Check-in vor 1 Std.')
    expect(headerLine([c], d(27, 11, 10))).toBe('Letzter Check-in vor 2 Std.')
    expect(headerLine([c], d(27, 11, 59))).toBe('Letzter Check-in vor 2 Std.')
    expect(headerLine([c], d(27, 23, 45))).toBe('Letzter Check-in vor 14 Std.')
  })
  test('ohne Check-in oder mit einem von gestern: „Noch kein Check-in heute“', () => {
    expect(headerLine([], NOW)).toBe('Noch kein Check-in heute')
    expect(headerLine([ci(ago(1, 20))], NOW)).toBe('Noch kein Check-in heute')
  })
  test('maßgeblich ist der neueste Check-in', () => {
    expect(headerLine([ci(d(27, 8, 0)), ci(d(27, 14, 40))], NOW)).toBe('Letzter Check-in vor 20 Min')
  })
})

describe('weakestArea', () => {
  test('der niedrigste Bereich', () => {
    expect(weakestArea({ koerper: 3, gefuehl: 4, geist: 1, sinn: 2 })).toBe('geist')
  })
  test('bei Gleichstand nach der festen Reihenfolge', () => {
    expect(weakestArea({ koerper: 3, gefuehl: 2, geist: 2, sinn: 4 })).toBe('gefuehl')
    expect(weakestArea({ koerper: 3, gefuehl: 3, geist: 3, sinn: 3 })).toBe('koerper')
  })
})

describe('hackStats', () => {
  test('bewertet = vorher und nachher; Schnitt der Wirkung; letzter Lauf aus allen Läufen', () => {
    const runs = [
      run('seufzer', 2, 4, ago(5)),
      run('seufzer', 3, 4, ago(3)),
      run('seufzer', undefined, 5, ago(1)), // unbewertet, aber der jüngste Lauf
      run('big-domino', 2, 2, ago(2)),
    ]
    const stats = hackStats(runs)
    expect(stats.get('seufzer')).toEqual({ rated: 2, mean: 1.5, lastAt: ago(1).toISOString() })
    expect(stats.get('big-domino')).toEqual({ rated: 1, mean: 0, lastAt: ago(2).toISOString() })
    expect(stats.get('wofuer')).toBeUndefined()
  })
  test('ohne bewertete Läufe ist der Schnitt null', () => {
    const stats = hackStats([run('seufzer', undefined, undefined, ago(2)), run('seufzer', 3, undefined, ago(4))])
    expect(stats.get('seufzer')).toEqual({ rated: 0, mean: null, lastAt: ago(2).toISOString() })
  })
  test('die Reihenfolge der Läufe spielt keine Rolle', () => {
    const a = run('seufzer', 2, 3, ago(1)), b = run('seufzer', 2, 3, ago(4))
    expect(hackStats([a, b]).get('seufzer')?.lastAt).toBe(ago(1).toISOString())
    expect(hackStats([b, a]).get('seufzer')?.lastAt).toBe(ago(1).toISOString())
  })
})

describe('whatWorks', () => {
  test('Hack A (+2, +1; Schnitt 1,5) steht vor Hack B (+1, +1, +1; Schnitt 1)', () => {
    const runs = [...effects('seufzer', 1, 1, 1), ...effects('kopf-leeren', 2, 1)]
    const w = whatWorks(runs)
    expect(w.map((x) => x.hack.id)).toEqual(['kopf-leeren', 'seufzer'])
    expect(w[0]).toMatchObject({ mean: 1.5, rated: 2 })
    expect(w[1]).toMatchObject({ mean: 1, rated: 3 })
  })
  test('ein einziger bewerteter Lauf reicht nicht, Schnitt 0 und darunter auch nicht', () => {
    const runs = [
      ...effects('seufzer', 2, 1), // zählt
      ...effects('tageslicht', 3), // nur ein bewerteter Lauf
      ...effects('big-domino', 1, -1), // Schnitt 0
      ...effects('wofuer', -1, -2), // Schnitt unter 0
      run('wach-atmung', undefined, 4), run('wach-atmung', 2, undefined), // unbewertet
    ]
    expect(whatWorks(runs).map((x) => x.hack.id)).toEqual(['seufzer'])
  })
  test('bei gleichem Schnitt steht der mit mehr bewerteten Läufen vorn, dann die Katalog-Reihenfolge', () => {
    const runs = [
      ...effects('wach-atmung', 1, 1), // Schnitt 1, 2 Läufe
      ...effects('seufzer', 1, 1, 1), // Schnitt 1, 3 Läufe
      ...effects('kopf-leeren', 1, 1), // Schnitt 1, 2 Läufe, im Katalog nach wach-atmung
    ]
    expect(whatWorks(runs).map((x) => x.hack.id)).toEqual(['seufzer', 'wach-atmung', 'kopf-leeren'])
    const reversed = [...effects('kopf-leeren', 1, 1), ...effects('wach-atmung', 1, 1)]
    expect(whatWorks(reversed).map((x) => x.hack.id)).toEqual(['wach-atmung', 'kopf-leeren'])
  })
  test('höchstens 3 Einträge', () => {
    const runs = [
      ...effects('seufzer', 1, 1), ...effects('kopf-leeren', 2, 2), ...effects('wach-atmung', 1, 2), ...effects('wofuer', 3, 3),
    ]
    expect(whatWorks(runs).map((x) => x.hack.id)).toEqual(['wofuer', 'kopf-leeren', 'wach-atmung'])
  })
  test('Läufe mit unbekanntem Hack zählen nicht', () => {
    const runs = [...effects('gibt-es-nicht', 3, 3, 3), ...effects('seufzer', 1, 1)]
    expect(whatWorks(runs).map((x) => x.hack.id)).toEqual(['seufzer'])
  })
  test('ohne Läufe leer', () => {
    expect(whatWorks([])).toEqual([])
  })
  test('effectLabel: eine Nachkommastelle mit Komma, 1 im Singular', () => {
    expect(effectLabel(1.25)).toBe('+1,3 Stufen')
    expect(effectLabel(1)).toBe('+1 Stufe')
    expect(effectLabel(1.2)).toBe('+1,2 Stufen')
    expect(effectLabel(1.5)).toBe('+1,5 Stufen')
    expect(effectLabel(2)).toBe('+2 Stufen')
    expect(effectLabel(0.5)).toBe('+0,5 Stufen')
    expect(effectLabel(0.96)).toBe('+1 Stufe')
  })
  test('Hinweis ohne Treffer', () => {
    expect(WHAT_WORKS_HINT).toBe('Bewerte nach einem Hack kurz, wie es dir jetzt geht. Ab zwei Bewertungen je Hack siehst du hier, was bei dir wirkt.')
  })
})

describe('weekGrid', () => {
  test('7 Tage bis heute, ältester zuerst, beschriftet nach Wochentag', () => {
    const grid = weekGrid([], NOW)
    expect(grid).toHaveLength(7)
    expect(grid.map((g) => g.key)).toEqual([
      '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27',
    ])
    expect(grid.map((g) => g.short)).toEqual(['Mi', 'Do', 'Fr', 'Sa', 'So', 'Mo', 'Di'])
    expect(grid.map((g) => g.long)).toEqual(['Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag', 'Montag', 'Dienstag'])
  })
  test('ohne Check-ins sind alle Felder null', () => {
    for (const day of weekGrid([], NOW)) expect(day.cells).toEqual({ koerper: null, gefuehl: null, geist: null, sinn: null })
  })
  test('zwei Check-ins am selben Tag mit Geist 2 und 3 ergeben 2,5', () => {
    const grid = weekGrid([ci(d(27, 8), { geist: 2 }), ci(d(27, 14), { geist: 3, koerper: 5 })], NOW)
    const today = grid[6]
    expect(today.cells.geist).toBe(2.5)
    expect(today.cells.koerper).toBe(4)
    expect(cellLabel('geist', today.long, today.cells.geist)).toBe('Geist, Dienstag: 2,5 von 5')
    expect(cellLabel('koerper', today.long, today.cells.koerper)).toBe('Körper, Dienstag: 4 von 5')
  })
  test('ein Tag ohne Check-in hat null und „kein Check-in“', () => {
    const grid = weekGrid([ci(d(27, 8), { geist: 2 })], NOW)
    expect(grid[5].cells.geist).toBeNull()
    expect(cellLabel('geist', grid[5].long, grid[5].cells.geist)).toBe('Geist, Montag: kein Check-in')
  })
  test('Mitternacht Ortszeit trennt die Tage: 0:30 gehört zum neuen Tag, 23:59 zum alten', () => {
    const grid = weekGrid([ci(d(27, 0, 30), { sinn: 1 }), ci(d(26, 23, 59), { sinn: 5 })], NOW)
    expect(grid[6].cells.sinn).toBe(1)
    expect(grid[5].cells.sinn).toBe(5)
  })
  test('Check-ins außerhalb der sieben Tage und in der Zukunft zählen nicht', () => {
    const grid = weekGrid([ci(ago(7), { geist: 1 }), ci(ago(-1), { geist: 1 })], NOW)
    for (const day of grid) expect(day.cells.geist).toBeNull()
    expect(weekGrid([ci(ago(6, 0, 5), { geist: 4 })], NOW)[0].cells.geist).toBe(4)
  })
  test('die Sommerzeit-Umstellung (25.10.) verschiebt keinen Tag', () => {
    const grid = weekGrid([ci(d(25, 0, 10), { geist: 2 }), ci(d(25, 23, 50), { geist: 4 })], NOW)
    expect(grid[4].key).toBe('2026-10-25')
    expect(grid[4].cells.geist).toBe(3)
    expect(grid[3].cells.geist).toBeNull()
    expect(grid[5].cells.geist).toBeNull()
  })
  test('cellLevel rundet auf eine ganze Stufe', () => {
    expect(cellLevel(2.5)).toBe(3)
    expect(cellLevel(2.4)).toBe(2)
    expect(cellLevel(1)).toBe(1)
    expect(cellLevel(4.6)).toBe(5)
    expect(cellLevel(5)).toBe(5)
  })
})

describe('Muster-Sätze', () => {
  /** Je ein Check-in an `n` Tagen, alle mittags (Tageszeit „tag“), damit keine Tageszeit-Lücke entsteht. */
  const noon = (n: number, lv: Lv = {}) => Array.from({ length: n }, (_, i) => ci(ago(i, 12), lv))

  test('ab sieben Check-ins in den letzten 14 Tagen', () => {
    expect(hasPatternData(noon(6), NOW)).toBe(false)
    expect(hasPatternData(noon(7), NOW)).toBe(true)
    expect(hasPatternData([], NOW)).toBe(false)
  })
  test('die 14 Tage sind heute und die 13 davor; Älteres und Künftiges zählt nicht', () => {
    const six = noon(6)
    expect(hasPatternData([...six, ci(ago(13, 0, 5))], NOW)).toBe(true)
    expect(hasPatternData([...six, ci(ago(14, 23, 59))], NOW)).toBe(false)
    expect(hasPatternData([...six, ci(ago(-1))], NOW)).toBe(false)
  })
  test('unter 7 Check-ins: keine Sätze', () => {
    expect(patternSentences(noon(6, { geist: 1 }), NOW)).toEqual([])
    expect(PATTERN_HINT).toBe('Ab sieben Check-ins in zwei Wochen zeigt dir die App hier deine Muster.')
  })

  describe('Satz 1: schwächster Bereich', () => {
    test('der Bereich mit dem niedrigsten Schnitt der letzten 14 Tage', () => {
      expect(patternSentences(noon(7, { geist: 2, sinn: 4 }), NOW)).toEqual(['Am niedrigsten ist zurzeit dein Geist.'])
    })
    test('bei Gleichstand nach der festen Reihenfolge', () => {
      expect(patternSentences(noon(7), NOW)).toEqual(['Am niedrigsten ist zurzeit dein Körper.'])
      expect(patternSentences(noon(7, { koerper: 4 }), NOW)).toEqual(['Am niedrigsten ist zurzeit dein Gefühl.'])
    })
    test('zählt nur die letzten 14 Tage', () => {
      // Fünf ältere Check-ins mit Körper 1 würden Körper nach unten ziehen; sie zählen nicht, Gefühl bleibt der schwächste.
      const old = [14, 15, 16, 17, 18].map((i) => ci(ago(i, 12), { koerper: 1 }))
      expect(patternSentences([...noon(7, { gefuehl: 2 }), ...old], NOW)).toEqual(['Am niedrigsten ist zurzeit dein Gefühl.'])
    })
  })

  describe('Satz 2: Tageszeit', () => {
    /** 4 Check-ins um `otherHour` (alle Bereiche 3, Geist `other`) und 3 um `hour` (Geist `low`). */
    const geistAt = (hour: number, otherHour: number, low = 2, other = 3) => [
      ...[0, 1, 2, 3].map((i) => ci(ago(i, otherHour), { geist: other })),
      ...[4, 5, 6].map((i) => ci(ago(i, hour), { geist: low })),
    ]

    test('Geist nachmittags eine Stufe tiefer: Satz 2 steht an erster Stelle, Satz 1 (derselbe Bereich) entfällt', () => {
      expect(patternSentences(geistAt(14, 9), NOW)).toEqual(['Dein Geist ist tagsüber am niedrigsten.'])
    })
    test('morgens, tagsüber und abends', () => {
      expect(patternSentences(geistAt(8, 14), NOW)).toEqual(['Dein Geist ist morgens am niedrigsten.'])
      expect(patternSentences(geistAt(14, 20), NOW)).toEqual(['Dein Geist ist tagsüber am niedrigsten.'])
      expect(patternSentences(geistAt(20, 9), NOW)).toEqual(['Dein Geist ist abends am niedrigsten.'])
    })
    test('Tagesgrenzen: 5, 11 und 17 Uhr beginnen morgens, tagsüber, abends; 4:59 gehört zum Abend', () => {
      expect(patternSentences(geistAt(5, 14), NOW)).toEqual(['Dein Geist ist morgens am niedrigsten.'])
      expect(patternSentences(geistAt(11, 9), NOW)).toEqual(['Dein Geist ist tagsüber am niedrigsten.'])
      expect(patternSentences(geistAt(17, 9), NOW)).toEqual(['Dein Geist ist abends am niedrigsten.'])
      expect(patternSentences(geistAt(4, 9), NOW)).toEqual(['Dein Geist ist abends am niedrigsten.'])
    })
    test('ein anderer Bereich als in Satz 1: beide Sätze, Satz 1 zuerst', () => {
      // Sinn ist überall 1 (schwächster Bereich, aber ohne Tageszeit-Lücke); Geist fällt nachmittags ab.
      const data = [
        ...[0, 1, 2, 3].map((i) => ci(ago(i, 9), { sinn: 1 })),
        ...[4, 5, 6].map((i) => ci(ago(i, 14), { sinn: 1, geist: 2 })),
      ]
      expect(patternSentences(data, NOW)).toEqual([
        'Am niedrigsten ist zurzeit dein Sinn.',
        'Dein Geist ist tagsüber am niedrigsten.',
      ])
    })
    test('mit nur 2 Check-ins in der Tageszeit entfällt der Satz', () => {
      const data = [
        ...[0, 1, 2, 3, 4].map((i) => ci(ago(i, 9), { geist: 4 })),
        ...[5, 6].map((i) => ci(ago(i, 14), { geist: 1 })),
      ]
      expect(patternSentences(data, NOW)).toEqual(['Am niedrigsten ist zurzeit dein Körper.'])
    })
    test('ein Abstand unter einer Stufe reicht nicht, genau eine Stufe schon', () => {
      const below = [
        ...[0, 1, 2, 3].map((i) => ci(ago(i, 9), { geist: i < 2 ? 4 : 3 })), // Schnitt 3,5
        ...[4, 5, 6].map((i) => ci(ago(i, 14), { geist: 3 })), // Abstand 0,5
      ]
      expect(patternSentences(below, NOW).some((s) => s.startsWith('Dein Geist ist'))).toBe(false)
      expect(patternSentences(geistAt(14, 9, 2, 3), NOW)).toContain('Dein Geist ist tagsüber am niedrigsten.')
    })
    test('der größte Abstand gewinnt', () => {
      // Körper fällt nachmittags um 1 Stufe, Sinn um 2: Sinn wird genannt.
      const data = [
        ...[0, 1, 2, 3].map((i) => ci(ago(i, 9), { koerper: 4, sinn: 4 })),
        ...[4, 5, 6].map((i) => ci(ago(i, 14), { koerper: 3, sinn: 2 })),
      ]
      expect(patternSentences(data, NOW)).toContain('Dein Sinn ist tagsüber am niedrigsten.')
      expect(patternSentences(data, NOW)).not.toContain('Dein Körper ist tagsüber am niedrigsten.')
    })
    test('gleicher Abstand: der Bereich in der festen Reihenfolge zuerst', () => {
      const data = [
        ...[0, 1, 2, 3].map((i) => ci(ago(i, 9), { koerper: 4, geist: 4 })),
        ...[4, 5, 6].map((i) => ci(ago(i, 14), { koerper: 3, geist: 3 })),
      ]
      expect(patternSentences(data, NOW)).toContain('Dein Körper ist tagsüber am niedrigsten.')
      expect(patternSentences(data, NOW)).not.toContain('Dein Geist ist tagsüber am niedrigsten.')
    })
    test('gleicher Abstand in mehreren Tageszeiten: morgens vor tagsüber vor abends', () => {
      // Geist: morgens 2 (3×), tagsüber 2 (3×), abends 4 (3×): beide Lücken 4−2 = 2 gegen den Rest... Rest morgens = (2·3+4·3)/6 = 3, also 1.
      const data = [
        ...[0, 1, 2].map((i) => ci(ago(i, 9), { geist: 2 })),
        ...[3, 4, 5].map((i) => ci(ago(i, 14), { geist: 2 })),
        ...[6, 7, 8].map((i) => ci(ago(i, 20), { geist: 4 })),
      ]
      const s = patternSentences(data, NOW)
      expect(s).toContain('Dein Geist ist morgens am niedrigsten.')
      expect(s).not.toContain('Dein Geist ist tagsüber am niedrigsten.')
    })
  })

  describe('Satz 3: Trend', () => {
    /** Körper je Check-in dieser Woche und der Woche davor; alles mittags, übrige Bereiche 3. */
    const trend = (thisWeek: number[], before: number[], lv: Lv = {}) => [
      ...thisWeek.map((k, i) => ci(ago(i % 7, 12), { ...lv, koerper: k })),
      ...before.map((k, i) => ci(ago(7 + (i % 7), 12), { ...lv, koerper: k })),
    ]
    const only3 = (s: string[]) => s.filter((x) => x.includes('diese Woche'))

    test('Körper 1,5 Stufen über der Vorwoche, je mehr als 2 Check-ins', () => {
      // Diese Woche 3,5 (21 / 6), Vorwoche 2. Schwächster Bereich bleibt Gefühl (3).
      expect(patternSentences(trend([4, 4, 4, 3, 3, 3], [2, 2]), NOW)).toEqual([
        'Am niedrigsten ist zurzeit dein Gefühl.',
        'Dein Körper liegt diese Woche 1,5 Stufen höher als in der Woche davor.',
      ])
    })
    test('0,5 Stufen: „eine halbe Stufe“', () => {
      expect(only3(patternSentences(trend([3, 4], [3, 3, 3, 3, 3]), NOW))).toEqual([
        'Dein Körper liegt diese Woche eine halbe Stufe höher als in der Woche davor.',
      ])
    })
    test('1 Stufe und 2 Stufen, tiefer', () => {
      expect(only3(patternSentences(trend([2, 2, 2], [3, 3, 3, 3]), NOW))).toEqual([
        'Dein Körper liegt diese Woche 1 Stufe tiefer als in der Woche davor.',
      ])
      expect(only3(patternSentences(trend([4, 4, 4], [2, 2, 2, 2]), NOW))).toEqual([
        'Dein Körper liegt diese Woche 2 Stufen höher als in der Woche davor.',
      ])
      expect(only3(patternSentences(trend([1, 1, 1], [3, 3, 3, 3]), NOW))).toEqual([
        'Dein Körper liegt diese Woche 2 Stufen tiefer als in der Woche davor.',
      ])
    })
    test('der Unterschied wird auf halbe Stufen gerundet', () => {
      // 24/7 − 3 = 0,43: unter 0,5, also kein Satz.
      expect(only3(patternSentences(trend([3, 3, 3, 3, 4, 4, 4], [3, 3, 3, 3]), NOW))).toEqual([])
      // 3,75 − 3 = 0,75 → 1 Stufe.
      expect(only3(patternSentences(trend([4, 4, 4, 3], [3, 3, 3]), NOW))).toEqual([
        'Dein Körper liegt diese Woche 1 Stufe höher als in der Woche davor.',
      ])
      // 3,6 − 3 = 0,6 → eine halbe Stufe.
      expect(only3(patternSentences(trend([4, 4, 4, 3, 3], [3, 3]), NOW))).toEqual([
        'Dein Körper liegt diese Woche eine halbe Stufe höher als in der Woche davor.',
      ])
    })
    test('unter 0,5 Stufen kein Satz', () => {
      expect(only3(patternSentences(trend([3, 3, 3, 3, 4], [3, 3, 3, 3]), NOW))).toEqual([])
    })
    test('mit nur einem Check-in in einer der Wochen kein Trend', () => {
      expect(only3(patternSentences(trend([4, 4, 4, 4, 4, 4], [1]), NOW))).toEqual([])
      expect(only3(patternSentences(trend([4], [1, 1, 1, 1, 1, 1]), NOW))).toEqual([])
    })
    test('der größte Unterschied gewinnt', () => {
      // Körper +0,5, Sinn +1: Sinn wird genannt.
      const data = [
        ...[4, 4, 4, 3, 3, 3].map((k, i) => ci(ago(i, 12), { koerper: k, sinn: 4 })),
        ...[0, 1].map((i) => ci(ago(7 + i, 12), { koerper: 3, sinn: 3 })),
      ]
      expect(patternSentences(data, NOW)).toEqual([
        'Am niedrigsten ist zurzeit dein Gefühl.',
        'Dein Sinn liegt diese Woche 1 Stufe höher als in der Woche davor.',
      ])
    })
    test('bei gleichem Unterschied zählt die feste Reihenfolge', () => {
      const data = [
        ...[0, 1, 2].map((i) => ci(ago(i, 12), { geist: 4, sinn: 4, koerper: 3 })),
        ...[0, 1, 2, 3].map((i) => ci(ago(7 + i, 12), { geist: 3, sinn: 3, koerper: 3 })),
      ]
      expect(only3(patternSentences(data, NOW))).toEqual(['Dein Geist liegt diese Woche 1 Stufe höher als in der Woche davor.'])
    })
  })

  test('höchstens zwei Sätze, in der Reihenfolge 1, 2, 3', () => {
    // Sinn überall 1 (Satz 1); Geist nachmittags tiefer (Satz 2); Körper steigt von 1 auf 3 (Satz 3, entfällt).
    const data = [
      ...[0, 1, 2, 3].map((i) => ci(ago(i, 9), { sinn: 1 })),
      ...[4, 5, 6].map((i) => ci(ago(i, 14), { sinn: 1, geist: 2 })),
      ...[7, 8].map((i) => ci(ago(i, 9), { sinn: 1, koerper: 1 })),
    ]
    const s = patternSentences(data, NOW)
    expect(s).toHaveLength(2)
    expect(s).toEqual(['Am niedrigsten ist zurzeit dein Sinn.', 'Dein Geist ist tagsüber am niedrigsten.'])
  })
  test('Satz 2 und Satz 3 zusammen, wenn Satz 1 wegfällt', () => {
    // Geist nachmittags tiefer (Satz 2, nennt auch den schwächsten Bereich → Satz 1 entfällt); Körper steigt (Satz 3).
    const data = [
      ...[0, 1, 2, 3].map((i) => ci(ago(i, 9), { geist: 3, koerper: 4 })),
      ...[4, 5, 6].map((i) => ci(ago(i, 14), { geist: 1, koerper: 4 })),
      ...[7, 8].map((i) => ci(ago(i, 9), { geist: 3, koerper: 2 })),
    ]
    expect(patternSentences(data, NOW)).toEqual([
      'Dein Geist ist tagsüber am niedrigsten.',
      'Dein Körper liegt diese Woche 2 Stufen höher als in der Woche davor.',
    ])
  })
})

describe('focusLine', () => {
  test('4 Sprints mit zusammen 200 Min', () => {
    const s = [sprint(ago(0, 9), 3000), sprint(ago(1, 9), 3000), sprint(ago(2, 9), 3000), sprint(ago(3, 9), 3000)]
    // 4 × 3000 s = 200 Min
    expect(focusLine(s, NOW)).toBe('Diese Woche: 4 Sprints, 3 Std. 20 Min Fokus')
  })
  test('ein Sprint im Singular, unter 60 Min nur Minuten', () => {
    expect(focusLine([sprint(ago(0, 9), 1500)], NOW)).toBe('Diese Woche: 1 Sprint, 25 Min Fokus')
  })
  test('volle Stunden ohne „0 Min“', () => {
    expect(focusLine([sprint(ago(0), 5400), sprint(ago(1), 5400)], NOW)).toBe('Diese Woche: 2 Sprints, 3 Std. Fokus')
    expect(focusLine([sprint(ago(0), 3600)], NOW)).toBe('Diese Woche: 1 Sprint, 1 Std. Fokus')
  })
  test('die Minuten kommen aus der Summe der Sekunden, abgerundet', () => {
    expect(focusLine([sprint(ago(0), 1799), sprint(ago(1), 1799)], NOW)).toBe('Diese Woche: 2 Sprints, 59 Min Fokus')
  })
  test('ohne Sprint in den letzten 7 Tagen null', () => {
    expect(focusLine([], NOW)).toBeNull()
    expect(focusLine([sprint(ago(7, 23, 59), 1500)], NOW)).toBeNull()
    expect(focusLine([sprint(ago(-1), 1500)], NOW)).toBeNull()
  })
  test('die Woche sind heute und die 6 Tage davor', () => {
    expect(focusLine([sprint(ago(6, 0, 1), 1500), sprint(ago(7, 23, 59), 3000)], NOW)).toBe('Diese Woche: 1 Sprint, 25 Min Fokus')
  })
})
