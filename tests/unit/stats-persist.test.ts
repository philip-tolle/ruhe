import { test, expect } from 'vitest'
import { loadData, saveData, withBreathPattern, withCalm, withCheckin, withFocusSprint, withHackEffect, withHackRun, withoutBreathPattern, withSession, STORAGE_KEY, CORRUPT_KEY } from '../../src/lib/stats/persist'
import { emptyData } from '../../src/lib/stats/schema'
const mem = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }

test('missing data gives an empty state', () => expect(loadData(mem())).toEqual(emptyData()))
test('corrupt data is backed up and replaced', () => {
  const s = mem(); s.m.set(STORAGE_KEY, '{kaputt')
  expect(loadData(s)).toEqual(emptyData())
  expect(s.m.get(CORRUPT_KEY)).toBe('{kaputt')
})
test('valid JSON with a wrong structure is backed up too', () => {
  const s = mem(); const raw = JSON.stringify({ version: 2, sessions: [] }); s.m.set(STORAGE_KEY, raw)
  expect(loadData(s)).toEqual(emptyData())
  expect(s.m.get(CORRUPT_KEY)).toBe(raw)
})
test('a failing backup write does not throw', () => {
  const s = { getItem: () => '{kaputt', setItem: () => { throw new DOMException('voll', 'QuotaExceededError') } }
  expect(loadData(s)).toEqual(emptyData())
})
test('save and load round trip', () => {
  const s = mem(); const data = { ...emptyData(), lastUsed: { kind: 'breath' as const, pattern: '478' as const, minutes: 3 } }
  expect(saveData(s, data)).toBe(true)
  expect(loadData(s)).toEqual(data)
})
test('save failure is reported, not thrown', () => {
  const broken = { getItem: () => null, setItem: () => { throw new DOMException('voll', 'QuotaExceededError') } }
  expect(saveData(broken, emptyData())).toBe(false)
  expect(saveData(null, emptyData())).toBe(false)
  expect(loadData({ getItem: () => { throw new Error('gesperrt') }, setItem: () => {} })).toEqual(emptyData())
  expect(loadData(null)).toEqual(emptyData())
})
test('withSession applies the 60 second rule', () => {
  const start = new Date('2026-10-21T08:00:00.000Z')
  expect(withSession(emptyData(), { kind: 'timer', ref: 'timer', start, seconds: 59.9 }, 'x')).toBeNull()
  expect(withSession(emptyData(), { kind: 'breath', ref: '478', start, seconds: 76.4 }, 'x')!.sessions)
    .toEqual([{ id: 'x', start: '2026-10-21T08:00:00.000Z', kind: 'breath', ref: '478', seconds: 76 }])
})
test('withSession counts exactly 60 seconds and leaves its input untouched', () => {
  const start = new Date('2026-10-21T08:00:00.000Z')
  const data = emptyData()
  const next = withSession(data, { kind: 'timer', ref: 'timer', start, seconds: 60 }, 'y')!
  expect(next.sessions).toHaveLength(1)
  expect(data.sessions).toHaveLength(0)
  expect(next).not.toBe(data)
})
test('withSession drops non-finite seconds and an invalid start instead of storing or throwing', () => {
  const start = new Date('2026-10-21T08:00:00.000Z')
  for (const seconds of [NaN, Infinity, -Infinity])
    expect(withSession(emptyData(), { kind: 'timer', ref: 'timer', start, seconds }, 'x')).toBeNull()
  expect(() => withSession(emptyData(), { kind: 'timer', ref: 'timer', start: new Date(NaN), seconds: 600 }, 'x')).not.toThrow()
  expect(withSession(emptyData(), { kind: 'timer', ref: 'timer', start: new Date(NaN), seconds: 600 }, 'x')).toBeNull()
})

const two = () => {
  const d = emptyData()
  d.sessions.push({ id: 'a', start: '2026-10-21T08:00:00.000Z', kind: 'breath', ref: 'box', seconds: 64 })
  d.sessions.push({ id: 'b', start: '2026-10-21T09:00:00.000Z', kind: 'timer', ref: 'timer', seconds: 600 })
  return d
}
test('withCalm sets, changes and removes a value of one session', () => {
  const d = two()
  const before = structuredClone(d)
  const one = withCalm(d, 'a', 'before', 2)!
  expect(one.sessions[0].calm).toEqual({ before: 2 })
  expect(one.sessions[1]).toEqual(d.sessions[1])
  expect(d).toEqual(before)
  const both = withCalm(one, 'a', 'after', 4)!
  expect(both.sessions[0].calm).toEqual({ before: 2, after: 4 })
  const changed = withCalm(both, 'a', 'after', 5)!
  expect(changed.sessions[0].calm).toEqual({ before: 2, after: 5 })
  const onlyAfter = withCalm(changed, 'a', 'before', null)!
  expect(onlyAfter.sessions[0].calm).toEqual({ after: 5 })
  const none = withCalm(onlyAfter, 'a', 'after', null)!
  expect('calm' in none.sessions[0]).toBe(false)
  expect(none.sessions[0]).toEqual(d.sessions[0])
})
test('withCalm ignores an unknown id', () => {
  expect(withCalm(two(), 'x', 'before', 3)).toBeNull()
})

const own = (id: string, name = 'Abendruhe') => ({ id, name, inhale: 4, holdIn: 2, exhale: 6, holdOut: 0 })

test('withBreathPattern hängt an oder ersetzt nach Kennung, ohne den alten Stand zu ändern', () => {
  const start = emptyData()
  const one = withBreathPattern(start, own('eigen-0000000a'))
  expect(one.breathPatterns).toEqual([own('eigen-0000000a')])
  expect(start).not.toHaveProperty('breathPatterns')
  const two = withBreathPattern(one, own('eigen-0000000b', 'Morgen'))
  const renamed = withBreathPattern(two, own('eigen-0000000a', 'Neu'))
  expect(renamed.breathPatterns).toEqual([own('eigen-0000000a', 'Neu'), own('eigen-0000000b', 'Morgen')])
  expect(two.breathPatterns).toEqual([own('eigen-0000000a'), own('eigen-0000000b', 'Morgen')])
})

test('withoutBreathPattern entfernt ein Muster; ist es das letzte, entfällt das Feld; unbekannt ändert nichts', () => {
  const two = withBreathPattern(withBreathPattern(emptyData(), own('eigen-0000000a')), own('eigen-0000000b'))
  expect(withoutBreathPattern(two, 'eigen-0000000a').breathPatterns).toEqual([own('eigen-0000000b')])
  expect(withoutBreathPattern(withoutBreathPattern(two, 'eigen-0000000a'), 'eigen-0000000b')).not.toHaveProperty('breathPatterns')
  expect(withoutBreathPattern(two, 'eigen-ffffffff')).toEqual(two)
  expect(two.breathPatterns).toHaveLength(2)
})

const checkin = { id: 'c1', at: '2026-10-21T08:00:00.000Z', levels: { koerper: 3, gefuehl: 2, geist: 4, sinn: 5 } } as const
const run = { id: 'r1', at: '2026-10-21T09:00:00.000Z', hack: 'seufzer', area: 'gefuehl', seconds: 64 } as const
const sprint = { id: 's1', at: '2026-10-21T10:00:00.000Z', planned: 50, seconds: 3000 } as const

test('withCheckin, withHackRun und withFocusSprint hängen an und lassen sessions unverändert', () => {
  const d = two()
  const before = structuredClone(d)
  const a = withCheckin(d, checkin)
  expect(a.energyCheckins).toEqual([checkin])
  expect(a.sessions).toBe(d.sessions)
  const b = withHackRun(a, run)
  expect(b.hackRuns).toEqual([run])
  expect(b.energyCheckins).toEqual([checkin])
  const c = withFocusSprint(b, sprint)
  expect(c.focusSprints).toEqual([sprint])
  expect(c.sessions).toBe(d.sessions)
  expect(withCheckin(c, { ...checkin, id: 'c2' }).energyCheckins?.map(x => x.id)).toEqual(['c1', 'c2'])
  expect(withHackRun(c, { ...run, id: 'r2' }).hackRuns?.map(x => x.id)).toEqual(['r1', 'r2'])
  expect(withFocusSprint(c, { ...sprint, id: 's2' }).focusSprints?.map(x => x.id)).toEqual(['s1', 's2'])
  expect(d).toEqual(before) // der alte Stand bleibt
})
test('withHackEffect setzt, ändert und entfernt Werte eines Laufs', () => {
  const d = withHackRun(withHackRun(emptyData(), run), { ...run, id: 'r2' })
  const before = structuredClone(d)
  const one = withHackEffect(d, 'r1', 'before', 2)!
  expect(one.hackRuns![0]).toEqual({ ...run, before: 2 })
  expect(one.hackRuns![1]).toEqual({ ...run, id: 'r2' })
  const both = withHackEffect(one, 'r1', 'after', 4)!
  expect(both.hackRuns![0]).toEqual({ ...run, before: 2, after: 4 })
  expect(withHackEffect(both, 'r1', 'after', 5)!.hackRuns![0]).toEqual({ ...run, before: 2, after: 5 })
  const noBefore = withHackEffect(both, 'r1', 'before', null)!
  expect(noBefore.hackRuns![0]).toEqual({ ...run, after: 4 })
  const none = withHackEffect(noBefore, 'r1', 'after', null)!
  expect(none.hackRuns![0]).toEqual(run)
  expect('before' in none.hackRuns![0] || 'after' in none.hackRuns![0]).toBe(false)
  expect(d).toEqual(before)
})
test('withHackEffect mit unbekannter ID ergibt null', () => {
  expect(withHackEffect(emptyData(), 'r1', 'before', 3)).toBeNull()
  expect(withHackEffect(withHackRun(emptyData(), run), 'x', 'after', 3)).toBeNull()
})
test('Energie-Daten überstehen Speichern und Laden', () => {
  const s = mem()
  const data = withFocusSprint(withHackRun(withCheckin(emptyData(), checkin), { ...run, before: 2 }), sprint)
  saveData(s, data)
  expect(loadData(s)).toEqual(data)
})
test('withSession lässt Hack-Läufe und Sprints nicht in die Sitzungen', () => {
  const start = new Date('2026-10-21T08:00:00.000Z')
  expect(withSession(emptyData(), { kind: 'hack', ref: 'seufzer', start, seconds: 600 }, 'x')).toBeNull()
  expect(withSession(emptyData(), { kind: 'focus', ref: 'focus-50', start, seconds: 3000, note: 'Kurs' }, 'x')).toBeNull()
})
