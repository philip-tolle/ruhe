// Die Action `limitedInput` an einem echten Feld: Überlauf wie beim nativen `maxlength` (nur die eingefügte Stelle wird
// gekürzt), Zeilenumbrüche als Leerzeichen, keine Eingriffe in eine IME-Komposition, „Return“ schließt die Tastatur. Die
// Ereignisse des Browsers beim Tippen, Einfügen und Komponieren werden nachgestellt (`beforeinput`, `input`, `composition*`);
// die Kürzregeln selbst prüft `tests/unit/limited-input.test.ts`. Alle Texte sind ausgedacht.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ActionReturn } from 'svelte/action'
import { limitedInput, type LimitedInputOptions } from '../../src/lib/morning/limited-input'

let field: HTMLTextAreaElement
let action: ActionReturn<LimitedInputOptions>
let seen: string[]

beforeEach(() => {
  field = document.createElement('textarea')
  document.body.append(field)
  seen = []
})

afterEach(() => {
  action.destroy?.()
  field.remove()
})

/** Hängt die Action mit der Grenze `max` an das Feld; der Aufrufer schreibt wie in der Oberfläche den Wert zurück. */
function attach(max: number, value = ''): void {
  field.value = value
  action = limitedInput(field, { max, onChange: (v) => seen.push(v) }) as ActionReturn<LimitedInputOptions>
}

/** Ersetzt `[start, end)` durch `text`, wie der Browser beim Tippen oder Einfügen: erst `beforeinput`, dann der neue Wert. */
function insert(text: string, start: number, end = start, composing = false): void {
  field.focus()
  field.setSelectionRange(start, end)
  field.dispatchEvent(new InputEvent('beforeinput', { inputType: composing ? 'insertCompositionText' : 'insertText', data: text, isComposing: composing, bubbles: true, cancelable: true }))
  field.setRangeText(text, start, end, 'end')
  field.dispatchEvent(new InputEvent('input', { inputType: composing ? 'insertCompositionText' : 'insertText', data: text, isComposing: composing, bubbles: true }))
}

test('pasting into the middle of a full field leaves the end standing: value and caret stay', () => {
  const full = 'A'.repeat(40) + 'B'.repeat(40)
  attach(80, full)
  insert('EINGEFÜGT', 40)
  expect(field.value).toBe(full)
  expect(field.selectionStart).toBe(40)
  expect(field.selectionEnd).toBe(40)
  expect(seen.at(-1)).toBe(full)
})

test('pasting into the middle that does not fit is cut at the inserted spot, the caret behind it', () => {
  const value = 'A'.repeat(35) + 'B'.repeat(40) // 75 Zeichen, Platz für 5
  attach(80, value)
  insert('1234567890', 35)
  expect(field.value).toBe('A'.repeat(35) + '12345' + 'B'.repeat(40))
  expect(field.selectionStart).toBe(40)
  expect(field.selectionEnd).toBe(40)
  expect(seen.at(-1)).toBe(field.value)
})

test('typing at the end of a full field is dropped, and the counted value stays at the maximum', () => {
  attach(5, 'abcde')
  insert('f', 5)
  expect(field.value).toBe('abcde')
  expect(field.selectionStart).toBe(5)
})

test('replacing a selection frees its room; emoji outside the BMP count as one character', () => {
  attach(6, '😀😀😀😀😀😀')
  insert('😁😁😁😁', 2, 6) // zwei Emoji ausgewählt (vier Einheiten) und vier neue eingefügt: Platz für zwei
  expect(Array.from(field.value)).toHaveLength(6)
  expect(field.value).toBe('😀' + '😁😁' + '😀😀😀')
  expect(field.selectionStart).toBe('😀😁😁'.length)
})

test('line breaks in pasted text become single spaces', () => {
  attach(80)
  insert('erste\nzweite\r\n\r\ndritte', 0)
  expect(field.value).toBe('erste zweite dritte')
  expect(field.selectionStart).toBe(field.value.length)
})

test('during a composition nothing is changed; after compositionend the inserted part is cut once', () => {
  attach(10, 'ab' + 'cdefgh')
  field.focus()
  field.setSelectionRange(2, 2)
  field.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
  // Der Vorschlag wächst über die Grenze hinaus; das Feld bleibt, wie die Tastatur es schreibt.
  insert('xyz', 2, 2, true)
  insert('xyzuv', 2, 5, true)
  insert('xyzuvwqr', 2, 7, true)
  expect(field.value).toBe('ab' + 'xyzuvwqr' + 'cdefgh')
  expect(Array.from(field.value).length).toBeGreaterThan(10)
  expect(seen.at(-1)).toBe(field.value) // der rohe Zwischenstand

  field.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
  expect(field.value).toBe('ab' + 'xy' + 'cdefgh') // Platz für zwei
  expect(field.selectionStart).toBe(4)
  expect(seen.at(-1)).toBe(field.value)
})

test('a composition that fits is left alone', () => {
  attach(20, 'ab')
  field.focus()
  field.setSelectionRange(2, 2)
  field.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
  insert('wort', 2, 2, true)
  field.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
  expect(field.value).toBe('abwort')
  expect(field.selectionStart).toBe(6)
})

test('Return closes the keyboard (blur) and writes no line break; during a composition it does nothing', () => {
  attach(80, 'abc')
  field.focus()
  expect(document.activeElement).toBe(field)
  const composing = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })
  field.dispatchEvent(composing)
  expect(composing.defaultPrevented).toBe(false)
  expect(document.activeElement).toBe(field)

  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  field.dispatchEvent(enter)
  expect(enter.defaultPrevented).toBe(true)
  expect(document.activeElement).not.toBe(field)

  field.focus()
  const other = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true })
  field.dispatchEvent(other)
  expect(other.defaultPrevented).toBe(false)
  expect(document.activeElement).toBe(field)
})

test('update swaps the limit and the callback; destroy detaches the listeners', () => {
  attach(5, 'abc')
  const later = vi.fn()
  action.update?.({ max: 8, onChange: later })
  insert('defgh', 3)
  expect(field.value).toBe('abcdefgh')
  expect(later).toHaveBeenCalledWith('abcdefgh')
  expect(seen).toEqual([])

  action.destroy?.()
  insert('ijk', 8)
  expect(field.value).toBe('abcdefghijk') // niemand greift mehr ein
  expect(later).toHaveBeenCalledTimes(1)
})
