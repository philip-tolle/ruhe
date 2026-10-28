// Die reine Kürz-Funktion der Eingabefelder des Morgen-Starts (`limitEdit`): Überlauf wie beim nativen `maxlength`, nur
// die EINGEFÜGTE Stelle wird gekürzt, der Rest des Textes bleibt. Die Eingaben stehen für das Feld vor und nach der
// Änderung samt Cursor (UTF-16-Einheiten); gezählt wird in Unicode-Zeichen, wie `clipChars`. Alle Texte sind ausgedacht.
import { expect, test } from 'vitest'
import { limitEdit } from '../../src/lib/morning/limited-input'

/** Fügt `text` in `before` bei `at` ein (ersetzt `[at, to)`), wie der Browser es täte: neuer Wert und Cursor dahinter. */
function edit(before: string, at: number, text: string, to = at) {
  const after = before.slice(0, at) + text + before.slice(to)
  return { before, after, caret: at + text.length }
}

function run(before: string, at: number, text: string, max: number, to = at) {
  const e = edit(before, at, text, to)
  return limitEdit(e.before, e.after, e.caret, max)
}

test('an edit that fits is left alone: same value, same caret', () => {
  expect(run('abc', 3, 'de', 10)).toEqual({ value: 'abcde', cursor: 5 })
  expect(run('abc', 1, 'XY', 10)).toEqual({ value: 'aXYbc', cursor: 3 })
  // Auch genau bis zur Grenze.
  expect(run('abc', 3, 'defghij', 10)).toEqual({ value: 'abcdefghij', cursor: 10 })
})

test('deleting never changes anything', () => {
  const e = edit('abcdef', 2, '', 4) // „cd“ gelöscht
  expect(limitEdit(e.before, e.after, e.caret, 10)).toEqual({ value: 'abef', cursor: 2 })
})

test('typing at the end of a full field is dropped: the previous value and caret stay', () => {
  expect(run('abcde', 5, 'f', 5)).toEqual({ value: 'abcde', cursor: 5 })
})

test('an insertion at the end that does not fit is cut at the free room', () => {
  expect(run('abcde', 5, 'fghij', 8)).toEqual({ value: 'abcdefgh', cursor: 8 })
})

test('an insertion in the middle that does not fit is cut only where it was inserted: the end stays', () => {
  // 10 Zeichen, Platz für 4 mehr bei max 14: Von „WXYZ12345“ passen vier.
  const value = 'Anfang-Ende'
  const result = run(value, 6, 'WXYZ12345', value.length + 4)
  expect(result.value).toBe('Anfang' + 'WXYZ' + '-Ende')
  // Der Cursor steht direkt hinter dem Eingefügten.
  expect(result.cursor).toBe('AnfangWXYZ'.length)
})

test('no room left: an insertion in the middle leaves the value and the caret where they were', () => {
  const value = 'x'.repeat(40) + 'ENDE'
  const result = run(value, 20, 'EINGEFÜGT', value.length)
  expect(result).toEqual({ value, cursor: 20 })
})

test('replacing a selection frees its room for the new text', () => {
  // „cdef“ ausgewählt (vier Zeichen), „WXYZ12345“ eingefügt: Es passen vier.
  const result = run('abcdefghij', 2, 'WXYZ12345', 10, 6)
  expect(result).toEqual({ value: 'abWXYZghij', cursor: 6 })
})

test('replacing everything cuts the new text at the end like a plain maximum', () => {
  const result = run('alt', 0, 'abcdefghijkl', 8, 3)
  expect(result).toEqual({ value: 'abcdefgh', cursor: 8 })
})

test('it counts and cuts in Unicode characters, never inside a surrogate pair', () => {
  // Ein Emoji sind zwei UTF-16-Einheiten und ein Zeichen. Bei max 5 sind zwei da, in der Mitte kommen vier dazu: drei passen.
  const result = run('😀😀', 2, '😁😁😁😁', 5)
  expect(result.value).toBe('😀' + '😁😁😁' + '😀')
  expect(Array.from(result.value)).toHaveLength(5)
  expect(result.cursor).toBe('😀😁😁😁'.length)
})

test('two emoji that share their first half are told apart and not torn', () => {
  // 😀 = D83D DE00, 😁 = D83D DE01: Die gemeinsame Vorderseite endet mitten im Paar, der Schnitt darf dort nicht liegen.
  const result = run('😀', 0, '😁😁😁', 2, 2)
  expect(result.value).toBe('😁😁')
  expect(Array.from(result.value)).toHaveLength(2)
})

test('line breaks in the inserted text become single spaces, around the break included', () => {
  expect(run('ab', 1, 'x\ny', 20)).toEqual({ value: 'ax yb', cursor: 4 })
  expect(run('ab', 2, 'x \r\n  y', 20)).toEqual({ value: 'abx y', cursor: 5 })
  expect(run('', 0, '\n\nHallo\n', 20)).toEqual({ value: ' Hallo ', cursor: 7 })
})

test('a line break and the maximum together: the space counts, then the cut', () => {
  expect(run('ab', 2, 'x\nyz', 5)).toEqual({ value: 'abx y', cursor: 5 })
})

test('text before and after the insertion is not touched by the line-break rule', () => {
  // Das Leerzeichen vor dem Einfügen bleibt, wie es war (nur die eingefügte Stelle wird bereinigt).
  expect(run('Hallo ', 6, 'Welt\n!', 30)).toEqual({ value: 'Hallo Welt !', cursor: 12 })
})

test('when the old value does not explain the new one, the whole value is cleaned and cut at the end', () => {
  // Fremde Änderung (etwa ein Wert, der von außen gesetzt wurde): kein Versuch, die Stelle zu erraten.
  expect(limitEdit('völlig anders', 'abcdef\nghij', 5, 8)).toEqual({ value: 'abcdef g', cursor: 8 })
})

test('a caret outside the value is clamped', () => {
  expect(limitEdit('', 'abc', 99, 10)).toEqual({ value: 'abc', cursor: 3 })
})
