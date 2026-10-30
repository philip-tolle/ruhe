// Der Zustand des Abend-Logbuchs (`eveningUi`, Spec M11 §2.3/§4.2): Schrittliste, beim Öffnen festgelegt, Weiter und
// Überspringen, Speichern im Abschluss mit Klangschale, Beenden ohne Eintrag. Die Klangschale ist ersetzt: Der Test prüft,
// was der Ablauf auslöst, nicht Audio. Alle Eingaben sind ausgedacht.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

vi.mock('../../src/lib/audio/chime', () => ({ playChime: vi.fn(), CHIME_EVENING: 0.4 }))

import { playChime } from '../../src/lib/audio/chime'
import { emptyData, type MorningEntry } from '../../src/lib/stats/schema'
import { stats } from '../../src/lib/stats/store.svelte'
import { closeEvening, draftEntry, eveningUi, nextEveningStep, openEvening, skipEveningStep } from '../../src/lib/ui/evening-ui.svelte'
import { tageszeitUi } from '../../src/lib/ui/tageszeit.svelte'

/** Stellt die Uhr des Tests (nur `Date`) und die Minuten-Uhr der App auf `at`. */
function setClock(at: Date): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(at)
  tageszeitUi.now = at.getTime()
}

const morning = (day: string, extra: Partial<MorningEntry> = {}): MorningEntry => ({ day, at: `${day}T06:00:00.000Z`, variant: 'kurz', ...extra })

beforeEach(() => {
  localStorage.clear()
  stats.data = emptyData()
  stats.saveFailed = false
  vi.clearAllMocks()
  closeEvening()
})

afterEach(() => {
  vi.useRealTimers()
  tageszeitUi.now = Date.now()
})

/** Schaltet bis zum Abschluss weiter. */
function walkToEnd(): void {
  for (let i = 0; i < 10 && eveningUi.step !== 'abschluss'; i++) nextEveningStep()
}

test('Werktag ohne Morgen-Eintrag: fünf Schritte, erster ist der Check-in, leerer Entwurf', () => {
  setClock(new Date(2026, 9, 29, 20, 0))
  eveningUi.draft.gave = ['Alt']
  openEvening()
  expect(eveningUi.open).toBe(true)
  expect(eveningUi.day).toBe('2026-10-29')
  expect(eveningUi.sunday).toBe(false)
  expect(eveningUi.steps).toEqual(['checkin', 'geber', 'raeuber', 'gelernt', 'besser'])
  expect(eveningUi.step).toBe('checkin')
  expect(eveningUi.draft).toEqual({ gave: [], cost: [], intentionScore: null, learned: '', better: '', weekFocus: '' })
  expect(eveningUi.entry).toBeNull()
})

test('Sonntag mit Big Domino am Morgen: sieben Schritte mit Rückblick und Woche', () => {
  setClock(new Date(2026, 10, 1, 21, 0))
  stats.data = { ...emptyData(), mornings: [morning('2026-11-01', { domino: 'Konzept' })] }
  openEvening()
  expect(eveningUi.sunday).toBe(true)
  expect(eveningUi.steps).toEqual(['checkin', 'geber', 'raeuber', 'rueckblick', 'gelernt', 'besser', 'woche'])
})

test('Montag 0:30 gehört zum Sonntag; endet das Logbuch nach 4:00, wird trotzdem für den Sonntag gespeichert', () => {
  setClock(new Date(2026, 10, 2, 0, 30))
  openEvening()
  expect(eveningUi.day).toBe('2026-11-01')
  expect(eveningUi.sunday).toBe(true)
  eveningUi.draft.weekFocus = 'Mehr Schlaf'
  setClock(new Date(2026, 10, 2, 4, 5))
  walkToEnd()
  expect(stats.data.evenings).toHaveLength(1)
  expect(stats.data.evenings![0]).toMatchObject({ day: '2026-11-01', weekFocus: 'Mehr Schlaf' })
})

test('der Durchlauf speichert genau den Entwurf, läutet einmal leise und speichert im Abschluss nicht noch einmal', () => {
  setClock(new Date(2026, 9, 29, 20, 0))
  stats.data = { ...emptyData(), mornings: [morning('2026-10-29', { intention: 'klar' })] }
  openEvening()
  Object.assign(eveningUi.draft, { gave: ['Bewegung', 'Kochen'], cost: ['Bildschirm'], intentionScore: 'teils', learned: ' Pausen helfen. ', better: 'Früher ins Bett' })
  walkToEnd()
  expect(eveningUi.step).toBe('abschluss')
  const expected = { day: '2026-10-29', gave: ['Bewegung', 'Kochen'], cost: ['Bildschirm'], intentionScore: 'teils', learned: 'Pausen helfen.', better: 'Früher ins Bett' }
  expect(eveningUi.entry).toMatchObject(expected)
  expect(stats.data.evenings).toEqual([eveningUi.entry])
  expect(playChime).toHaveBeenCalledTimes(1)
  expect(playChime).toHaveBeenCalledWith(undefined, 0.4)
  const saved = JSON.stringify(stats.data.evenings)
  nextEveningStep()
  skipEveningStep()
  expect(JSON.stringify(stats.data.evenings)).toBe(saved)
  expect(playChime).toHaveBeenCalledTimes(1)
})

test('Überspringen verwirft die Eingabe des Schritts', () => {
  setClock(new Date(2026, 9, 29, 20, 0))
  stats.data = { ...emptyData(), mornings: [morning('2026-10-29', { domino: 'Konzept' })] }
  openEvening()
  Object.assign(eveningUi.draft, { gave: ['Bewegung'], cost: ['Lärm'], intentionScore: 'ganz', learned: 'Etwas', better: 'Etwas anderes' })
  nextEveningStep() // Check-in → Geber
  skipEveningStep()
  expect(eveningUi.draft.gave).toEqual([])
  expect(eveningUi.step).toBe('raeuber')
  nextEveningStep() // Räuber → Rückblick (Eingabe bleibt)
  expect(eveningUi.draft.cost).toEqual(['Lärm'])
  skipEveningStep()
  expect(eveningUi.draft.intentionScore).toBeNull()
  skipEveningStep()
  expect(eveningUi.draft.learned).toBe('')
  skipEveningStep()
  expect(eveningUi.draft.better).toBe('')
  expect(eveningUi.step).toBe('abschluss')
  expect(stats.data.evenings![0]).toEqual({ day: '2026-10-29', at: expect.any(String), cost: ['Lärm'] })
})

test('der Wochenfokus wird an einem Werktag nicht gespeichert', () => {
  setClock(new Date(2026, 9, 29, 20, 0))
  openEvening()
  eveningUi.draft.weekFocus = 'Mehr Schlaf'
  walkToEnd()
  expect(stats.data.evenings![0]).not.toHaveProperty('weekFocus')
})

test('Beenden vor dem Abschluss legt keinen Logbuch-Eintrag an', () => {
  setClock(new Date(2026, 9, 29, 20, 0))
  openEvening()
  eveningUi.draft.gave = ['Bewegung']
  nextEveningStep()
  closeEvening()
  expect(eveningUi.open).toBe(false)
  expect(stats.data.evenings).toBeUndefined()
  nextEveningStep()
  expect(stats.data.evenings).toBeUndefined()
})

test('draftEntry: der Entwurf als Eintrag des Logbuch-Tages', () => {
  setClock(new Date(2026, 9, 29, 20, 0))
  openEvening()
  Object.assign(eveningUi.draft, { gave: ['Musik'], learned: 'Heute' })
  expect(draftEntry()).toMatchObject({ day: '2026-10-29', gave: ['Musik'], learned: 'Heute' })
})
