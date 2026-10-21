import { test, expect } from 'vitest'
import { loadData, saveData, withSession, STORAGE_KEY, CORRUPT_KEY } from '../../src/lib/stats/persist'
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
