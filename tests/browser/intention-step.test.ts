// Der Schritt „Intention“ (IntentionStep): Der Bereich der Vorschläge wird beim Einblenden festgehalten, und die Live-Zeile sagt
// nur die Wahl eines Vorschlags an, nicht jeden Tastendruck im Feld. Liegt unter browser/, weil die Komponente einen
// Svelte-Compiler und die Runen der Oberfläche braucht. Alle Daten sind ausgedacht.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import IntentionStep from '../../src/components/morning/IntentionStep.svelte'
import { emptyData } from '../../src/lib/stats/schema'
import { stats } from '../../src/lib/stats/store.svelte'
import { closeMorning, morningUi, openMorning } from '../../src/lib/ui/morning-ui.svelte'
import { tageszeitUi } from '../../src/lib/ui/tageszeit.svelte'

let target: HTMLElement | null = null
let instance: ReturnType<typeof mount> | null = null

beforeEach(() => {
  localStorage.clear()
  stats.data = emptyData()
  stats.saveFailed = false
  closeMorning()
})

afterEach(() => {
  if (instance) void unmount(instance)
  target?.remove()
  instance = null
  target = null
  vi.useRealTimers()
  tageszeitUi.now = Date.now()
})

/** Stellt die Uhr des Tests (nur `Date`) und die Minuten-Uhr der App auf `at`. */
function setClock(at: Date): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(at)
  tageszeitUi.now = at.getTime()
}

function checkin(at: Date, levels: Record<'koerper' | 'gefuehl' | 'geist' | 'sinn', 1 | 2 | 3 | 4 | 5>, id = 'c-1') {
  return { id, at: at.toISOString(), levels }
}

function show(): void {
  openMorning('kurz')
  morningUi.step = 'intention'
  target = document.createElement('div')
  document.body.append(target)
  instance = mount(IntentionStep, { target })
  flushSync()
}

const chips = () => [...target!.querySelectorAll('[role="radiogroup"][aria-label="Vorschläge"] [role="radio"]')].map((c) => c.textContent!.trim())
const lead = () => target!.querySelector('.lead')?.textContent?.trim() ?? null
const field = () => target!.querySelector<HTMLInputElement>('input[type="text"]')!
const live = () => target!.querySelectorAll<HTMLElement>('[aria-live]')

const AT = new Date(2026, 9, 28, 7, 30)
const KOERPER = ['geerdet', 'kraftvoll', 'leicht', 'beweglich', 'sanft mit mir', 'achtsam']
const DEFAULT = ['klar', 'gelassen', 'mutig', 'freundlich', 'fokussiert', 'dankbar']

test('the suggestions follow the weakest area of a fresh check-in', () => {
  setClock(AT)
  stats.data = { ...emptyData(), energyCheckins: [checkin(new Date(2026, 9, 28, 7, 0), { koerper: 1, gefuehl: 3, geist: 3, sinn: 3 })] }
  show()
  expect(chips()).toEqual(KOERPER)
  expect(lead()).toBe('Dein Körper-Akku ist gerade am niedrigsten.')
})

test('the area stays when the clock runs on and the check-in stops being fresh', () => {
  setClock(AT)
  stats.data = { ...emptyData(), energyCheckins: [checkin(new Date(2026, 9, 28, 7, 0), { koerper: 1, gefuehl: 3, geist: 3, sinn: 3 })] }
  show()
  expect(chips()).toEqual(KOERPER)

  // Vier Stunden später (nach „frisch“ = 3 Stunden): Ohne Festhalten wechselten die Vorschläge unter den Fingern.
  setClock(new Date(2026, 9, 28, 11, 30))
  flushSync()
  expect(chips()).toEqual(KOERPER)
  expect(lead()).toBe('Dein Körper-Akku ist gerade am niedrigsten.')
})

test('the area stays when another check-in is saved while the step is open', () => {
  setClock(AT)
  const first = checkin(new Date(2026, 9, 28, 7, 0), { koerper: 1, gefuehl: 3, geist: 3, sinn: 3 })
  stats.data = { ...emptyData(), energyCheckins: [first] }
  show()
  expect(chips()).toEqual(KOERPER)

  stats.data = { ...stats.data, energyCheckins: [first, checkin(new Date(2026, 9, 28, 7, 25), { koerper: 4, gefuehl: 4, geist: 1, sinn: 4 }, 'c-2')] }
  flushSync()
  expect(chips()).toEqual(KOERPER)
  expect(lead()).toBe('Dein Körper-Akku ist gerade am niedrigsten.')
})

test('the check-in of the flow beats an older one from the store; without any, the default words and no line', () => {
  setClock(AT)
  stats.data = { ...emptyData(), energyCheckins: [checkin(new Date(2026, 9, 28, 7, 0), { koerper: 1, gefuehl: 3, geist: 3, sinn: 3 })] }
  openMorning('kurz')
  morningUi.checkin = { koerper: 4, gefuehl: 4, geist: 2, sinn: 4 }
  morningUi.step = 'intention'
  target = document.createElement('div')
  document.body.append(target)
  instance = mount(IntentionStep, { target })
  flushSync()
  expect(chips()).toEqual(['klar', 'fokussiert', 'wach', 'neugierig', 'gesammelt', 'entschieden'])
  expect(lead()).toBe('Dein Geist-Akku ist gerade am niedrigsten.')

  void unmount(instance)
  target.remove()
  stats.data = emptyData()
  show()
  expect(chips()).toEqual(DEFAULT)
  expect(lead()).toBeNull()
})

// ── Die Live-Zeile ──────────────────────────────────────────────────────────────────────────────────────────────

/** Tippt `text` zeichenweise ans Ende des Felds, wie die Tastatur: `beforeinput`, neuer Wert, `input`. */
function type(text: string): void {
  const input = field()
  input.focus()
  for (const char of text) {
    const at = input.value.length
    input.setSelectionRange(at, at)
    input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: char, bubbles: true, cancelable: true }))
    input.setRangeText(char, at, at, 'end')
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }))
  }
}

test('the live line announces the choice of a suggestion and not every key typed in the field', async () => {
  setClock(AT)
  show()
  expect(live()).toHaveLength(1)
  const region = live()[0]
  expect(region.getAttribute('aria-live')).toBe('polite')
  expect(region.textContent).toBe('')

  // Alles, was die Region je zeigt, wird mitgeschrieben (eine Hilfstechnik sagt jede Änderung des Textes an).
  const shown: string[] = []
  const observer = new MutationObserver(() => shown.push(region.textContent ?? ''))
  observer.observe(region, { childList: true, characterData: true, subtree: true })

  const chip = target!.querySelector<HTMLElement>('[role="radio"]')! // „klar“
  chip.click()
  flushSync()
  await Promise.resolve()
  expect(region.textContent).toBe('Heute will ich klar sein.')
  // Die sichtbare Zeile ist keine Live-Region, zeigt aber denselben Satz.
  const summary = target!.querySelector('.summary')!
  expect(summary.textContent).toBe('Heute will ich klar sein.')
  expect(summary.hasAttribute('aria-live')).toBe(false)

  // Tippen im Feld: Die sichtbare Zeile folgt jedem Zeichen, die Live-Region sagt nichts davon an.
  shown.length = 0
  type('furchtlos')
  flushSync()
  await Promise.resolve()
  expect(field().value).toBe('furchtlos')
  expect(summary.textContent).toBe('Heute will ich furchtlos sein.')
  expect(region.textContent).toBe('')
  expect(shown.every((text) => text === '')).toBe(true)

  // Ein Tipp auf einen Vorschlag sagt wieder an, die Wahl zurückzunehmen ebenfalls (mit dem Satz der leeren Wahl).
  chip.click()
  flushSync()
  await Promise.resolve()
  expect(region.textContent).toBe('Heute will ich klar sein.')
  chip.click()
  flushSync()
  await Promise.resolve()
  expect(region.textContent).toBe('Wähle ein Wort oder tippe ein eigenes.')
  observer.disconnect()
})

// Der Kasten aus dem Abend-Logbuch (Spec M11 §2.4): „Gestern vorgenommen“ und „Wochenfokus“, beim Einblenden festgehalten.
const box = () => target!.querySelector('[aria-label="Von gestern Abend"]')

test('the box from last evening shows yesterday’s 1 % and the week focus, and stays while the step is open', () => {
  setClock(AT)
  stats.data = {
    ...emptyData(),
    evenings: [
      { day: '2026-10-25', at: '2026-10-25T20:00:00.000Z', weekFocus: 'Mehr Schlaf' },
      { day: '2026-10-27', at: '2026-10-27T20:00:00.000Z', better: 'Handy aus bis 10 Uhr' },
    ],
  }
  show()
  expect(box()?.textContent).toContain('Gestern vorgenommen')
  expect(box()?.textContent).toContain('Handy aus bis 10 Uhr')
  expect(box()?.textContent).toContain('Wochenfokus')
  expect(box()?.textContent).toContain('Mehr Schlaf')

  // Ändern sich die Daten, während der Schritt offen ist, bleibt der Kasten, wie er war.
  stats.data = { ...emptyData() }
  flushSync()
  expect(box()?.textContent).toContain('Handy aus bis 10 Uhr')
})

test('without a logbook there is no box', () => {
  setClock(AT)
  stats.data = emptyData()
  show()
  expect(box()).toBeNull()
})
