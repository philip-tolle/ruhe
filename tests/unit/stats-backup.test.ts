import { test, expect } from 'vitest'
import { backupFileName, serializeBackup, mergeBackup } from '../../src/lib/stats/backup'
import { emptyData, type AppData } from '../../src/lib/stats/schema'
const sess = (id: string, start: string) => ({ id, start, kind: 'timer' as const, ref: 'timer', seconds: 600 })
const INVALID = { error: 'Diese Datei ist kein gültiges Ruhe-Backup.' }

test('file name', () => expect(backupFileName(new Date(2026, 9, 21, 9))).toBe('ruhe-backup-2026-10-21.json'))
test('file name is zero padded', () => expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe('ruhe-backup-2026-01-05.json'))
test('round trip and merge without duplicates', () => {
  const mine = { ...emptyData(), sessions: [sess('a', '2026-10-20T08:00:00.000Z')] }
  const theirs = { ...emptyData(), sessions: [sess('a', '2026-10-20T08:00:00.000Z'), sess('b', '2026-10-19T08:00:00.000Z')], settings: { ...emptyData().settings, vibration: false } }
  const r = mergeBackup(mine, serializeBackup(theirs))
  expect('data' in r && r.added).toBe(1)
  expect('data' in r && r.data.sessions.map(x => x.id)).toEqual(['b', 'a'])
  expect('data' in r && r.data.settings.vibration).toBe(false)
})
test('serializeBackup writes indented version, sessions and settings only', () => {
  const data: AppData = { ...emptyData(), sessions: [sess('a', '2026-10-20T08:00:00.000Z')], lastUsed: { kind: 'breath', pattern: 'box', minutes: 3 } }
  const text = serializeBackup(data)
  expect(text).toContain('\n  "version": 1')
  expect(Object.keys(JSON.parse(text))).toEqual(['version', 'sessions', 'settings'])
  expect(JSON.parse(text)).toEqual({ version: 1, sessions: data.sessions, settings: data.settings })
})
test('merge keeps own lastUsed and takes settings from the file', () => {
  const lastUsed = { kind: 'timer' as const, minutes: 15, intervalMin: null, sound: null, lead: true }
  const mine: AppData = { ...emptyData(), lastUsed }
  const theirs: AppData = { ...emptyData(), settings: { ...emptyData().settings, timerLead: false, timer: { minutes: 30, intervalMin: 5 } }, lastUsed: { kind: 'breath', pattern: 'box', minutes: 3 } }
  const r = mergeBackup(mine, serializeBackup(theirs))
  expect(r).toEqual({ data: { version: 1, sessions: [], settings: theirs.settings, lastUsed }, added: 0, addedEnergy: 0 })
  const r2 = mergeBackup(emptyData(), serializeBackup(theirs))
  expect('data' in r2 && 'lastUsed' in r2.data).toBe(false)
})
test('merge sorts by start, skips duplicate ids (also inside the file) and does not touch the input', () => {
  const mine = { ...emptyData(), sessions: [sess('c', '2026-10-21T08:00:00.000Z'), sess('a', '2026-10-20T08:00:00.000Z')] }
  const before = JSON.stringify(mine)
  const theirs = { ...emptyData(), sessions: [sess('d', '2026-10-22T08:00:00.000Z'), sess('b', '2026-10-19T08:00:00.000Z'), sess('b', '2026-10-19T08:00:00.000Z'), sess('c', '2026-01-01T00:00:00.000Z')] }
  const r = mergeBackup(mine, serializeBackup(theirs))
  expect(r).toMatchObject({ added: 2 })
  expect('data' in r && r.data.sessions.map(x => x.id)).toEqual(['b', 'a', 'c', 'd'])
  expect('data' in r && r.data.sessions.find(x => x.id === 'c')?.start).toBe('2026-10-21T08:00:00.000Z') // eigene Sitzung bleibt
  expect(JSON.stringify(mine)).toBe(before)
})
test('invalid backup', () => {
  expect(mergeBackup(emptyData(), '{nope')).toEqual({ error: 'Diese Datei ist kein gültiges Ruhe-Backup.' })
  expect(mergeBackup(emptyData(), '{"version":7}')).toEqual({ error: 'Diese Datei ist kein gültiges Ruhe-Backup.' })
})
test('invalid backup variants leave everything untouched', () => {
  const mine = { ...emptyData(), sessions: [sess('a', '2026-10-20T08:00:00.000Z')] }
  const before = JSON.stringify(mine)
  for (const text of ['', 'null', '[]', '"x"', '{}', '{"version":1}', '{"version":1,"sessions":[{"id":"x"}],"settings":{}}', '{"version":1,"sessions":[],"settings":null}'])
    expect(mergeBackup(mine, text)).toEqual(INVALID)
  expect(JSON.stringify(mine)).toBe(before)
})
test('merge drops sessions under 60 s from the file instead of importing them; the file stays valid', () => {
  const short = (id: string, seconds: number) => ({ ...sess(id, '2026-10-19T08:00:00.000Z'), seconds })
  const theirs = { ...emptyData(), sessions: [short('null', 0), short('kurz', 59.9), short('genau', 60), sess('lang', '2026-10-20T08:00:00.000Z')] }
  const r = mergeBackup(emptyData(), serializeBackup(theirs))
  expect(r).toMatchObject({ added: 2 })
  expect('data' in r && r.data.sessions.map(x => x.id)).toEqual(['genau', 'lang'])
})

test('calm travels through export and import', () => {
  const current = emptyData()
  current.sessions.push({ ...sess('a', '2026-10-20T08:00:00.000Z'), calm: { before: 2, after: 4 } })
  const merged = mergeBackup(emptyData(), serializeBackup(current))
  if ('error' in merged) throw new Error(merged.error)
  expect(merged.data.sessions[0].calm).toEqual({ before: 2, after: 4 })
})
test('import never overwrites calm of a known session', () => {
  const current = emptyData()
  current.sessions.push({ ...sess('a', '2026-10-20T08:00:00.000Z'), calm: { before: 1 } })
  const file = emptyData()
  file.sessions.push({ ...sess('a', '2026-10-20T08:00:00.000Z'), calm: { before: 5 } })
  const merged = mergeBackup(current, serializeBackup(file))
  if ('error' in merged) throw new Error(merged.error)
  expect(merged.added).toBe(0)
  expect(merged.data.sessions[0].calm).toEqual({ before: 1 })
})

const own = (id: string, name = 'Abendruhe') => ({ id, name, inhale: 4, holdIn: 2, exhale: 6, holdOut: 0 })

test('serializeBackup enthält eigene Atemmuster, ohne Muster fehlt das Feld', () => {
  const data: AppData = { ...emptyData(), breathPatterns: [own('eigen-0000000a')] }
  expect(JSON.parse(serializeBackup(data)).breathPatterns).toEqual([own('eigen-0000000a')])
  expect(JSON.parse(serializeBackup(emptyData()))).not.toHaveProperty('breathPatterns')
})

// Review Focus 3: Ein Import verdoppelt nichts und überschreibt kein Muster des Geräts.
test('Import fügt nur unbekannte Muster hinzu', () => {
  const a = own('eigen-0000000a')
  const aChanged = own('eigen-0000000a', 'Anders')
  const b = own('eigen-0000000b', 'Morgen')
  const file = serializeBackup({ ...emptyData(), breathPatterns: [aChanged, b] })
  const mine: AppData = { ...emptyData(), breathPatterns: [a] }
  const once = mergeBackup(mine, file)
  expect('data' in once && once.data.breathPatterns).toEqual([a, b])
  const twice = 'data' in once ? mergeBackup(once.data, file) : once
  expect('data' in twice && twice.data.breathPatterns).toEqual([a, b])
  const fresh = mergeBackup(emptyData(), file)
  expect('data' in fresh && fresh.data.breathPatterns).toEqual([aChanged, b])
  // Datei ohne Muster: die des Geräts bleiben; ohne Muster auf beiden Seiten fehlt das Feld.
  const old = mergeBackup(mine, serializeBackup(emptyData()))
  expect('data' in old && old.data.breathPatterns).toEqual([a])
  const none = mergeBackup(emptyData(), serializeBackup(emptyData()))
  expect('data' in none && none.data).not.toHaveProperty('breathPatterns')
})

// Energie (Spec M9 §6.1): Export enthält die drei Listen, Import fügt nur unbekannte IDs hinzu.
const checkin = (id: string, at: string) => ({ id, at, levels: { koerper: 3, gefuehl: 2, geist: 4, sinn: 5 } as const })
const run = (id: string, at: string) => ({ id, at, hack: 'seufzer', area: 'gefuehl' as const, seconds: 64, before: 2 as const })
const sprint = (id: string, at: string) => ({ id, at, planned: 50 as const, seconds: 3000 })
const energy = (): AppData => ({
  ...emptyData(),
  energyCheckins: [checkin('c1', '2026-10-20T08:00:00.000Z'), checkin('c2', '2026-10-21T08:00:00.000Z')],
  hackRuns: [run('r1', '2026-10-20T09:00:00.000Z')],
  focusSprints: [sprint('s1', '2026-10-20T10:00:00.000Z')],
})

test('Energie im Backup: Export enthält die drei Listen, ohne Energie fehlen sie', () => {
  const parsed = JSON.parse(serializeBackup(energy()))
  expect(Object.keys(parsed)).toEqual(['version', 'sessions', 'settings', 'energyCheckins', 'hackRuns', 'focusSprints'])
  expect(parsed.energyCheckins).toEqual(energy().energyCheckins)
  expect(parsed.hackRuns).toEqual(energy().hackRuns)
  expect(parsed.focusSprints).toEqual(energy().focusSprints)
  expect(Object.keys(JSON.parse(serializeBackup(emptyData())))).toEqual(['version', 'sessions', 'settings'])
  expect(Object.keys(JSON.parse(serializeBackup({ ...emptyData(), hackRuns: [run('r1', '2026-10-20T09:00:00.000Z')] })))).toEqual(['version', 'sessions', 'settings', 'hackRuns'])
})
test('Energie im Backup: Import fügt nur unbekannte IDs hinzu, addedEnergy zählt sie', () => {
  const mine: AppData = { ...emptyData(), energyCheckins: [checkin('c1', '2026-10-20T08:00:00.000Z')], hackRuns: [{ ...run('r1', '2026-10-20T09:00:00.000Z'), seconds: 99 }] }
  const merged = mergeBackup(mine, serializeBackup(energy()))
  if ('error' in merged) throw new Error(merged.error)
  expect(merged.addedEnergy).toBe(2) // c2 und s1; c1 und r1 kannte das Gerät schon
  expect(merged.added).toBe(0)
  expect(merged.data.energyCheckins?.map(c => c.id)).toEqual(['c1', 'c2'])
  expect(merged.data.hackRuns).toEqual([{ ...run('r1', '2026-10-20T09:00:00.000Z'), seconds: 99 }]) // der Eintrag des Geräts bleibt
  expect(merged.data.focusSprints).toEqual([sprint('s1', '2026-10-20T10:00:00.000Z')])
  const fresh = mergeBackup(emptyData(), serializeBackup(energy()))
  expect('data' in fresh && fresh.addedEnergy).toBe(4)
  expect('data' in fresh && fresh.data).toMatchObject({ energyCheckins: energy().energyCheckins, hackRuns: energy().hackRuns, focusSprints: energy().focusSprints })
})
test('Energie im Backup: zweimal importiert bleibt addedEnergy beim zweiten Mal 0, nichts doppelt', () => {
  const file = serializeBackup(energy())
  const once = mergeBackup(emptyData(), file)
  if ('error' in once) throw new Error(once.error)
  expect(once.addedEnergy).toBe(4)
  const twice = mergeBackup(once.data, file)
  if ('error' in twice) throw new Error(twice.error)
  expect(twice.addedEnergy).toBe(0)
  expect(twice.data).toEqual(once.data)
  expect(twice.data.energyCheckins).toHaveLength(2)
  // Dieselbe ID doppelt in der Datei zählt einmal.
  const dup = JSON.stringify({ ...energy(), energyCheckins: [checkin('c1', '2026-10-20T08:00:00.000Z'), checkin('c1', '2026-10-20T08:00:00.000Z')], hackRuns: [], focusSprints: [] })
  const d = mergeBackup(emptyData(), dup)
  expect('data' in d && d.addedEnergy).toBe(1)
  expect('data' in d && d.data.energyCheckins).toHaveLength(1)
})
test('Energie im Backup: Einträge kommen nach Zeit sortiert, ein ungültiger Eintrag der Datei entfällt einzeln', () => {
  const mine: AppData = { ...emptyData(), energyCheckins: [checkin('c2', '2026-10-21T08:00:00.000Z')] }
  const file = JSON.stringify({ ...emptyData(), energyCheckins: [checkin('c3', '2026-10-22T08:00:00.000Z'), { id: '', at: 'x' }, checkin('c1', '2026-10-20T08:00:00.000Z')] })
  const merged = mergeBackup(mine, file)
  expect('data' in merged && merged.data.energyCheckins?.map(c => c.id)).toEqual(['c1', 'c2', 'c3'])
  expect('data' in merged && merged.addedEnergy).toBe(2)
})
test('Energie im Backup: ein altes Backup ohne Energie-Felder lässt die Daten des Geräts unverändert', () => {
  const mine: AppData = { ...energy(), sessions: [sess('a', '2026-10-20T08:00:00.000Z')] }
  const before = JSON.stringify(mine)
  const merged = mergeBackup(mine, JSON.stringify({ version: 1, sessions: [sess('b', '2026-10-19T08:00:00.000Z')], settings: {} }))
  if ('error' in merged) throw new Error(merged.error)
  expect(merged.added).toBe(1)
  expect(merged.addedEnergy).toBe(0)
  expect(merged.data.energyCheckins).toEqual(mine.energyCheckins)
  expect(merged.data.hackRuns).toEqual(mine.hackRuns)
  expect(merged.data.focusSprints).toEqual(mine.focusSprints)
  expect(JSON.stringify(mine)).toBe(before)
  // Ohne Energie auf beiden Seiten fehlen die Felder.
  const none = mergeBackup(emptyData(), serializeBackup(emptyData()))
  for (const key of ['energyCheckins', 'hackRuns', 'focusSprints']) expect('data' in none && none.data).not.toHaveProperty(key)
})
