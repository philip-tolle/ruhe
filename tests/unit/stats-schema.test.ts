import { test, expect } from 'vitest'
import { parseData, emptyData, DEFAULT_SETTINGS } from '../../src/lib/stats/schema'
import { SOUNDS } from '../../src/lib/sounds/catalog'
import { BREATH_MINUTES, BREATH_PATTERNS } from '../../src/lib/breath/patterns'

const session = { id: 'a', start: '2026-10-21T08:00:00.000Z', kind: 'breath', ref: '478', seconds: 76 }
const withSettings = (settings: unknown) => parseData({ version: 1, sessions: [], settings })?.settings
const withLastUsed = (lastUsed: unknown) => parseData({ version: 1, sessions: [], settings: {}, lastUsed })

test('defaults', () => {
  expect(DEFAULT_SETTINGS).toEqual({ vibration: true, voiceBalance: 0.5, timerSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } })
  expect(emptyData()).toEqual({ version: 1, sessions: [], settings: DEFAULT_SETTINGS })
})
test('emptyData hands out fresh objects', () => {
  const a = emptyData()
  expect(a.settings).not.toBe(DEFAULT_SETTINGS)
  expect(a.settings.timer).not.toBe(DEFAULT_SETTINGS.timer)
  a.settings.vibration = false
  a.settings.timer.minutes = 99
  a.sessions.push({ id: 'x', start: session.start, kind: 'timer', ref: 'timer', seconds: 60 })
  expect(DEFAULT_SETTINGS).toEqual({ vibration: true, voiceBalance: 0.5, timerSound: null, timerLead: true, timer: { minutes: 10, intervalMin: null } })
  expect(emptyData()).toEqual({ version: 1, sessions: [], settings: DEFAULT_SETTINGS })
})
test('parseData accepts valid data and fills missing settings', () => {
  const raw = { version: 1, sessions: [{ id: 'a', start: '2026-10-21T08:00:00.000Z', kind: 'breath', ref: '478', seconds: 76 }], settings: { vibration: false } }
  expect(parseData(raw)).toEqual({ ...raw, settings: { ...DEFAULT_SETTINGS, vibration: false } })
})
test('parseData never hands out the default objects', () => {
  const data = parseData({ version: 1, sessions: [], settings: {} })!
  expect(data.settings).not.toBe(DEFAULT_SETTINGS)
  expect(data.settings.timer).not.toBe(DEFAULT_SETTINGS.timer)
})
test('parseData rejects broken data', () => {
  for (const bad of [null, 'x', { version: 2, sessions: [], settings: {} }, { version: 1, sessions: [{ id: 1 }], settings: {} }, { version: 1, sessions: [{ id: 'a', start: 'kein Datum', kind: 'timer', ref: 'timer', seconds: 60 }], settings: {} }])
    expect(parseData(bad)).toBeNull()
})
test('parseData rejects structurally broken containers', () => {
  for (const bad of [undefined, 42, [], { sessions: [], settings: {} }, { version: 1, settings: {} }, { version: 1, sessions: {}, settings: {} },
    { version: 1, sessions: [] }, { version: 1, sessions: [], settings: null }, { version: 1, sessions: [], settings: 'x' }, { version: 1, sessions: [], settings: [] }])
    expect(parseData(bad)).toBeNull()
})
test('a single invalid session makes the whole data invalid', () => {
  const bad: Record<string, unknown>[] = [
    { ...session, id: '' }, { ...session, id: 5 }, { ...session, start: 5 }, { ...session, start: '1' }, { ...session, start: '2026-13-45T99:00:00Z' },
    { ...session, kind: 'sound' }, { ...session, kind: undefined }, { ...session, ref: 5 }, { ...session, ref: undefined },
    { ...session, seconds: -1 }, { ...session, seconds: NaN }, { ...session, seconds: Infinity }, { ...session, seconds: '60' },
  ]
  for (const b of bad) expect(parseData({ version: 1, sessions: [session, b], settings: {} })).toBeNull()
  expect(parseData({ version: 1, sessions: [session, null], settings: {} })).toBeNull()
})
test('sessions: all kinds and zero seconds are valid; unknown fields are dropped', () => {
  const sessions = [
    { id: '1', start: '2026-10-21T08:00:00.000Z', kind: 'guided', ref: 'abendruhe', seconds: 0 },
    { id: '2', start: '2026-10-21T09:00:00+02:00', kind: 'timer', ref: 'timer', seconds: 600.5 },
  ]
  expect(parseData({ version: 1, sessions: [{ ...sessions[0], extra: 1 }, sessions[1]], settings: {} })).toEqual({ version: 1, sessions, settings: DEFAULT_SETTINGS })
})
test('settings fall back to defaults field by field', () => {
  expect(withSettings({ vibration: 'ja', voiceBalance: 'x', timerSound: 'foo', timerLead: 1, timer: 'x' })).toEqual(DEFAULT_SETTINGS)
  expect(withSettings({ vibration: false, voiceBalance: 0.2, timerSound: 'regen', timerLead: false, timer: { minutes: 25, intervalMin: 5 } }))
    .toEqual({ vibration: false, voiceBalance: 0.2, timerSound: 'regen', timerLead: false, timer: { minutes: 25, intervalMin: 5 } })
})
test('voiceBalance must be a finite number in [0, 1]', () => {
  for (const v of [0, 0.25, 1]) expect(withSettings({ voiceBalance: v })?.voiceBalance).toBe(v)
  for (const v of [-0.1, 1.1, NaN, Infinity, null, '0.3']) expect(withSettings({ voiceBalance: v })?.voiceBalance).toBe(0.5)
})
test('timerSound accepts every catalog sound and null', () => {
  for (const sound of SOUNDS) expect(withSettings({ timerSound: sound.id })?.timerSound).toBe(sound.id)
  expect(withSettings({ timerSound: null })?.timerSound).toBeNull()
  for (const v of ['nope', 3, undefined]) expect(withSettings({ timerSound: v })?.timerSound).toBeNull()
})
test('timer settings: minutes integer 1-120, interval one of the options', () => {
  for (const m of [1, 10, 120]) expect(withSettings({ timer: { minutes: m } })?.timer.minutes).toBe(m)
  for (const m of [0, 121, 7.5, NaN, '10', null]) expect(withSettings({ timer: { minutes: m } })?.timer.minutes).toBe(10)
  for (const i of [null, 1, 2, 5, 10]) expect(withSettings({ timer: { intervalMin: i } })?.timer.intervalMin).toBe(i)
  for (const i of [0, 3, 15, -1, '5', undefined]) expect(withSettings({ timer: { intervalMin: i } })?.timer.intervalMin).toBeNull()
  // Ein ungültiges Feld lässt das andere unberührt.
  expect(withSettings({ timer: { minutes: 0, intervalMin: 5 } })?.timer).toEqual({ minutes: 10, intervalMin: 5 })
})
test('lastUsed is kept when valid', () => {
  const timer = { kind: 'timer', minutes: 20, intervalMin: 5, sound: 'wald', lead: false }
  const breath = { kind: 'breath', pattern: 'box', minutes: 3 }
  expect(withLastUsed(timer)?.lastUsed).toEqual(timer)
  expect(withLastUsed({ ...timer, intervalMin: null, sound: null })?.lastUsed).toEqual({ ...timer, intervalMin: null, sound: null })
  expect(withLastUsed(breath)?.lastUsed).toEqual(breath)
  for (const p of BREATH_PATTERNS) expect(withLastUsed({ kind: 'breath', pattern: p.id, minutes: 1 })?.lastUsed).toEqual({ kind: 'breath', pattern: p.id, minutes: 1 })
  for (const sound of SOUNDS) expect(withLastUsed({ ...timer, sound: sound.id })?.lastUsed).toMatchObject({ sound: sound.id })
})
test('an invalid lastUsed is dropped, the rest stays', () => {
  const timer = { kind: 'timer', minutes: 20, intervalMin: 5, sound: 'wald', lead: false }
  const { sound: _sound, ...noSound } = timer
  const bad: unknown[] = [
    'x', 5, [], { kind: 'guided', minutes: 5 }, { kind: 'sound' }, {},
    { kind: 'breath', pattern: 'unbekannt', minutes: 3 }, { kind: 'breath', pattern: 'box' }, { kind: 'breath', minutes: 3 },
    { kind: 'breath', pattern: 'box', minutes: 0 }, { kind: 'breath', pattern: 'box', minutes: -3 }, { kind: 'breath', pattern: 'box', minutes: NaN }, { kind: 'breath', pattern: 'box', minutes: '3' },
    { ...timer, minutes: 0 }, { ...timer, minutes: Infinity }, { ...timer, sound: 'nope' }, noSound, { ...timer, lead: 'ja' }, { ...timer, intervalMin: 3 }, { ...timer, intervalMin: undefined },
  ]
  for (const b of bad) {
    const parsed = withLastUsed(b)
    expect(parsed).not.toBeNull()
    expect(parsed).toEqual({ version: 1, sessions: [], settings: DEFAULT_SETTINGS })
    expect(parsed && 'lastUsed' in parsed).toBe(false)
  }
})
test('a breath lastUsed must have one of the offered durations', () => {
  for (const minutes of BREATH_MINUTES)
    expect(withLastUsed({ kind: 'breath', pattern: 'box', minutes })?.lastUsed).toEqual({ kind: 'breath', pattern: 'box', minutes })
  for (const minutes of [2, 4, 7, 3.5, 15, 120]) {
    const parsed = withLastUsed({ kind: 'breath', pattern: 'box', minutes })
    expect(parsed).toEqual({ version: 1, sessions: [], settings: DEFAULT_SETTINGS })
  }
})
