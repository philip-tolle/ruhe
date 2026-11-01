// Die Zeilen von „Dein Abend“ (`EveningSummary`, Spec M11 §2.1, M12 §2.6): „Für die neue Woche: …“ mit Wort oder Leitsatz,
// aufgelöst über die Sammlung; ein gelöschtes Prinzip zeigt keine Zeile. Liegt unter browser/, weil die Komponente einen
// Svelte-Compiler braucht. Alle Einträge sind erfunden und neutral.
import { afterEach, expect, test } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import EveningSummary from '../../src/components/evening/EveningSummary.svelte'
import { emptyData, type EveningEntry } from '../../src/lib/stats/schema'
import { stats } from '../../src/lib/stats/store.svelte'

let target: HTMLElement
let instance: Record<string, unknown>

function show(entry: EveningEntry): void {
  target = document.createElement('div')
  document.body.append(target)
  instance = mount(EveningSummary, { target, props: { entry, morning: null } })
  flushSync()
}

afterEach(() => {
  unmount(instance)
  target.remove()
  stats.data = emptyData()
})

const lines = () => [...target.querySelectorAll('.line')].map((l) => l.textContent!.trim())

const at = '2026-11-01T20:00:00.000Z'
const PRINZIP = { id: 's-0000000a', kind: 'prinzip' as const, text: 'Mehrweg statt Einweg' }

test('„Für die neue Woche: {Wort}“ statt „Wochenfokus: …“', () => {
  show({ day: '2026-11-01', at, weekFocus: 'Mehr Schlaf' })
  expect(lines()).toEqual(['Für die neue Woche: Mehr Schlaf'])
})

test('„Für die neue Woche: {Leitsatz}“ über die Sammlung; Umbenennen folgt sofort', () => {
  stats.data = { ...emptyData(), collection: [PRINZIP] }
  show({ day: '2026-11-01', at, weekPrinciple: PRINZIP.id })
  expect(lines()).toEqual(['Für die neue Woche: Mehrweg statt Einweg'])
  stats.data = { ...emptyData(), collection: [{ ...PRINZIP, text: 'Mehrweg statt Einweg im Alltag' }] }
  flushSync()
  expect(lines()).toEqual(['Für die neue Woche: Mehrweg statt Einweg im Alltag'])
})

test('gelöschtes Prinzip: keine Zeile, dann „Logbuch erledigt.“', () => {
  stats.data = emptyData()
  show({ day: '2026-11-01', at, weekPrinciple: PRINZIP.id })
  expect(lines()).toEqual(['Logbuch erledigt.'])
})
