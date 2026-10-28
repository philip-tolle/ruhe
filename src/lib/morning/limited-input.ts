// Die Eingabefelder des Morgen-Starts (Dankbarkeit, Big Domino, Wort/Wert): ein gemeinsamer Helfer statt dreier Kopien.
// Sie begrenzen die Länge in Unicode-Zeichen (nicht in UTF-16-Einheiten wie `maxlength`, das ein Emoji nach der Hälfte der
// Zeichen abschnitte), machen aus Zeilenumbrüchen (eingefügter Text) Leerzeichen und schließen mit „Return“ nur die Tastatur.
//
// Der Überlauf verhält sich wie beim nativen `maxlength`: Passt eine Einfügung nicht ganz, wird nur die EINGEFÜGTE Stelle auf
// den Restplatz gekürzt; der Text davor und dahinter bleibt, und der Cursor steht direkt hinter dem Eingefügten. Ist kein Platz
// mehr, bleibt der vorige Wert samt Cursor. (Das Abschneiden des Textendes mit dem Cursor am Ende, wie `clipChars` auf den
// ganzen Wert, löschte beim Einfügen in der Mitte still eigenen Text am Ende.)
//
// Während einer IME-Komposition (Tastaturen mit Wortvorschlag, Eingabe von Zeichen aus Zeichenfolgen) greift der Helfer nicht
// ein: Ein neuer Wert des Felds mitten darin bräche die Komposition ab. Nach `compositionend` prüft er einmal.
import type { Action } from 'svelte/action'
import { clipChars } from '../stats/schema'

/** Ein Zeilenumbruch samt Leerraum drumherum, was zu einem einzigen Leerzeichen wird. */
const LINE_BREAKS = /\s*[\r\n]+\s*/g

const length = (text: string): number => Array.from(text).length

const isHighSurrogate = (unit: number): boolean => unit >= 0xd800 && unit <= 0xdbff

export interface LimitedValue {
  value: string
  /** Cursor in UTF-16-Einheiten, wie `selectionStart`. */
  cursor: number
}

/**
 * Das Feld nach einer Änderung, begrenzt auf `max` Zeichen und ohne Zeilenumbrüche. `before` ist der Wert vor der Änderung,
 * `after` der Wert danach, wie der Browser ihn gesetzt hat, `caret` der Cursor danach. Die Änderung ist eine zusammenhängende
 * Stelle, hinter der der Cursor steht (Tippen, Einfügen, Ersetzen einer Auswahl, Löschen); alles dahinter ist unverändert,
 * alles davor, soweit es mit `before` übereinstimmt, ebenfalls. Nur die Stelle dazwischen, das Eingefügte, wird gekürzt
 * (`max` minus Zeichen davor und dahinter) und von Zeilenumbrüchen befreit. Ist nichts zu tun, kommt `after` mit `caret`
 * unverändert zurück.
 */
export function limitEdit(before: string, after: string, caret: number, max: number): LimitedValue {
  const cursor = Math.min(Math.max(caret, 0), after.length)
  if (!/[\r\n]/.test(after) && length(after) <= max) return { value: after, cursor }

  const suffix = after.slice(cursor)
  if (!before.endsWith(suffix)) {
    // Die Änderung lässt sich nicht an der Stelle des Cursors festmachen: der ganze Wert, am Ende gekürzt.
    const value = clipChars(after.replace(LINE_BREAKS, ' '), max)
    return { value, cursor: value.length }
  }

  // Vorn so weit gemeinsam mit dem alten Wert, wie vor dem unveränderten Rest Platz ist; nie mitten in einem Ersatzpaar.
  const end = Math.min(before.length - suffix.length, cursor)
  let start = 0
  while (start < end && before.charCodeAt(start) === after.charCodeAt(start)) start++
  if (start > 0 && isHighSurrogate(after.charCodeAt(start - 1))) start--

  const prefix = after.slice(0, start)
  const inserted = after.slice(start, cursor).replace(LINE_BREAKS, ' ')
  const room = Math.max(0, max - length(prefix) - length(suffix))
  const fitted = clipChars(inserted, room)
  return { value: prefix + fitted + suffix, cursor: prefix.length + fitted.length }
}

export interface LimitedInputOptions {
  /** Höchstlänge in Unicode-Zeichen. */
  max: number
  /** Bekommt den Wert des Felds nach jeder Änderung (bei einer Komposition den rohen Zwischenstand). */
  onChange: (value: string) => void
}

/**
 * Svelte-Action für ein `<input type="text">` oder `<textarea>`: begrenzt, bereinigt (siehe `limitEdit`) und gibt den Wert an
 * `onChange`. „Return“ schließt die Tastatur (`blur`), statt einen Zeilenumbruch zu schreiben; das gilt nicht, solange eine
 * Komposition läuft (dort bestätigt „Return“ den Vorschlag). Den Wert des Felds (`value`) setzt weiter der Aufrufer.
 */
export const limitedInput: Action<HTMLInputElement | HTMLTextAreaElement, LimitedInputOptions> = (node, options) => {
  let current = options
  // Der Wert, bevor die Änderung begann. Jede Änderung beginnt mit `beforeinput` (oder, bei einer Komposition, mit
  // `compositionstart`); der Aufrufer setzt den Wert auch von außen (Übernehmen, Wahl eines Worts), darum wird der Stand erst
  // dann gelesen.
  let before = node.value
  let composing = false

  function settle(): void {
    const result = limitEdit(before, node.value, node.selectionStart ?? node.value.length, current.max)
    if (result.value !== node.value) {
      node.value = result.value
      node.setSelectionRange(result.cursor, result.cursor)
    }
    before = result.value
    current.onChange(result.value)
  }

  function onBeforeInput(): void {
    if (!composing) before = node.value
  }

  function onInput(event: Event): void {
    if (composing || (event as InputEvent).isComposing) {
      current.onChange(node.value)
      return
    }
    settle()
  }

  function onCompositionStart(): void {
    composing = true
    before = node.value
  }

  function onCompositionEnd(): void {
    composing = false
    settle()
  }

  function onKeydown(event: Event): void {
    const key = event as KeyboardEvent
    if (key.key !== 'Enter' || key.isComposing || composing) return
    key.preventDefault()
    node.blur()
  }

  node.addEventListener('beforeinput', onBeforeInput)
  node.addEventListener('input', onInput)
  node.addEventListener('compositionstart', onCompositionStart)
  node.addEventListener('compositionend', onCompositionEnd)
  node.addEventListener('keydown', onKeydown)

  return {
    update(next) {
      current = next
    },
    destroy() {
      node.removeEventListener('beforeinput', onBeforeInput)
      node.removeEventListener('input', onInput)
      node.removeEventListener('compositionstart', onCompositionStart)
      node.removeEventListener('compositionend', onCompositionEnd)
      node.removeEventListener('keydown', onKeydown)
    },
  }
}
