import { beforeEach, expect, test } from 'vitest'
import { serializeBackup } from '../../src/lib/stats/backup'
import { emptyData, type SessionResult } from '../../src/lib/stats/schema'
import { importBackup, recordResult, saveCheckin, saveMorning, setHackEffect, stats, toggleDomino } from '../../src/lib/stats/store.svelte'
import { dayKey } from '../../src/lib/stats/summary'

// Der Speicher ist ein Modul mit einem Zustand: pro Test auf den leeren Stand zurücksetzen.
beforeEach(() => {
  localStorage.clear()
  stats.data = emptyData()
  stats.saveFailed = false
})

const start = new Date('2026-10-21T12:00:00.000Z')
const result = (kind: SessionResult['kind'], ref: string, seconds: number, note?: string): SessionResult => ({ kind, ref, start, seconds, ...(note === undefined ? {} : { note }) })

test('recordResult leitet nach der Art weiter: Sitzung, Hack-Lauf, Sprint', () => {
  const session = recordResult(result('timer', 'timer', 600))
  const run = recordResult(result('hack', 'seufzer', 64.7))
  const sprint = recordResult(result('focus', 'focus-50', 3000.4, '  Kurskonzept '))
  expect([session, run, sprint].every(id => typeof id === 'string')).toBe(true)
  expect(stats.data.sessions.map(s => s.id)).toEqual([session]) // Hack und Sprint nie in den Sitzungen
  expect(stats.data.hackRuns).toEqual([{ id: run, at: start.toISOString(), hack: 'seufzer', area: 'gefuehl', seconds: 64 }])
  expect(stats.data.focusSprints).toEqual([{ id: sprint, at: start.toISOString(), planned: 50, seconds: 3000, task: 'Kurskonzept' }])
  expect(stats.saveFailed).toBe(false)
  // Gespeichert unter dem einen Schlüssel.
  expect(JSON.parse(localStorage.getItem('ruhe.v1')!)).toMatchObject({ hackRuns: [{ id: run }], focusSprints: [{ id: sprint }] })
})

test('recordResult zählt zu kurze Ergebnisse nicht', () => {
  expect(recordResult(result('timer', 'timer', 59))).toBeNull()
  expect(recordResult(result('hack', 'seufzer', 29))).toBeNull()
  expect(recordResult(result('hack', 'gibt-es-nicht', 600))).toBeNull()
  expect(recordResult(result('focus', 'focus-50', 299))).toBeNull()
  expect(recordResult(result('focus', 'focus-40', 600))).toBeNull()
  expect(stats.data).toMatchObject({ sessions: [] })
  for (const key of ['hackRuns', 'focusSprints']) expect(stats.data).not.toHaveProperty(key)
})

test('saveCheckin speichert alle vier Stufen; ein Hack danach übernimmt den Vorher-Wert; setHackEffect setzt Jetzt', () => {
  const levels = { koerper: 3, gefuehl: 2, geist: 4, sinn: 5 } as const
  saveCheckin(levels)
  expect(stats.data.energyCheckins).toHaveLength(1)
  expect(stats.data.energyCheckins![0].levels).toEqual(levels)
  // Der Check-in ist von „jetzt“; ein Hack, der eine Minute später beginnt, zählt ihn als Vorher-Wert.
  const id = recordResult({ kind: 'hack', ref: 'seufzer', start: new Date(Date.now() + 60_000), seconds: 64 })!
  expect(stats.data.hackRuns![0].before).toBe(2)
  setHackEffect(id, 'after', 4)
  expect(stats.data.hackRuns![0]).toMatchObject({ before: 2, after: 4 })
  setHackEffect(id, 'after', null)
  expect(stats.data.hackRuns![0]).not.toHaveProperty('after')
  const unchanged = stats.data
  setHackEffect('unbekannt', 'after', 3)
  expect(stats.data).toBe(unchanged)
})

test('importBackup meldet neue Sitzungen und neue Energie-Einträge', () => {
  saveCheckin({ koerper: 3, gefuehl: 3, geist: 3, sinn: 3 })
  recordResult(result('hack', 'seufzer', 64))
  recordResult(result('focus', 'focus-25', 1500))
  const file = serializeBackup(stats.data)
  stats.data = emptyData() // anderes Gerät
  expect(importBackup(file)).toEqual({ added: 0, addedEnergy: 3 })
  expect(importBackup(file)).toEqual({ added: 0, addedEnergy: 0 })
  expect(importBackup('kaputt')).toEqual({ error: 'Diese Datei ist kein gültiges Ruhe-Backup.' })
  expect(stats.data.hackRuns).toHaveLength(1)
  expect(stats.data.energyCheckins).toHaveLength(1)
  expect(stats.data.focusSprints).toHaveLength(1)
})

test('saveMorning und toggleDomino speichern in localStorage und lösen keine Sitzung aus', () => {
  saveMorning({ variant: 'lang', intention: ' klar ', gratitude: 'ein ruhiger Morgen', value: 'Mut', domino: 'Konzept' })
  expect(stats.data.mornings).toHaveLength(1)
  const entry = stats.data.mornings![0]
  // „Jetzt“ ist die Uhr der App: Der Tag ist der Tag des Zeitpunkts `at`.
  expect(entry).toMatchObject({ variant: 'lang', intention: 'klar', gratitude: 'ein ruhiger Morgen', value: 'Mut', domino: 'Konzept' })
  expect(entry.day).toBe(dayKey(new Date(entry.at)))
  expect(Math.abs(Date.now() - Date.parse(entry.at))).toBeLessThan(5000)
  expect(stats.saveFailed).toBe(false)
  expect(JSON.parse(localStorage.getItem('ruhe.v1')!).mornings).toEqual([entry])

  toggleDomino(entry.day)
  expect(stats.data.mornings![0].dominoDone).toBeTypeOf('string')
  expect(JSON.parse(localStorage.getItem('ruhe.v1')!).mornings[0].dominoDone).toBe(stats.data.mornings![0].dominoDone)
  toggleDomino(entry.day)
  expect(stats.data.mornings![0]).not.toHaveProperty('dominoDone')
  expect(JSON.parse(localStorage.getItem('ruhe.v1')!).mornings[0]).not.toHaveProperty('dominoDone')

  // Der Morgen-Start ist keine Sitzung, kein Check-in, kein Hack-Lauf und kein Sprint.
  expect(stats.data.sessions).toEqual([])
  for (const key of ['energyCheckins', 'hackRuns', 'focusSprints']) expect(stats.data).not.toHaveProperty(key)
  expect(JSON.parse(localStorage.getItem('ruhe.v1')!).sessions).toEqual([])
})
test('saveMorning ersetzt den Eintrag des Tags; toggleDomino ohne Eintrag oder Big Domino ändert nichts', () => {
  saveMorning({ variant: 'kurz', intention: 'klar' })
  const day = stats.data.mornings![0].day
  const unchanged = stats.data
  toggleDomino(day) // kein Big Domino
  toggleDomino('2000-01-01') // kein Eintrag
  expect(stats.data).toBe(unchanged)
  saveMorning({ variant: 'kurz', domino: 'Konzept' })
  toggleDomino(day)
  saveMorning({ variant: 'lang', domino: ' konzept ' })
  expect(stats.data.mornings).toHaveLength(1)
  expect(stats.data.mornings![0]).toMatchObject({ variant: 'lang', domino: 'konzept' })
  expect(stats.data.mornings![0].dominoDone).toBeTypeOf('string') // derselbe Big Domino: der Haken bleibt
  saveMorning({ variant: 'lang', domino: 'Anderes' })
  expect(stats.data.mornings![0]).not.toHaveProperty('dominoDone')
})
test('importBackup zählt neue Morgen-Einträge in addedEnergy', () => {
  saveMorning({ variant: 'kurz', intention: 'klar' })
  const file = serializeBackup(stats.data)
  stats.data = emptyData() // anderes Gerät
  expect(importBackup(file)).toEqual({ added: 0, addedEnergy: 1 })
  expect(importBackup(file)).toEqual({ added: 0, addedEnergy: 0 })
  expect(stats.data.mornings).toHaveLength(1)
})
