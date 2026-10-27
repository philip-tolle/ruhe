import { test, expect } from 'vitest'
import { parseData, emptyData, isSessionKind, DEFAULT_SETTINGS } from '../../src/lib/stats/schema'
import { MUSIC, SOUNDS } from '../../src/lib/sounds/catalog'
import { BREATH_MINUTES, BREATH_PATTERNS } from '../../src/lib/breath/patterns'

const session = { id: 'a', start: '2026-10-21T08:00:00.000Z', kind: 'breath', ref: '478', seconds: 76 }
const withSettings = (settings: unknown) => parseData({ version: 1, sessions: [], settings })?.settings
const withLastUsed = (lastUsed: unknown) => parseData({ version: 1, sessions: [], settings: {}, lastUsed })

test('defaults', () => {
  expect(DEFAULT_SETTINGS).toEqual({ vibration: true, breathSound: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, breathBackground: null, timerLead: true, timer: { minutes: 10, intervalMin: null }, focus: { minutes: 50, sound: 'kaffee-und-notizen' } })
  expect(emptyData()).toEqual({ version: 1, sessions: [], settings: DEFAULT_SETTINGS })
})
test('emptyData hands out fresh objects', () => {
  const a = emptyData()
  expect(a.settings).not.toBe(DEFAULT_SETTINGS)
  expect(a.settings.timer).not.toBe(DEFAULT_SETTINGS.timer)
  a.settings.vibration = false
  a.settings.timer.minutes = 99
  a.sessions.push({ id: 'x', start: session.start, kind: 'timer', ref: 'timer', seconds: 60 })
  expect(DEFAULT_SETTINGS).toEqual({ vibration: true, breathSound: true, voiceBalance: 0.5, timerSound: null, guidedSound: null, breathBackground: null, timerLead: true, timer: { minutes: 10, intervalMin: null }, focus: { minutes: 50, sound: 'kaffee-und-notizen' } })
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
  expect(withSettings({ vibration: 'ja', voiceBalance: 'x', timerSound: 'foo', guidedSound: 'bar', timerLead: 1, timer: 'x' })).toEqual(DEFAULT_SETTINGS)
  expect(withSettings({ vibration: false, voiceBalance: 0.2, timerSound: 'regen', guidedSound: 'meer', timerLead: false, timer: { minutes: 25, intervalMin: 5 } }))
    .toEqual({ vibration: false, breathSound: true, voiceBalance: 0.2, timerSound: 'regen', guidedSound: 'meer', breathBackground: null, timerLead: false, timer: { minutes: 25, intervalMin: 5 }, focus: { minutes: 50, sound: 'kaffee-und-notizen' } })
})
test('breathBackground accepts every nature sound, every music track and null, and defaults to none', () => {
  for (const { id } of [...SOUNDS, ...MUSIC]) expect(withSettings({ breathBackground: id })?.breathBackground).toBe(id)
  expect(withSettings({ breathBackground: null })?.breathBackground).toBeNull()
  for (const v of ['nope', 3, undefined, {}, true]) expect(withSettings({ breathBackground: v })?.breathBackground).toBeNull()
  expect(withSettings({ breathBackground: 'meer', timerSound: 'regen', guidedSound: 'wald' })).toMatchObject({ breathBackground: 'meer', timerSound: 'regen', guidedSound: 'wald' })
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
test('guidedSound accepts every catalog sound and null, independently of timerSound', () => {
  for (const sound of SOUNDS) expect(withSettings({ guidedSound: sound.id })?.guidedSound).toBe(sound.id)
  expect(withSettings({ guidedSound: null })?.guidedSound).toBeNull()
  for (const v of ['nope', 3, undefined, {}]) expect(withSettings({ guidedSound: v })?.guidedSound).toBeNull()
  expect(withSettings({ timerSound: 'wald', guidedSound: 'regen' })).toMatchObject({ timerSound: 'wald', guidedSound: 'regen' })
  expect(withSettings({ timerSound: 'wald', guidedSound: 'x' })).toMatchObject({ timerSound: 'wald', guidedSound: null })
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
test('a guided lastUsed keeps its meditation id', () => {
  expect(withLastUsed({ kind: 'guided', id: 'abendruhe' })?.lastUsed).toEqual({ kind: 'guided', id: 'abendruhe' })
  // Ob es die Meditation (noch) gibt, entscheidet der Katalog, nicht das Schema.
  expect(withLastUsed({ kind: 'guided', id: 'gibt-es-nicht' })?.lastUsed).toEqual({ kind: 'guided', id: 'gibt-es-nicht' })
  expect(withLastUsed({ kind: 'guided', id: 'abendruhe', minutes: 5 })?.lastUsed).toEqual({ kind: 'guided', id: 'abendruhe' })
})
test('an invalid lastUsed is dropped, the rest stays', () => {
  const timer = { kind: 'timer', minutes: 20, intervalMin: 5, sound: 'wald', lead: false }
  const { sound: _sound, ...noSound } = timer
  const bad: unknown[] = [
    'x', 5, [], { kind: 'guided', minutes: 5 }, { kind: 'guided', id: '' }, { kind: 'guided', id: 5 }, { kind: 'guided', id: null }, { kind: 'sound' }, {},
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

test('settings and the timer of lastUsed keep a music background', () => {
  const lastUsed = { kind: 'timer', minutes: 10, intervalMin: null, sound: 'schwebend', lead: true }
  const data = parseData({ version: 1, sessions: [], settings: { timerSound: 'klavier', guidedSound: 'obertoene' }, lastUsed })!
  expect(data.settings).toMatchObject({ timerSound: 'klavier', guidedSound: 'obertoene' })
  expect(data.lastUsed).toEqual(lastUsed)
})

test('an unknown background falls back', () => {
  expect(withSettings({ timerSound: 'gibt-es-nicht', guidedSound: 'auch-nicht' })).toMatchObject({ timerSound: null, guidedSound: null })
  expect(withLastUsed({ kind: 'timer', minutes: 10, intervalMin: null, sound: 'gibt-es-nicht', lead: true })!.lastUsed).toBeUndefined()
})

test('breathSound defaults to true and keeps a stored false', () => {
  // Gespeicherte Daten aus Meilenstein 4 kennen den Schalter noch nicht.
  const m4 = { vibration: false, voiceBalance: 0.4, timerSound: 'regen', guidedSound: null, timerLead: true, timer: { minutes: 15, intervalMin: 5 } }
  expect(withSettings(m4)).toEqual({ ...m4, breathSound: true, breathBackground: null, focus: { minutes: 50, sound: 'kaffee-und-notizen' } })
  expect(withSettings({ breathSound: false })!.breathSound).toBe(false)
  expect(withSettings({ breathSound: 'nein' })!.breathSound).toBe(true)
})

const withSessions = (...sessions: unknown[]) => parseData({ version: 1, sessions, settings: {} })
test('a session keeps a valid calm', () => {
  expect(withSessions({ ...session, calm: { before: 2, after: 5 } })?.sessions[0]).toEqual({ ...session, calm: { before: 2, after: 5 } })
  expect(withSessions({ ...session, calm: { after: 3 } })?.sessions[0]).toEqual({ ...session, calm: { after: 3 } })
})
test('invalid calm values are dropped, the session stays', () => {
  for (const before of [0, 6, 2.5, '3', null, true]) {
    const data = withSessions({ ...session, calm: { before, after: 4 } })
    expect(data, String(before)).not.toBeNull()
    expect(data!.sessions[0].calm).toEqual({ after: 4 })
  }
  expect(withSessions({ ...session, calm: { before: 9, after: 4 } })!.sessions[0].calm).toEqual({ after: 4 })
  for (const calm of [{}, 'x', { before: 0 }, null, [3]]) {
    const data = withSessions({ ...session, calm })
    expect(data, JSON.stringify(calm)).not.toBeNull()
    expect('calm' in data!.sessions[0]).toBe(false)
    expect(data!.sessions[0]).toEqual(session)
  }
})
test('unknown keys inside calm are dropped', () => {
  expect(withSessions({ ...session, calm: { before: 1, mood: 3 } })!.sessions[0].calm).toEqual({ before: 1 })
})

const own = (id: string, name = 'Abendruhe') => ({ id, name, inhale: 4, holdIn: 2, exhale: 6, holdOut: 0 })
const withPatterns = (breathPatterns: unknown) => parseData({ version: 1, sessions: [session], settings: { vibration: false }, breathPatterns })

test('parseData liest eigene Atemmuster in ihrer Reihenfolge; ohne Feld oder leer fehlt es', () => {
  expect(withPatterns([own('eigen-0000000b'), own('eigen-0000000a', 'Morgen')])?.breathPatterns).toEqual([own('eigen-0000000b'), own('eigen-0000000a', 'Morgen')])
  expect(parseData({ version: 1, sessions: [], settings: {} })).not.toHaveProperty('breathPatterns')
  expect(withPatterns([])).not.toHaveProperty('breathPatterns')
  expect(withPatterns('kein Array')).not.toHaveProperty('breathPatterns')
})

// Review Focus 2: Ein kaputtes Muster kostet nie die Sitzungen oder Einstellungen.
test('ein kaputtes oder doppeltes Muster entfällt einzeln, Sitzungen und Einstellungen bleiben', () => {
  const data = withPatterns([own('eigen-0000000a'), { ...own('eigen-0000000b'), inhale: 'vier' }, own('eigen-0000000a', 'Doppelt'), null])
  expect(data?.breathPatterns).toEqual([own('eigen-0000000a')])
  expect(data?.sessions).toEqual([session])
  expect(data?.settings).toEqual({ ...DEFAULT_SETTINGS, vibration: false })
  // Nur kaputte: das Feld fehlt, der Rest bleibt.
  const broken = withPatterns([{ ...own('eigen-0000000b'), name: 7 }])
  expect(broken).not.toBeNull()
  expect(broken).not.toHaveProperty('breathPatterns')
  expect(broken?.sessions).toEqual([session])
})

test('höchstens 50 eigene Muster werden gelesen', () => {
  const many = Array.from({ length: 60 }, (_, i) => own(`eigen-${i.toString(16).padStart(8, '0')}`))
  expect(withPatterns(many)?.breathPatterns).toEqual(many.slice(0, 50))
})

test('lastUsed mit eigener Kennung bleibt, eine falsche Form entfällt', () => {
  expect(withLastUsed({ kind: 'breath', pattern: 'eigen-0123abcd', minutes: 3 })?.lastUsed).toEqual({ kind: 'breath', pattern: 'eigen-0123abcd', minutes: 3 })
  expect(withLastUsed({ kind: 'breath', pattern: 'eigen-xyz', minutes: 3 })).not.toHaveProperty('lastUsed')
  expect(withLastUsed({ kind: 'breath', pattern: 'unbekannt', minutes: 3 })).not.toHaveProperty('lastUsed')
})

// Energie (Spec M9 §6.1): Jeder Eintrag wird einzeln geprüft, ein ungültiger kostet nie den Rest.
const checkin = { id: 'c1', at: '2026-10-21T08:00:00.000Z', levels: { koerper: 3, gefuehl: 2, geist: 4, sinn: 5 } }
const hackRun = { id: 'r1', at: '2026-10-21T09:00:00.000Z', hack: 'seufzer', area: 'gefuehl', seconds: 64, before: 2, after: 4 }
const sprint = { id: 's1', at: '2026-10-21T10:00:00.000Z', planned: 50, seconds: 3000, task: 'Kurskonzept' }
const withEnergy = (extra: Record<string, unknown>) => parseData({ version: 1, sessions: [session], settings: { vibration: false }, ...extra })

test('Energie-Felder werden einzeln geprüft', () => {
  const { sinn: _sinn, ...noSinn } = checkin.levels
  const bad = [
    { ...checkin, id: 'a', levels: noSinn },
    { ...checkin, id: 'b', levels: { ...checkin.levels, sinn: 6 } },
    { ...checkin, id: 'c', at: 'gestern' },
    { ...checkin, id: '' },
    { ...checkin, id: 'd', levels: { ...checkin.levels, geist: 2.5 } },
    { ...checkin, id: 'e', levels: 'viel' },
    null,
    'x',
  ]
  const data = withEnergy({ energyCheckins: [bad[0], checkin, ...bad.slice(1), { ...checkin, id: 'c2' }] })
  expect(data?.energyCheckins?.map(c => c.id)).toEqual(['c1', 'c2'])
  expect(data?.energyCheckins?.[0]).toEqual(checkin)
  expect(data?.sessions).toEqual([session])
  expect(data?.settings).toEqual({ ...DEFAULT_SETTINGS, vibration: false })
})
test('ein Check-in behält nur die vier Bereiche', () => {
  expect(withEnergy({ energyCheckins: [{ ...checkin, levels: { ...checkin.levels, extra: 1 }, extra: 1 }] })?.energyCheckins).toEqual([checkin])
})
test('Läufe: ein unbekannter Hack bleibt, Form und Bereich werden geprüft', () => {
  const unknown = { ...hackRun, id: 'u', hack: 'gibt-es-nicht' }
  const bad = [
    { ...hackRun, id: 'b1', hack: 5 }, { ...hackRun, id: 'b2', area: 'herz' }, { ...hackRun, id: 'b3', seconds: -1 }, { ...hackRun, id: 'b4', seconds: NaN },
    { ...hackRun, id: 'b5', seconds: '60' }, { ...hackRun, id: 'b6', at: 'gestern' }, { ...hackRun, id: '' }, { ...hackRun, id: 'b7', at: undefined }, null,
  ]
  const data = withEnergy({ hackRuns: [hackRun, ...bad, unknown, { ...hackRun, id: 'zero', seconds: 0 }] })
  expect(data?.hackRuns?.map(r => r.id)).toEqual(['r1', 'u', 'zero'])
  expect(data?.hackRuns?.[1]).toEqual(unknown)
  expect(data?.sessions).toEqual([session])
})
test('Läufe: eine ungültige Vorher- oder Jetzt-Stufe entfällt einzeln, der Lauf bleibt', () => {
  expect(withEnergy({ hackRuns: [{ ...hackRun, before: 7 }] })?.hackRuns).toEqual([{ id: 'r1', at: hackRun.at, hack: 'seufzer', area: 'gefuehl', seconds: 64, after: 4 }])
  expect(withEnergy({ hackRuns: [{ ...hackRun, after: 0 }] })?.hackRuns).toEqual([{ id: 'r1', at: hackRun.at, hack: 'seufzer', area: 'gefuehl', seconds: 64, before: 2 }])
  const bare = { id: 'r1', at: hackRun.at, hack: 'seufzer', area: 'gefuehl', seconds: 64 }
  expect(withEnergy({ hackRuns: [{ ...hackRun, before: '2', after: 2.5 }] })?.hackRuns).toEqual([bare])
  expect(withEnergy({ hackRuns: [{ ...bare, extra: 1 }] })?.hackRuns).toEqual([bare])
})
test('Sprints: nur 25, 50 und 90 Minuten; ein langer Text wird auf 80 Zeichen gekürzt', () => {
  const data = withEnergy({ focusSprints: [{ ...sprint, id: 'a', planned: 30 }, sprint, { ...sprint, id: 'b', planned: 25, task: 'x'.repeat(120) }, { ...sprint, id: 'c', seconds: -5 }, { ...sprint, id: 'd', at: '1' }] })
  expect(data?.focusSprints?.map(s => s.id)).toEqual(['s1', 'b'])
  expect(data?.focusSprints?.[1].task).toBe('x'.repeat(80))
  expect(data?.focusSprints?.[0]).toEqual(sprint)
})
test('Sprints: ein leerer oder falscher Text entfällt, der Sprint bleibt', () => {
  const { task: _task, ...bare } = sprint
  for (const task of ['', 5, null, {}]) expect(withEnergy({ focusSprints: [{ ...sprint, task }] })?.focusSprints).toEqual([bare])
  expect(withEnergy({ focusSprints: [bare] })?.focusSprints).toEqual([bare])
})
test('Leere Listen fehlen im Ergebnis', () => {
  const data = withEnergy({ energyCheckins: [], hackRuns: 'kein Array', focusSprints: [{ id: 'x' }] })
  expect(data).not.toBeNull()
  for (const key of ['energyCheckins', 'hackRuns', 'focusSprints']) expect(data).not.toHaveProperty(key)
  expect(parseData({ version: 1, sessions: [], settings: {} })).toEqual({ version: 1, sessions: [], settings: DEFAULT_SETTINGS })
  // Nur kaputte Einträge: Das Feld fehlt, der Rest bleibt.
  const onlyBad = withEnergy({ energyCheckins: [{ ...checkin, id: '' }] })
  expect(onlyBad).not.toHaveProperty('energyCheckins')
  expect(onlyBad?.sessions).toEqual([session])
})
test('settings.focus: fehlt oder ungültig ergibt den Standard, null bleibt null', () => {
  const std = { minutes: 50, sound: 'kaffee-und-notizen' }
  expect(withSettings({})?.focus).toEqual(std)
  expect(withSettings({ focus: 'x' })?.focus).toEqual(std)
  expect(withSettings({ focus: { minutes: 40, sound: 'gibtsnicht' } })?.focus).toEqual(std)
  expect(withSettings({ focus: { minutes: 25, sound: null } })?.focus).toEqual({ minutes: 25, sound: null })
  expect(withSettings({ focus: { sound: null } })?.focus).toEqual({ minutes: 50, sound: null })
  for (const minutes of [25, 50, 90]) expect(withSettings({ focus: { minutes } })?.focus.minutes).toBe(minutes)
  for (const minutes of [0, 30, '50', 50.5, null, NaN]) expect(withSettings({ focus: { minutes, sound: 'regen' } })?.focus).toEqual({ minutes: 50, sound: 'regen' })
  for (const { id } of [...SOUNDS, ...MUSIC]) expect(withSettings({ focus: { sound: id } })?.focus.sound).toBe(id)
  for (const sound of [undefined, 3, {}, 'nope']) expect(withSettings({ focus: { sound } })?.focus.sound).toBe('kaffee-und-notizen')
})
test('settings.focus hängt nicht an den Standard-Objekten', () => {
  const a = withSettings({})!
  expect(a.focus).not.toBe(DEFAULT_SETTINGS.focus)
  expect(emptyData().settings.focus).not.toBe(DEFAULT_SETTINGS.focus)
})
test('isSessionKind trennt Sitzungen von Hack-Läufen und Sprints', () => {
  for (const k of ['guided', 'timer', 'breath'] as const) expect(isSessionKind(k)).toBe(true)
  for (const k of ['hack', 'focus'] as const) expect(isSessionKind(k)).toBe(false)
})
