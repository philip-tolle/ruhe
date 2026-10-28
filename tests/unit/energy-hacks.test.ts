import { describe, expect, test } from 'vitest'
import { AREAS, AREA_INFO, LEVELS, LEVEL_WORD, isEnergyArea, isEnergyLevel, type EnergyArea } from '../../src/lib/energy/areas'
import {
  HACKS,
  HACK_ICONS,
  hackById,
  hackLength,
  hackProblems,
  hacksIn,
  inWindow,
  stepAt,
  stepBoundaries,
  taktAt,
  taktPhases,
  taktShape,
  type Hack,
  type HackGuide,
} from '../../src/lib/energy/hacks'

// Spec M9 §4 und M10 §3.1: Kennung, Titel, Bereich, Minuten, Führung – in Katalog-Reihenfolge.
const TABLE: [string, string, EnergyArea, number, HackGuide][] = [
  ['bewegungs-snack', 'Bewegungs-Snack', 'koerper', 2, 'schritte'],
  ['tageslicht', 'Tageslicht tanken', 'koerper', 5, 'ring'],
  ['wach-atmung', 'Wach-Atmung', 'koerper', 1, 'takt'],
  ['power-pause', 'Power-Pause', 'koerper', 10, 'ring'],
  ['strecken', 'Strecken & Aufrichten', 'koerper', 2, 'schritte'],
  ['wasser-licht', 'Wasser & Licht', 'koerper', 2, 'schritte'],
  ['wach-klopfen', 'Wach-Klopfen', 'koerper', 1, 'schritte'],
  ['seufzer', 'Physiologischer Seufzer', 'gefuehl', 1, 'takt'],
  ['kaltes-gesicht', 'Kaltes Gesicht', 'gefuehl', 1, 'schritte'],
  ['gefuehl-benennen', 'Gefühl benennen', 'gefuehl', 2, 'schritte'],
  ['drei-gute-dinge', 'Drei gute Dinge', 'gefuehl', 2, 'schritte'],
  ['kopf-leeren', 'Kopf leeren', 'geist', 3, 'ring'],
  ['naechster-schritt', 'Nächster kleiner Schritt', 'geist', 2, 'schritte'],
  ['ablenkung-aus', 'Ablenkung aus', 'geist', 1, 'schritte'],
  ['augen-pause', 'Augen-Pause', 'geist', 2, 'ring'],
  ['big-domino', 'Big Domino', 'sinn', 3, 'schritte'],
  ['werte-anker', 'Werte-Anker', 'sinn', 2, 'schritte'],
  ['kleiner-fortschritt', 'Kleiner Fortschritt', 'sinn', 2, 'schritte'],
  ['wofuer', 'Wofür?', 'sinn', 2, 'schritte'],
]

function hack(id: string): Hack {
  const h = hackById(id)
  if (!h) throw new Error(`Hack fehlt: ${id}`)
  return h
}

/** Wörter eines Textes; Satzzeichen wie „–“ oder „…“ allein zählen nicht. */
const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length

const at = (hours: number, minutes: number) => new Date(2026, 9, 27, hours, minutes)

// Gültige Vorlagen für hackProblems; jeder Fehlerfall ändert genau eine Sache.
type Raw = Record<string, unknown>
const step = (seconds?: number): Raw => ({ title: 'Schritt', detail: 'So geht es.', icon: 'stern', ...(seconds === undefined ? {} : { seconds }) })
const phase = (p: string, seconds: number): Raw => ({ phase: p, seconds, say: 'Atmen …' })
const base: Raw = {
  id: 'probe-1',
  title: 'Probe',
  area: 'koerper',
  minutes: 1,
  benefit: 'Ein Satz.',
  why: { from: 'Vorher', to: 'Nachher', text: 'Darum.' },
  source: 'Quelle',
  further: null,
  caution: null,
  window: null,
  link: null,
}
const schritte = (o: Raw = {}): Raw => ({ ...base, guide: 'schritte', steps: [step(30), step(30)], ...o })
const ring = (o: Raw = {}): Raw => ({ ...base, guide: 'ring', steps: [step(), step()], ...o })
const takt = (o: Raw = {}): Raw => ({ ...base, guide: 'takt', steps: [step(), step()], cycle: [phase('ein', 4), phase('aus', 6)], ...o })

test('Bereiche und Stufen wie in Spec §2', () => {
  expect(AREAS).toEqual(['koerper', 'gefuehl', 'geist', 'sinn'])
  expect(AREA_INFO).toEqual({
    koerper: { title: 'Körper', color: '#F0A58C', question: 'wach, kräftig, ausgeruht?' },
    gefuehl: { title: 'Gefühl', color: '#F3B6C8', question: 'ruhig, zuversichtlich, verbunden?' },
    geist: { title: 'Geist', color: '#9FE0CF', question: 'klar, fokussiert, aufnahmefähig?' },
    sinn: { title: 'Sinn', color: '#C7B8F5', question: 'ausgerichtet, motiviert, im Einklang?' },
  })
  expect(LEVELS).toEqual([1, 2, 3, 4, 5])
  expect(LEVEL_WORD).toEqual({ 1: 'leer', 2: 'schwach', 3: 'mittel', 4: 'gut', 5: 'voll' })
  for (const a of AREAS) expect(isEnergyArea(a)).toBe(true)
  for (const v of ['mut', 'Geist', '', 1, null, undefined]) expect(isEnergyArea(v), String(v)).toBe(false)
  for (const l of LEVELS) expect(isEnergyLevel(l)).toBe(true)
  for (const v of [0, 6, 2.5, '3', NaN, null]) expect(isEnergyLevel(v), String(v)).toBe(false)
})

test('der Katalog hat 19 gültige Hacks: 7 Körper, je 4 Gefühl, Geist und Sinn', () => {
  expect(HACKS).toHaveLength(19)
  expect(hacksIn('koerper')).toHaveLength(7)
  for (const a of ['gefuehl', 'geist', 'sinn'] as const) expect(hacksIn(a), a).toHaveLength(4)
  for (const h of HACKS) expect(hackProblems(h), h.id).toEqual([])
  expect(HACKS.map((h) => h.id)).toEqual(TABLE.map(([id]) => id))
  expect(new Set(HACKS.map((h) => h.id)).size).toBe(19)
})

test('Titel, Bereich, Minuten und Führung wie in Spec §4', () => {
  expect(HACKS.map((h) => [h.id, h.title, h.area, h.minutes, h.guide])).toEqual(TABLE)
  expect(hacksIn('koerper').map((h) => h.id)).toEqual([
    'bewegungs-snack', 'tageslicht', 'wach-atmung', 'power-pause', 'strecken', 'wasser-licht', 'wach-klopfen',
  ])
  expect(hackById('gibtsnicht')).toBeNull()
})

test('Hinweise, Fenster und Verweise wie in Spec M9 §4 und M10 §3.1', () => {
  const windows = Object.fromEntries(HACKS.filter((h) => h.window).map((h) => [h.id, h.window]))
  expect(windows).toEqual({ tageslicht: { from: 7, to: 17 }, 'power-pause': { from: 11, to: 16 }, 'wasser-licht': { from: 4, to: 12 } })
  expect(HACKS.filter((h) => h.caution !== null).map((h) => h.id)).toEqual(['wach-atmung', 'strecken', 'wasser-licht', 'wach-klopfen', 'kaltes-gesicht'])
  expect(HACKS.filter((h) => h.link !== null).map((h) => h.id)).toEqual(['seufzer'])
})

test('Karten-Texte: 2–4 kurze Schritte, kurzes Wirkungsbild, typografische Zeichen', () => {
  for (const h of HACKS) {
    expect(h.steps.length, h.id).toBeGreaterThanOrEqual(2)
    expect(h.steps.length, h.id).toBeLessThanOrEqual(4)
    for (const s of h.steps) {
      expect(words(s.title), `${h.id}: ${s.title}`).toBeLessThanOrEqual(4)
      expect(words(s.detail), `${h.id}: ${s.detail}`).toBeLessThanOrEqual(12)
    }
    expect(words(h.why.from), h.id).toBeLessThanOrEqual(2)
    expect(words(h.why.to), h.id).toBeLessThanOrEqual(2)
    const texts = [h.title, h.benefit, h.why.from, h.why.to, h.why.text, h.source, h.further ?? '', h.caution ?? '']
    texts.push(...h.steps.flatMap((s) => [s.title, s.detail]), ...taktPhases(h).map((p) => p.say))
    for (const t of texts) expect(t, `${h.id}: gerade Anführungszeichen, Apostroph oder drei Punkte`).not.toMatch(/["']|\.\.\./)
  }
})

test('Symbole: feste Liste der Linien-Symbole', () => {
  expect(HACK_ICONS).toEqual([
    'einatmen', 'nachatmen', 'ausatmen', 'halten', 'bewegung', 'gehen', 'sonne', 'wasser', 'liegen',
    'stift', 'herz', 'auge', 'handy-weg', 'kompass', 'stern', 'pfeil', 'frage',
  ])
})

describe('hackProblems', () => {
  test('gültige Vorlagen ohne Befund', () => {
    expect(hackProblems(schritte())).toEqual([])
    expect(hackProblems(ring())).toEqual([])
    expect(hackProblems(takt())).toEqual([])
    const group = { repeat: 3, phases: [phase('ein', 1.5), phase('aus', 1.5)] }
    expect(hackProblems(takt({ cycle: [group, phase('halten', 5)] }))).toEqual([])
    const extras = { window: { from: 7, to: 17 }, link: { kind: 'breath', id: 'box' }, further: 'Ein Buch', caution: 'Vorsicht.' }
    expect(hackProblems(ring(extras))).toEqual([])
  })

  test('hackProblems meldet Fehler', () => {
    const bad: [string, unknown][] = [
      ['Schritt-Summe ≠ Minuten × 60', schritte({ steps: [step(30), step(20)] })],
      ['Schritt unter 10 s', schritte({ steps: [step(5), step(55)] })],
      ['Schritt ohne Sekunden', schritte({ steps: [step(60), step()] })],
      ['Sekunden bei ring', ring({ steps: [step(30), step(30)] })],
      ['Bereich mut', schritte({ area: 'mut' })],
      ['0 Minuten', ring({ minutes: 0 })],
      ['11 Minuten', ring({ minutes: 11 })],
      ['1,5 Minuten', ring({ minutes: 1.5 })],
      ['leere Quelle', schritte({ source: '' })],
      ['Quelle nur Leerzeichen', schritte({ source: '  ' })],
      ['Kennung mit Großbuchstaben', schritte({ id: 'Probe' })],
      ['leerer Titel', schritte({ title: '' })],
      ['Wirkungsbild fehlt', schritte({ why: null })],
      ['keine Schritte', ring({ steps: [] })],
      ['Takt mit nur einer Phase', takt({ cycle: [phase('ein', 4)] })],
      ['Takt ohne Zyklus', takt({ cycle: undefined })],
      ['Zyklus bei schritte', schritte({ cycle: [phase('ein', 4), phase('aus', 6)] })],
      ['Phase 0,4 s', takt({ cycle: [phase('ein', 0.4), phase('aus', 4)] })],
      ['Phase 31 s', takt({ cycle: [phase('ein', 4), phase('aus', 31)] })],
      ['unbekannte Phase', takt({ cycle: [phase('ein', 4), phase('pause', 4)] })],
      ['Phase ohne Ansage', takt({ cycle: [phase('ein', 4), { phase: 'aus', seconds: 4 }] })],
      ['Gruppe mit 0 Wiederholungen', takt({ cycle: [{ repeat: 0, phases: [phase('ein', 2), phase('aus', 2)] }, phase('ein', 2), phase('aus', 2)] })],
      ['Gruppe mit 1,5 Wiederholungen', takt({ cycle: [{ repeat: 1.5, phases: [phase('ein', 2), phase('aus', 2)] }, phase('halten', 2)] })],
      ['Verweis auf gibtsnicht', schritte({ link: { kind: 'breath', id: 'gibtsnicht' } })],
      ['Verweis auf eine andere Art', schritte({ link: { kind: 'meditation', id: 'box' } })],
      ['Symbol blitz', schritte({ steps: [{ ...step(30), icon: 'blitz' }, step(30)] })],
      ['Fenster 17 bis 7', schritte({ window: { from: 17, to: 7 } })],
      ['Fenster bis 25 Uhr', schritte({ window: { from: 20, to: 25 } })],
      ['Fenster in halben Stunden', schritte({ window: { from: 7.5, to: 17 } })],
      ['Hinweis fehlt ganz', schritte({ caution: undefined })],
      ['kein Objekt', null],
      ['Text statt Objekt', 'seufzer'],
    ]
    for (const [name, raw] of bad) expect(hackProblems(raw), name).not.toEqual([])
  })
})

test('Seufzer: Takt 2 + 1 + 5 s', () => {
  const h = hack('seufzer')
  expect(taktPhases(h).map((p) => [p.phase, p.seconds])).toEqual([['ein', 2], ['nach', 1], ['aus', 5]])
  expect(hackLength(h)).toBe(64)
  expect(taktAt(h, 0)).toMatchObject({ phase: 'ein', say: 'Tief einatmen …', round: 1, rounds: 8, cycleProgress: 0, level: 0 })
  // Mitte der Phase: halber Weg des Kosinus-Übergangs.
  expect(taktAt(h, 1).level).toBeCloseTo(0.4)
  expect(taktAt(h, 2.5)).toMatchObject({ phase: 'nach', say: '… kurz nachatmen' })
  expect(taktAt(h, 2.5).level).toBeCloseTo(0.9)
  expect(taktAt(h, 3)).toMatchObject({ phase: 'aus', say: 'Lang ausatmen …' })
  expect(taktAt(h, 9)).toMatchObject({ phase: 'ein', round: 2 })
  expect(taktAt(h, 9).cycleProgress).toBeCloseTo(1 / 8)
  expect(taktAt(h, 64)).toMatchObject({ phase: 'aus', round: 8, cycleProgress: 1, level: 0 })
  expect(taktAt(h, 100)).toMatchObject({ round: 8, level: 0 })
  expect(taktShape(h)).toEqual([
    { phase: 'ein', seconds: 2, from: 0, to: 0.8 },
    { phase: 'nach', seconds: 1, from: 0.8, to: 1 },
    { phase: 'aus', seconds: 5, from: 1, to: 0 },
  ])
})

test('Wach-Atmung: Gruppe mit Wiederholung', () => {
  const h = hack('wach-atmung')
  expect(h.cycle?.[0]).toMatchObject({ repeat: 15 })
  const phases = taktPhases(h)
  expect(phases).toHaveLength(32)
  const pair = [['ein', 1.5], ['aus', 1.5]]
  expect(phases.slice(0, 30).map((p) => [p.phase, p.seconds])).toEqual(Array.from({ length: 15 }, () => pair).flat())
  expect(phases.slice(30).map((p) => [p.phase, p.seconds, p.say])).toEqual([['aus', 1, 'Ausatmen …'], ['halten', 14, 'Halten …']])
  const cycle = phases.reduce((sum, p) => sum + p.seconds, 0)
  expect(cycle).toBe(60)
  expect(taktAt(h, 0).rounds).toBe(Math.max(1, Math.round(60 / cycle)))
  expect(hackLength(h)).toBe(60)
  expect(taktAt(h, 45.5)).toMatchObject({ phase: 'aus', say: 'Ausatmen …', round: 1 })
  expect(taktAt(h, 46)).toMatchObject({ phase: 'halten', say: 'Halten …', round: 1 })
})

test('Takt: Runden gerundet, mindestens eine; Pegel je Phase', () => {
  const seven = takt({ cycle: [phase('ein', 3), phase('aus', 4)] }) as unknown as Hack
  expect(taktAt(seven, 0).rounds).toBe(9)
  expect(hackLength(seven)).toBe(63)
  const long = takt({ cycle: [{ repeat: 10, phases: [phase('ein', 15), phase('aus', 15)] }] }) as unknown as Hack
  expect(taktAt(long, 0).rounds).toBe(1)
  expect(hackLength(long)).toBe(300)
  const box = takt({ cycle: [phase('ein', 4), phase('halten', 4), phase('aus', 4), phase('halten', 4)] }) as unknown as Hack
  expect(taktShape(box).map((s) => [s.phase, s.from, s.to])).toEqual([['ein', 0, 1], ['halten', 1, 1], ['aus', 1, 0], ['halten', 0, 0]])
  expect(taktAt(box, 6).level).toBe(1)
})

test('Schritte', () => {
  const h = hack('bewegungs-snack')
  expect(h.steps.map((s) => s.seconds)).toEqual([30, 30, 30, 30])
  expect(hackLength(h)).toBe(120)
  expect(stepBoundaries(h)).toEqual([30, 60, 90])
  expect(stepAt(h, 0)).toEqual({ index: 0, remaining: 30 })
  expect(stepAt(h, 30)).toEqual({ index: 1, remaining: 30 })
  expect(stepAt(h, 45)).toEqual({ index: 1, remaining: 15 })
  expect(stepAt(h, 200)).toEqual({ index: 3, remaining: 0 })
})

test('Ring', () => {
  const kopfLeeren = hack('kopf-leeren')
  expect(hackLength(kopfLeeren)).toBe(180)
  expect(stepBoundaries(kopfLeeren)).toEqual([])
  expect(stepBoundaries(hack('seufzer'))).toEqual([])
  expect(stepAt(kopfLeeren, 60)).toEqual({ index: 0, remaining: 120 })
})

test('Zeitfenster', () => {
  const pause = hack('power-pause')
  expect(inWindow(pause, at(10, 59))).toBe(false)
  expect(inWindow(pause, at(11, 0))).toBe(true)
  expect(inWindow(pause, at(15, 59))).toBe(true)
  expect(inWindow(pause, at(16, 0))).toBe(false)
  const seufzer = hack('seufzer')
  for (let hour = 0; hour < 24; hour++) expect(inWindow(seufzer, at(hour, 30)), `${hour} Uhr`).toBe(true)
})

describe('Morgen-Übungen (Spec M10 §3.1)', () => {
  const plan = (h: Hack) => h.steps.map((s) => [s.seconds, s.icon])

  test('Strecken & Aufrichten: 2 Min in 4 Schritten à 30 s', () => {
    const h = hack('strecken')
    expect([h.area, h.guide, h.minutes]).toEqual(['koerper', 'schritte', 2])
    expect(plan(h)).toEqual([[30, 'liegen'], [30, 'bewegung'], [30, 'bewegung'], [30, 'bewegung']])
    expect(hackLength(h)).toBe(120)
    expect(h.caution).toBe('Nur so weit, wie es angenehm ist.')
    expect(h.why).toMatchObject({ from: 'Steif', to: 'Beweglich' })
    expect(h.source).toBe('Allgemeine Mobilisation; Energie-Management nach Loehr/Schwartz')
  })

  test('Wasser & Licht: 2 Min in 30/60/30 s, nur 4 bis 12 Uhr im Jetzt-Reset', () => {
    const h = hack('wasser-licht')
    expect([h.area, h.guide, h.minutes]).toEqual(['koerper', 'schritte', 2])
    expect(plan(h)).toEqual([[30, 'wasser'], [60, 'sonne'], [30, 'auge']])
    expect(hackLength(h)).toBe(120)
    expect(h.window).toEqual({ from: 4, to: 12 })
    expect(h.caution).toBe('Nicht direkt in die Sonne schauen.')
    expect(h.why).toMatchObject({ from: 'Nachtmodus', to: 'Tagmodus' })
    expect(h.source).toBe('Angelehnt an Huberman (Morgenlicht und innere Uhr)')
  })

  test('Wach-Klopfen: 1 Min in 3 Schritten à 20 s', () => {
    const h = hack('wach-klopfen')
    expect([h.area, h.guide, h.minutes]).toEqual(['koerper', 'schritte', 1])
    expect(plan(h)).toEqual([[20, 'bewegung'], [20, 'bewegung'], [20, 'bewegung']])
    expect(hackLength(h)).toBe(60)
    expect(h.caution).toBe('Sanft klopfen und schmerzende Stellen auslassen.')
    expect(h.why).toMatchObject({ from: 'Träge', to: 'Wach' })
    expect(h.source).toBe('Angelehnt an Qigong-Übungen')
  })

  test('keine Leseempfehlung, kein Verweis, ein Hinweis; Nutzen mit „kann“, Wirkung in zwei bis drei Sätzen', () => {
    for (const id of ['strecken', 'wasser-licht', 'wach-klopfen']) {
      const h = hack(id)
      expect(h.further, id).toBeNull()
      expect(h.link, id).toBeNull()
      expect(h.caution, id).toMatch(/\S/)
      expect(h.benefit, id).toMatch(/\b(kann|können)\b/)
      expect(h.why.text.match(/[.!?](\s|$)/g)?.length, id).toBeGreaterThanOrEqual(2)
      expect(h.why.text.match(/[.!?](\s|$)/g)?.length, id).toBeLessThanOrEqual(3)
      expect(hackProblems(h), id).toEqual([])
    }
  })

  test('Wasser & Licht: Fenster 4 bis 12 Uhr, um 11:59 wahr, um 12:00 falsch', () => {
    const h = hack('wasser-licht')
    expect(inWindow(h, at(3, 59))).toBe(false)
    expect(inWindow(h, at(4, 0))).toBe(true)
    expect(inWindow(h, at(11, 59))).toBe(true)
    expect(inWindow(h, at(12, 0))).toBe(false)
  })
})

test('Geist-Hacks nennen Hildebrandt', () => {
  expect(hacksIn('geist')).toHaveLength(4)
  for (const h of HACKS) expect(h.further, h.id).toBe(h.area === 'geist' ? 'Henry Hildebrandt, Brainhacks (2025)' : null)
})

test('Seufzer verweist auf die Atemübung', () => {
  expect(hack('seufzer').link).toEqual({ kind: 'breath', id: 'seufzer' })
})
