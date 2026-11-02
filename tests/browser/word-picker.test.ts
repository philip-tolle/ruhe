// Die Wortwahl geführter Abläufe (`WordPicker`, Spec M12 §2.6): Mit `refs` steht „Deine Prinzipien“ als eigene Gruppe vorn und
// „Vorschläge“ bekommt eine sichtbare Beschriftung; über alle Gruppen gilt genau eine Wahl. Ohne `refs` bleibt alles wie
// bisher. Liegt unter browser/, weil die Komponente einen Svelte-Compiler und echte Fokus-Ereignisse braucht. Alle Wörter
// sind ausgedacht und neutral.
import { afterEach, expect, test } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import WordPickerHarness from './harness/WordPickerHarness.svelte'

type Ref = { id: string; text: string }
type Props = { words: readonly string[]; own?: readonly string[]; refs?: readonly Ref[] }
type Instance = { current: () => { value: string; refValue: string | null } } & Record<string, unknown>

let mounted: { target: HTMLElement; instance: Instance }[] = []
let target: HTMLElement
let instance: Instance

function show(props: Props): void {
  target = document.createElement('div')
  document.body.append(target)
  instance = mount(WordPickerHarness, { target, props }) as Instance
  mounted.push({ target, instance })
  flushSync()
}

function unmountAll(): void {
  for (const m of mounted) {
    unmount(m.instance)
    m.target.remove()
  }
  mounted = []
}

afterEach(unmountAll)

const current = () => instance.current()
const groupEls = () => [...target.querySelectorAll<HTMLElement>('[role="radiogroup"]')]
const groupName = (group: HTMLElement) => group.getAttribute('aria-label') ?? document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent?.trim() ?? ''
const groups = () => groupEls().map(groupName)
const labels = () => [...target.querySelectorAll<HTMLElement>('.own-label')].map((l) => l.textContent!.trim())
const radiosOf = (name: string) => [...groupEls().find((g) => groupName(g) === name)!.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
const radiosIn = (name: string) => radiosOf(name).map((r) => r.textContent!.trim())
const radio = (name: string) => [...target.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((r) => r.textContent!.trim() === name)!
const checked = () => [...target.querySelectorAll<HTMLElement>('[aria-checked="true"]')].map((r) => r.textContent!.trim())
const field = () => target.querySelector<HTMLInputElement>('input')!
const keydown = (key: string) => new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })

/** Tippt `text` ins Feld, wie der Browser: erst `beforeinput`, dann der neue Wert und `input`. */
function type(text: string): void {
  const input = field()
  input.focus()
  input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, cancelable: true }))
  input.value = text
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true }))
}

/** Das DOM eines Prüfstands; das Präfix aus `$props.id()` (die Kennung des Felds ohne „-field“) wird zu „#“. */
function html(props: Props): string {
  show(props)
  const prefix = field().id.replace(/-field$/, '')
  const out = target.innerHTML.replaceAll(`${prefix}-`, '#-')
  unmountAll()
  return out
}

const REFS = [{ id: 's-0000000a', text: 'Mehrweg statt Einweg' }, { id: 's-0000000f', text: 'Schach im Park' }]

test('ohne refs: Vorschläge ohne sichtbare Beschriftung, Verhalten wie bisher', () => {
  show({ words: ['Dranbleiben', 'Mehr Schlaf'], own: ['Schach lernen'] })
  expect([groups(), labels()]).toEqual([['Vorschläge', 'Deine Wörter'], ['Deine Wörter']])
  radio('Dranbleiben').click()
  expect(current().value).toBe('Dranbleiben')
  radio('Dranbleiben').click()
  expect(current().value).toBe('')
})

test('refs: [] ergibt dasselbe DOM wie ohne refs', () => {
  expect(html({ words: ['Dranbleiben'], own: ['Schach lernen'], refs: [] })).toBe(html({ words: ['Dranbleiben'], own: ['Schach lernen'] }))
})

test('mit refs: „Deine Prinzipien“ zuerst in der Reihenfolge von refs, „Vorschläge“ sichtbar beschriftet', () => {
  show({ words: ['Dranbleiben'], own: ['Schach lernen'], refs: REFS })
  expect([groups(), labels()]).toEqual([['Deine Prinzipien', 'Vorschläge', 'Deine Wörter'], ['Deine Prinzipien', 'Vorschläge', 'Deine Wörter']])
  expect(radiosIn('Deine Prinzipien')).toEqual(['Mehrweg statt Einweg', 'Schach im Park'])
})

test('genau eine Wahl über alle Gruppen; ein Tipp auf ein Prinzip leert das Feld, ein zweiter nimmt zurück; ein getipptes Wort bleibt ein Wort', () => {
  show({ words: ['Dranbleiben'], refs: REFS })
  type('Mehrweg statt Einweg')
  flushSync()
  expect([current(), checked()]).toEqual([{ value: 'Mehrweg statt Einweg', refValue: null }, []])
  radio('Mehrweg statt Einweg').click()
  flushSync()
  expect([current(), field().value, checked()]).toEqual([{ value: '', refValue: 's-0000000a' }, '', ['Mehrweg statt Einweg']])
  radio('Dranbleiben').click()
  flushSync()
  expect([current(), checked()]).toEqual([{ value: 'Dranbleiben', refValue: null }, ['Dranbleiben']])
  radio('Schach im Park').click()
  radio('Schach im Park').click()
  flushSync()
  expect([current().refValue, checked()]).toEqual([null, []])
})

test('Pfeiltasten je Gruppe; auf das gewählte Prinzip bewegen sie nur den Fokus', () => {
  show({ words: ['Dranbleiben'], refs: REFS })
  radio('Mehrweg statt Einweg').click()
  flushSync()
  radio('Mehrweg statt Einweg').dispatchEvent(keydown('ArrowRight'))
  flushSync()
  expect([current().refValue, document.activeElement]).toEqual(['s-0000000f', radio('Schach im Park')])
  unmountAll()
  show({ words: ['Dranbleiben'], refs: [REFS[0]] })
  radio('Mehrweg statt Einweg').click()
  radio('Mehrweg statt Einweg').dispatchEvent(keydown('ArrowRight'))
  flushSync()
  expect(current().refValue).toBe('s-0000000a')
})

test('zwei gleiche Leitsätze und 13 refs (wie nach einem Import): alle da, ohne Fehler, nur der getippte gewählt', () => {
  const many = Array.from({ length: 13 }, (_, i) => ({ id: `s-${(i + 1).toString(16).padStart(8, '0')}`, text: i < 2 ? 'Mehrweg statt Einweg' : `Prinzip ${i + 1}` }))
  show({ words: ['Dranbleiben'], refs: many })
  expect(radiosIn('Deine Prinzipien')).toHaveLength(13)
  radiosOf('Deine Prinzipien')[1].click()
  flushSync()
  expect(current().refValue).toBe('s-00000002')
  expect(radiosOf('Deine Prinzipien').map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', ...Array(11).fill('false')])
})

test('ohne Vorschläge fehlt deren Gruppe samt Beschriftung', () => {
  show({ words: [], refs: REFS })
  expect([groups(), labels()]).toEqual([['Deine Prinzipien'], ['Deine Prinzipien']])
})
