// @ts-check
// Reine Textlogik für die geführten Meditationen (kein Dateizugriff, keine Audiowerkzeuge):
// Parser für content/meditations/<id>.md (Spec 5.1), Hash der Sprechabschnitte (Cache-Schlüssel),
// Zerlegung in Vertonungs-Abschnitte und Schätzung der Länge.
// Wird vom Skript scripts/meditations.mjs und von Vitest genutzt.
import { createHash } from 'node:crypto'

/**
 * @typedef {{ kind: 'speech', text: string }} SpeechSegment
 * @typedef {{ kind: 'pause', seconds: number }} PauseSegment
 * @typedef {SpeechSegment | PauseSegment} Segment
 *
 * @typedef {'achtsamkeit' | 'stress' | 'fokus' | 'mitgefuehl' | 'gefuehle' | 'alltag'} Category
 * @typedef {{ id: string, title: string, category: Category, minutes: number, description: string }} Meta
 *
 * @typedef {{ id: string, model: string, settings: Record<string, unknown> }} Voice
 * @typedef {{ hash: string, text: string, previousText: string | null, nextText: string | null }} Section
 * @typedef {{ chars: number, speechSeconds: number, pauseSeconds: number, totalSeconds: number, silenceShare: number }} Estimate
 */

/** Sekunden von der Anfangs-Schale bis zum ersten Wort; die Schale klingt darunter weiter. */
export const BOWL_LEAD = 4
/** Stille zwischen dem letzten Wort und der End-Schale. */
export const END_PAUSE = 3
/** Länge der Klangschale (Ausklang), nach der die Datei endet. */
export const BOWL_RING = 12
/** Sekunden nach dem letzten Wort: 3 s Stille, dann die End-Schale mit 12 s Ausklang. */
export const BOWL_TAIL = END_PAUSE + BOWL_RING
/** Sprechtempo bei ruhiger Stimme (Zeichen pro Sekunde), Grundlage der Schätzung. */
export const CHARS_PER_SECOND = 13
/** Stille zwischen zwei Absätzen ohne Markierung. */
export const PARAGRAPH_PAUSE = 3
/** Richtwert aus Spec 5.1: mindestens 40 % der Gesamtlänge sind Stille. */
export const MIN_SILENCE_SHARE = 0.4

/** @type {readonly Category[]} */
export const CATEGORIES = ['achtsamkeit', 'stress', 'fokus', 'mitgefuehl', 'gefuehle', 'alltag']

/** Reihenfolge des Katalogs (Spec 3.2: Thema für Thema, darin wie in der Tabelle). */
export const CATALOG_ORDER = [
  'ankommen-im-atem',
  'gedanken-wie-wolken',
  'bodyscan-im-sitzen',
  'drei-minuten-atempause',
  'nach-einem-vollen-tag',
  'vor-einem-wichtigen-termin',
  'guten-morgen',
  'fokus-vor-der-arbeit',
  'energie-in-der-mittagspause',
  // Meilenstein 7 (Spec M7 §2): neue Themen, dann je eine mehr in den bisherigen.
  'freundlich-mit-dir',
  'liebevolle-guete',
  'ein-schweres-gefuehl-begleiten',
  'wenn-die-gedanken-kreisen',
  'gehmeditation',
  'achtsam-essen',
  'klaenge-hoeren',
  'die-schultern-sinken-lassen',
  'atemzuege-zaehlen',
]

const FIELDS = ['id', 'title', 'category', 'minutes', 'description']
const PAUSE_MARKER = /^\[Pause (\d+(?:\.[05])?)s\]$/
const PAUSE_HINT = 'Erlaubt ist nur eine eigene Zeile [Pause Ns] mit ganzen oder halben Sekunden, z. B. [Pause 8s] oder [Pause 2.5s].'

/** Fehler in einem Meditationstext; `line` ist die 1-basierte Zeile in der Datei. */
export class MeditationTextError extends Error {
  /**
   * @param {number} line
   * @param {string} message
   */
  constructor(line, message) {
    super(`Zeile ${line}: ${message}`)
    this.name = 'MeditationTextError'
    this.line = line
  }
}

/**
 * Wert einer Frontmatter-Zeile: optional in Anführungszeichen, sonst ohne Kommentar am Zeilenende (` # …`).
 * @param {string} raw
 */
function frontmatterValue(raw) {
  const value = raw.trim()
  const quote = value[0]
  if (quote === '"' || quote === "'") {
    const end = value.indexOf(quote, 1)
    if (end > 0 && /^(?:\s+#.*)?$/.test(value.slice(end + 1))) return value.slice(1, end)
  }
  return value.replace(/\s+#.*$/, '').trim()
}

/**
 * @param {string[]} lines
 * @returns {{ meta: Meta, bodyStart: number }} bodyStart ist der Index der ersten Zeile nach dem Frontmatter
 */
function parseFrontmatter(lines) {
  if (lines[0]?.trim() !== '---') {
    throw new MeditationTextError(1, 'Das Frontmatter fehlt: Die Datei muss mit --- beginnen.')
  }
  const close = lines.findIndex((line, i) => i > 0 && line.trim() === '---')
  if (close < 0) throw new MeditationTextError(1, 'Das Frontmatter ist nicht geschlossen: Das schließende --- fehlt.')

  /** @type {Map<string, { value: string, line: number }>} */
  const found = new Map()
  for (let i = 1; i < close; i++) {
    const text = lines[i].trim()
    if (text === '' || text.startsWith('#')) continue
    const match = /^([A-Za-z_][\w-]*)\s*:(.*)$/.exec(text)
    if (!match) throw new MeditationTextError(i + 1, `Frontmatter-Zeile ohne „Feld: Wert“: „${text}“.`)
    const [, key, raw] = match
    if (!FIELDS.includes(key)) {
      throw new MeditationTextError(i + 1, `Unbekanntes Feld „${key}“ im Frontmatter (erlaubt: ${FIELDS.join(', ')}).`)
    }
    if (found.has(key)) throw new MeditationTextError(i + 1, `Das Feld „${key}“ steht mehrfach im Frontmatter.`)
    found.set(key, { value: frontmatterValue(raw), line: i + 1 })
  }
  for (const key of FIELDS) {
    if (!found.has(key)) throw new MeditationTextError(1, `Das Feld „${key}“ fehlt im Frontmatter.`)
  }

  /** @param {string} key */
  const field = (key) => /** @type {{ value: string, line: number }} */ (found.get(key))
  const { value: id, line: idLine } = field('id')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new MeditationTextError(idLine, `Ungültige id „${id}“ – erlaubt sind Kleinbuchstaben, Ziffern und Bindestriche (id).`)
  }
  const { value: title, line: titleLine } = field('title')
  if (title === '') throw new MeditationTextError(titleLine, 'Der Titel (title) ist leer.')
  const { value: category, line: categoryLine } = field('category')
  if (!CATEGORIES.includes(/** @type {Category} */ (category))) {
    throw new MeditationTextError(categoryLine, `Ungültiges Thema „${category}“ (category): erlaubt ist ${CATEGORIES.join(' | ')}.`)
  }
  const { value: minutes, line: minutesLine } = field('minutes')
  if (!/^[1-9]\d*$/.test(minutes)) {
    throw new MeditationTextError(minutesLine, `Ungültige Ziel-Länge „${minutes}“ (minutes): erwartet eine ganze Zahl ab 1.`)
  }
  const { value: description, line: descriptionLine } = field('description')
  if (description === '') throw new MeditationTextError(descriptionLine, 'Die Beschreibung (description) ist leer.')

  return {
    meta: { id, title, category: /** @type {Category} */ (category), minutes: Number(minutes), description },
    bodyStart: close + 1,
  }
}

/**
 * Liest eine Meditationsdatei: Frontmatter und Text mit `[Pause Ns]`-Markierungen.
 *
 * - Absätze (durch Leerzeilen getrennt) sind Sprechabschnitte; Zeilenumbrüche im Absatz sind Leerzeichen.
 * - Zwischen zwei Absätzen ohne Markierung liegen 3 s Stille.
 * - Eine Markierung ersetzt diese 3 s (sie kommen nicht dazu); aufeinanderfolgende Markierungen werden addiert.
 * - Am Anfang und am Ende gibt es keine Pause (dort rahmt die Klangschale).
 *
 * Wirft `MeditationTextError` (mit Zeilennummer) bei fehlendem oder ungültigem Frontmatter und bei
 * falscher Pausen-Syntax wie `[Pause 8]`, `[Pause 2.3s]` oder `[Pause -1s]`.
 *
 * @param {string} source
 * @returns {{ meta: Meta, segments: Segment[] }}
 */
export function parseMeditation(source) {
  const lines = source.replace(/^﻿/, '').split(/\r\n|\r|\n/)
  const { meta, bodyStart } = parseFrontmatter(lines)

  /** @type {Array<{ kind: 'speech', text: string } | { kind: 'pause', seconds: number }>} */
  const blocks = []
  /** @type {string[]} */
  let paragraph = []
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'speech', text: paragraph.join(' ') })
    paragraph = []
  }
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') {
      flush()
      continue
    }
    if (/\[\s*pause/i.test(line)) {
      const match = PAUSE_MARKER.exec(line)
      if (!match) throw new MeditationTextError(i + 1, `Ungültige Pausen-Markierung in „${line}“. ${PAUSE_HINT}`)
      const seconds = Number(match[1])
      if (seconds <= 0) throw new MeditationTextError(i + 1, `Die Pause in „${line}“ muss mindestens 0.5 s lang sein. ${PAUSE_HINT}`)
      flush()
      blocks.push({ kind: 'pause', seconds })
      continue
    }
    paragraph.push(line)
  }
  flush()

  /** @type {Segment[]} */
  const segments = []
  let seenSpeech = false
  let marked = 0 // Summe der Markierungen seit dem letzten Sprechabschnitt
  let hasMarker = false
  for (const block of blocks) {
    if (block.kind === 'pause') {
      marked += block.seconds
      hasMarker = true
      continue
    }
    if (seenSpeech) segments.push({ kind: 'pause', seconds: hasMarker ? marked : PARAGRAPH_PAUSE })
    segments.push(block)
    seenSpeech = true
    marked = 0
    hasMarker = false
  }
  // Markierungen vor dem ersten und nach dem letzten Sprechabschnitt entfallen (die Klangschale rahmt).
  if (!seenSpeech) throw new MeditationTextError(bodyStart + 1, 'Der Text enthält keinen Sprechtext.')
  return { meta, segments }
}

/**
 * JSON mit rekursiv sortierten Schlüsseln, damit gleiche Daten immer denselben Text ergeben.
 * @param {unknown} value
 * @returns {string}
 */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = /** @type {Record<string, unknown>} */ (value)
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * Cache-Schlüssel eines Sprechabschnitts: SHA-256 (hex, 16 Zeichen) über Stimme, Modell, Einstellungen
 * und den *eigenen* Text – nicht über die Nachbarn. Eine Änderung am Nachbarabsatz kostet also nichts.
 *
 * @param {string} text
 * @param {Voice} voice
 * @returns {string}
 */
export function speechHash(text, voice) {
  const payload = stableStringify({ voiceId: voice.id, model: voice.model, settings: voice.settings, text })
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}

/**
 * Die Sprechabschnitte in Reihenfolge, so wie sie vertont werden: Hash, Text und die Texte der
 * benachbarten Sprechabschnitte (Kontext für durchgehende Betonung; `null` an den Enden).
 *
 * @param {Segment[]} segments
 * @param {Voice} voice
 * @returns {Section[]}
 */
export function splitSections(segments, voice) {
  const speech = /** @type {SpeechSegment[]} */ (segments.filter((segment) => segment.kind === 'speech'))
  return speech.map((segment, i) => ({
    hash: speechHash(segment.text, voice),
    text: segment.text,
    previousText: speech[i - 1]?.text ?? null,
    nextText: speech[i + 1]?.text ?? null,
  }))
}

/**
 * Prüft den Inhalt von audio-work/voice.json.
 * @param {unknown} value
 * @returns {Voice}
 */
export function validateVoice(value) {
  const v = /** @type {Record<string, unknown> | null} */ (value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null)
  const isObject = (/** @type {unknown} */ x) => x !== null && typeof x === 'object' && !Array.isArray(x)
  if (!v || typeof v.id !== 'string' || v.id === '' || typeof v.model !== 'string' || v.model === '' || !isObject(v.settings)) {
    throw new Error('audio-work/voice.json muss { "id": "…", "model": "…", "settings": { … } } enthalten.')
  }
  return /** @type {Voice} */ (v)
}

/**
 * Schätzt die Länge der fertigen Datei. Die Anfangs-Schale (`BOWL_LEAD`) und das Ende (`BOWL_TAIL`) zählen
 * als Stille und sind in `pauseSeconds` enthalten; es gilt `totalSeconds = speechSeconds + pauseSeconds`.
 *
 * @param {Segment[]} segments
 * @returns {Estimate}
 */
export function estimate(segments) {
  let chars = 0
  let textPauses = 0
  for (const segment of segments) {
    if (segment.kind === 'speech') chars += [...segment.text].length
    else textPauses += segment.seconds
  }
  const speechSeconds = chars / CHARS_PER_SECOND
  const pauseSeconds = textPauses + BOWL_LEAD + BOWL_TAIL
  const totalSeconds = speechSeconds + pauseSeconds
  return { chars, speechSeconds, pauseSeconds, totalSeconds, silenceShare: pauseSeconds / totalSeconds }
}
