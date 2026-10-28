process.env.TZ = 'Europe/Berlin'
import { describe, expect, test } from 'vitest'
import { pauseSuggestion, resetOrder, resetSequence } from '../../src/lib/energy/reset'
import { AREAS, type EnergyArea, type EnergyLevel } from '../../src/lib/energy/areas'
import { HACKS, hacksIn, inWindow } from '../../src/lib/energy/hacks'
import type { EnergyCheckin, HackRun } from '../../src/lib/stats/schema'

// Lokale Zeiten, damit die Tests von der Zeitzone des Rechners nicht abhängen. 27.10.2026 ist ein Dienstag.
const at = (h: number, min = 0, day = 27) => new Date(2026, 9, day, h, min)
const NOON = at(12)
const ago = (back: number, h = 12) => new Date(2026, 9, 27 - back, h)

let seq = 0
const run = (hack: string, before: number | undefined, after: number | undefined, when: Date = ago(1)): HackRun => ({
  id: `r${++seq}`,
  at: when.toISOString(),
  hack,
  area: 'geist',
  seconds: 120,
  ...(before === undefined ? {} : { before: before as EnergyLevel }),
  ...(after === undefined ? {} : { after: after as EnergyLevel }),
})
/** Bewertete Läufe eines Hacks mit den gegebenen Wirkungen (Stufen bleiben zwischen 1 und 5). */
const effects = (hack: string, deltas: number[], when: Date = ago(1)) =>
  deltas.map((x) => (x >= 0 ? run(hack, 1, 1 + x, when) : run(hack, 5, 5 + x, when)))
const checkin = (when: Date, lv: Partial<Record<EnergyArea, number>>): EnergyCheckin => ({
  id: `c${++seq}`,
  at: when.toISOString(),
  levels: { koerper: 3, gefuehl: 3, geist: 3, sinn: 3, ...lv } as Record<EnergyArea, EnergyLevel>,
})
const ids = (hs: { id: string }[]) => hs.map((h) => h.id)

describe('Reihenfolge im Bereich', () => {
  test('ohne Läufe die Katalog-Reihenfolge des Bereichs', () => {
    for (const area of AREAS) expect(ids(resetOrder(area, [], NOON))).toEqual(ids(hacksIn(area).filter((h) => inWindow(h, NOON))))
  })
  test('Gruppe 1 (≥ 2 bewertet, Schnitt > 0, absteigend) vor Gruppe 2 (< 2 bewertet) vor Gruppe 3 (Schnitt ≤ 0)', () => {
    const runs = [
      ...effects('naechster-schritt', [1, 1]), // Gruppe 1, Schnitt 1
      ...effects('ablenkung-aus', [2, 2]), // Gruppe 1, Schnitt 2
      ...effects('augen-pause', [0, -1]), // Gruppe 3
      // kopf-leeren: nie gelaufen, Gruppe 2
    ]
    expect(ids(resetOrder('geist', runs, NOON))).toEqual(['ablenkung-aus', 'naechster-schritt', 'kopf-leeren', 'augen-pause'])
  })
  test('Gruppe 3 absteigend nach Schnitt; ein bewerteter Lauf allein ordnet in Gruppe 2', () => {
    const runs = [
      ...effects('power-pause', [1, 1]), // Gruppe 1
      ...effects('tageslicht', [-2]), // nur ein bewerteter Lauf: Gruppe 2
      ...effects('wach-atmung', [0, 0]), // Gruppe 3, Schnitt 0
      ...effects('bewegungs-snack', [-1, -1]), // Gruppe 3, Schnitt −1
      // strecken und wach-klopfen: nie gelaufen, Gruppe 2 und dort vor tageslicht (wasser-licht fehlt mittags, Fenster 4 bis 12 Uhr)
    ]
    expect(ids(resetOrder('koerper', runs, NOON))).toEqual([
      'power-pause', 'strecken', 'wach-klopfen', 'tageslicht', 'wach-atmung', 'bewegungs-snack',
    ])
  })
  test('unbewertete Läufe machen einen Hack nicht bewertet; unbekannte Hacks stören nicht', () => {
    const runs = [
      run('naechster-schritt', undefined, 5), run('naechster-schritt', 1, undefined), run('naechster-schritt', undefined, undefined),
      ...effects('gibt-es-nicht', [3, 3, 3]),
      ...effects('kopf-leeren', [1, 1]),
    ]
    // kopf-leeren (Gruppe 1) vorn; die übrigen drei Gruppe 2: ablenkung-aus und augen-pause nie gelaufen, naechster-schritt zuletzt.
    expect(ids(resetOrder('geist', runs, NOON))).toEqual(['kopf-leeren', 'ablenkung-aus', 'augen-pause', 'naechster-schritt'])
  })
  test('Gleichstand: zuerst der am längsten nicht gelaufene, nie gelaufen zuerst', () => {
    const runs = [
      run('kopf-leeren', undefined, undefined, ago(1)),
      run('naechster-schritt', undefined, undefined, ago(5)),
      run('augen-pause', undefined, undefined, ago(3)),
      // ablenkung-aus: nie gelaufen
    ]
    expect(ids(resetOrder('geist', runs, NOON))).toEqual(['ablenkung-aus', 'naechster-schritt', 'augen-pause', 'kopf-leeren'])
  })
  test('Gleichstand in Gruppe 1: der Ältere zuerst, nicht der im Katalog Frühere', () => {
    const runs = [
      ...effects('kopf-leeren', [1, 1], ago(1)),
      ...effects('ablenkung-aus', [1, 1], ago(4)),
    ]
    expect(ids(resetOrder('geist', runs, NOON)).slice(0, 2)).toEqual(['ablenkung-aus', 'kopf-leeren'])
  })
  test('Gleichstand in Gruppe 3 und bei gleichem letztem Lauf: Katalog-Reihenfolge', () => {
    const runs = [
      ...effects('augen-pause', [0, 0], ago(2)),
      ...effects('naechster-schritt', [0, 0], ago(2)),
      ...effects('kopf-leeren', [0, 0], ago(2)),
    ]
    expect(ids(resetOrder('geist', runs, NOON))).toEqual(['ablenkung-aus', 'kopf-leeren', 'naechster-schritt', 'augen-pause'])
  })
  test('der letzte Lauf zählt auch bei unbewerteten Läufen; die Reihenfolge der Liste ist egal', () => {
    const rated = effects('kopf-leeren', [1, 1], ago(9))
    const recent = run('kopf-leeren', undefined, undefined, ago(0, 8))
    const other = effects('naechster-schritt', [1, 1], ago(3))
    // Schnitt gleich (1); kopf-leeren lief zuletzt vor wenigen Stunden, naechster-schritt vor 3 Tagen → der zuerst.
    expect(ids(resetOrder('geist', [recent, ...other, ...rated], NOON)).slice(0, 2)).toEqual(['naechster-schritt', 'kopf-leeren'])
  })
  test('gibt nur Hacks des Bereichs zurück', () => {
    for (const area of AREAS) expect(resetOrder(area, [], NOON).every((h) => h.area === area)).toBe(true)
  })
})

describe('Zeitfenster', () => {
  const has = (area: EnergyArea, hack: string, now: Date) => ids(resetOrder(area, [], now)).includes(hack)
  test('power-pause (11 bis 16 Uhr): um 10:59 nicht, um 11:00 schon, um 15:59 noch, um 16:00 nicht', () => {
    expect(has('koerper', 'power-pause', at(10, 59))).toBe(false)
    expect(has('koerper', 'power-pause', at(11, 0))).toBe(true)
    expect(has('koerper', 'power-pause', at(15, 59))).toBe(true)
    expect(has('koerper', 'power-pause', at(16, 0))).toBe(false)
  })
  test('tageslicht (7 bis 17 Uhr): um 6:30 nicht, um 7:00 schon, um 17:00 nicht mehr', () => {
    expect(has('koerper', 'tageslicht', at(6, 30))).toBe(false)
    expect(has('koerper', 'tageslicht', at(7, 0))).toBe(true)
    expect(has('koerper', 'tageslicht', at(17, 0))).toBe(false)
  })
  test('wasser-licht (4 bis 12 Uhr): um 3:59 nicht, um 4:00 schon, um 11:59 noch, um 12:00 nicht', () => {
    expect(has('koerper', 'wasser-licht', at(3, 59))).toBe(false)
    expect(has('koerper', 'wasser-licht', at(4, 0))).toBe(true)
    expect(has('koerper', 'wasser-licht', at(11, 59))).toBe(true)
    expect(has('koerper', 'wasser-licht', at(12, 0))).toBe(false)
  })
  test('um 6:30 fehlen power-pause und tageslicht, die anderen bleiben', () => {
    expect(ids(resetOrder('koerper', [], at(6, 30)))).toEqual(['bewegungs-snack', 'wach-atmung', 'strecken', 'wasser-licht', 'wach-klopfen'])
  })
  test('um 14 Uhr fehlt wasser-licht, die übrigen sechs Körper-Hacks stehen in Katalog-Reihenfolge', () => {
    expect(ids(resetOrder('koerper', [], at(14, 0)))).toEqual([
      'bewegungs-snack', 'tageslicht', 'wach-atmung', 'power-pause', 'strecken', 'wach-klopfen',
    ])
  })
  test('ein Hack außerhalb des Fensters bleibt auch mit bester Wirkung draußen', () => {
    const runs = effects('power-pause', [2, 2])
    expect(ids(resetOrder('koerper', runs, at(10, 59)))).not.toContain('power-pause')
    expect(resetOrder('koerper', runs, at(11, 0))[0].id).toBe('power-pause')
  })
})

describe('resetSequence', () => {
  const areaOrder = (seq: { area: EnergyArea }[]) => seq.map((e) => e.area).filter((a, i, all) => all.indexOf(a) === i)

  test('mit Stufen: aufsteigend nach Stufe, Gleichstand nach fester Reihenfolge; start zählt nicht', () => {
    const levels = { koerper: 4, gefuehl: 3, geist: 1, sinn: 3 } as Record<EnergyArea, EnergyLevel>
    const a = resetSequence(levels, 'koerper', [], NOON)
    const b = resetSequence(levels, 'sinn', [], NOON)
    expect(areaOrder(a)).toEqual(['geist', 'gefuehl', 'sinn', 'koerper'])
    expect(b).toEqual(a)
  })
  test('die Folge setzt die Reihenfolgen der Bereiche aneinander', () => {
    const levels = { koerper: 4, gefuehl: 3, geist: 1, sinn: 3 } as Record<EnergyArea, EnergyLevel>
    const runs = effects('ablenkung-aus', [2, 2])
    const seq = resetSequence(levels, 'koerper', runs, NOON)
    const expected = (['geist', 'gefuehl', 'sinn', 'koerper'] as const).flatMap((area) =>
      resetOrder(area, runs, NOON).map((hack) => ({ area, hack })))
    expect(seq).toEqual(expected)
    expect(seq[0].hack.id).toBe('ablenkung-aus')
    expect(seq.every((e) => e.hack.area === e.area)).toBe(true)
    // Mittags fehlt nur wasser-licht (Fenster 4 bis 12 Uhr); alle anderen Hacks stehen in der Folge.
    expect(seq.map((e) => e.hack.id)).not.toContain('wasser-licht')
    expect(seq).toHaveLength(HACKS.length - 1)
  })
  test('ohne Stufen: feste Reihenfolge ab start', () => {
    expect(areaOrder(resetSequence(null, 'sinn', [], NOON))).toEqual(['sinn', 'koerper', 'gefuehl', 'geist'])
    expect(areaOrder(resetSequence(null, 'koerper', [], NOON))).toEqual(['koerper', 'gefuehl', 'geist', 'sinn'])
    expect(areaOrder(resetSequence(null, 'geist', [], NOON))).toEqual(['geist', 'sinn', 'koerper', 'gefuehl'])
  })
  test('Hacks außerhalb des Zeitfensters fehlen in der Folge', () => {
    const seq = resetSequence(null, 'koerper', [], at(6, 30))
    expect(seq.map((e) => e.hack.id)).not.toContain('power-pause')
    expect(seq.map((e) => e.hack.id)).not.toContain('tageslicht')
    expect(seq).toHaveLength(HACKS.length - 2)
  })
  test('bei gleichen Stufen aller Bereiche die feste Reihenfolge', () => {
    const levels = { koerper: 2, gefuehl: 2, geist: 2, sinn: 2 } as Record<EnergyArea, EnergyLevel>
    expect(areaOrder(resetSequence(levels, 'sinn', [], NOON))).toEqual(['koerper', 'gefuehl', 'geist', 'sinn'])
  })
})

describe('pauseSuggestion', () => {
  test('ohne frischen Check-in: nach 25 Min die Augen-Pause, nach 50 und 90 Min der Bewegungs-Snack', () => {
    expect(pauseSuggestion(25, [], [], NOON).id).toBe('augen-pause')
    expect(pauseSuggestion(50, [], [], NOON).id).toBe('bewegungs-snack')
    expect(pauseSuggestion(90, [], [], NOON).id).toBe('bewegungs-snack')
  })
  test('ein Check-in, der nicht mehr frisch ist, zählt wie keiner', () => {
    const old = [checkin(at(8, 0), { geist: 1, koerper: 1 })] // 4 Std. vorher
    expect(pauseSuggestion(25, old, [], NOON).id).toBe('augen-pause')
    expect(pauseSuggestion(50, old, [], NOON).id).toBe('bewegungs-snack')
  })
  test('die Läufe ändern den Vorschlag ohne Check-in nicht', () => {
    const runs = [...effects('kopf-leeren', [2, 2]), ...effects('wach-atmung', [2, 2])]
    expect(pauseSuggestion(25, [], runs, NOON).id).toBe('augen-pause')
    expect(pauseSuggestion(90, [], runs, NOON).id).toBe('bewegungs-snack')
  })
  test('mit frischem Check-in (Geist 1, Körper 3): der erste Geist-Hack der Reihenfolge', () => {
    const c = [checkin(at(11, 30), { geist: 1, koerper: 3 })]
    expect(pauseSuggestion(25, c, [], NOON).id).toBe(resetOrder('geist', [], NOON)[0].id)
    expect(pauseSuggestion(25, c, [], NOON).area).toBe('geist')
    // Mit Wirkungsdaten rückt der wirksamste Geist-Hack vor.
    const runs = effects('augen-pause', [2, 2])
    expect(pauseSuggestion(50, c, runs, NOON).id).toBe('augen-pause')
  })
  test('mit frischem Check-in (Körper tiefer): der erste Körper-Hack; bei Gleichstand Körper', () => {
    const lowBody = [checkin(at(11, 30), { koerper: 2, geist: 4 })]
    expect(pauseSuggestion(25, lowBody, [], NOON).area).toBe('koerper')
    const tie = [checkin(at(11, 30), { koerper: 3, geist: 3, gefuehl: 1, sinn: 1 })]
    expect(pauseSuggestion(25, tie, [], NOON).area).toBe('koerper')
  })
  test('gefragt sind nur Körper und Geist, auch wenn Gefühl oder Sinn am niedrigsten sind', () => {
    const c = [checkin(at(11, 30), { koerper: 4, gefuehl: 1, geist: 3, sinn: 1 })]
    expect(pauseSuggestion(25, c, [], NOON).area).toBe('geist')
  })
  test('fällt der Hack aus dem Zeitfenster, kommt der nächste der Reihenfolge', () => {
    const c = (now: Date) => [checkin(new Date(now.getTime() - 30 * 60_000), { koerper: 1, geist: 4 })]
    const runs = effects('power-pause', [2, 2]) // Gruppe 1 → in der Reihenfolge vorn, aber nur 11 bis 16 Uhr
    const early = at(10, 59)
    expect(pauseSuggestion(25, c(early), runs, early).id).not.toBe('power-pause')
    expect(pauseSuggestion(25, c(early), runs, early).id).toBe(resetOrder('koerper', runs, early)[0].id)
    expect(pauseSuggestion(25, c(at(11, 0)), runs, at(11, 0)).id).toBe('power-pause')
    expect(pauseSuggestion(25, c(at(16, 0)), runs, at(16, 0)).id).not.toBe('power-pause')
  })
  test('ein Check-in in der Zukunft ist nicht frisch', () => {
    const future = [checkin(at(12, 30), { geist: 1, koerper: 3 })]
    expect(pauseSuggestion(25, future, [], NOON).id).toBe('augen-pause')
  })
})
