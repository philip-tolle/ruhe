// Werkzeug für die geführten Meditationen (Spec 5.2 bis 5.4, Meilenstein 3).
// Zerlegt die Texte aus content/meditations/, schätzt Längen, legt Platzhalter-Audio an, setzt vertonte
// Abschnitte zur fertigen MP3 zusammen und schreibt das Manifest, das die App liest.
// Vertont wird nicht hier: Die Abschnitte entstehen außerhalb (Connector) und liegen als
// audio-work/cache/<hash>.mp3 bereit. Dieses Skript braucht keinen API-Schlüssel.
//
// Aufruf: npm run meditations <Befehl> [id] [Optionen]   (braucht ffmpeg und ffprobe)
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  buildAssembleArgs,
  buildMeasureArgs,
  buildPlaceholderArgs,
  measureLoudness,
  planTimeline,
  probeDuration,
  runFfmpeg,
} from './lib/meditation-audio.mjs'
import {
  CATALOG_ORDER,
  estimate,
  MIN_SILENCE_SHARE,
  parseMeditation,
  splitSections,
  validateVoice,
} from './lib/meditation-text.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const USAGE = `Aufruf: npm run meditations <Befehl> [id] [Optionen]

Befehle
  estimate [id]     Tabelle je Meditation: Zeichen, geschätzte und Ziel-Länge, Stilleanteil
                    (Exit 1, wenn eine Meditation unter 40 % Stille liegt)
  split [id]        schreibt audio-work/sections/<id>.json mit den Sprechabschnitten
                    (braucht audio-work/voice.json: { id, model, settings })
  placeholders      legt für jede Meditation ohne echte Datei einen Platzhalter an
                    (public/audio/meditations/<id>.mp3, MP3 mono 16 kbit/s)
  assemble <id>     setzt Schale, vertonte Abschnitte aus audio-work/cache und Pausen zur fertigen
                    MP3 zusammen (mono 64 kbit/s, −19 LUFS, zwei Durchgänge); nimmt die id aus
                    placeholders.json, sobald die Datei an ihrem Platz liegt
  manifest          schreibt src/content/meditations.json (je Eintrag mit „version“: die ersten
                    10 Hex-Zeichen des SHA-256 der MP3; die App hängt sie als ?v= an die Adresse)

Optionen (Standardwerte im Repo; vor allem für Tests)
  --content <Ordner>    Meditationstexte            (content/meditations)
  --work <Ordner>       Arbeitsordner               (audio-work)
  --audio <Ordner>      fertige Dateien             (public/audio/meditations)
  --manifest <Datei>    Manifest                    (src/content/meditations.json)
  --cache <Ordner>      vertonte Abschnitte         (<work>/cache)
  --voice <Datei>       Stimme                      (<work>/voice.json)
  --out <Datei>         nur assemble: Zieldatei; placeholders.json ändert sich nur, wenn sie
                        <audio>/<id>.mp3 ist
`

/** Fehler, die der Nutzer beheben kann: nur die Meldung wird ausgegeben. */
class CliError extends Error {}

let args
try {
  args = parseArgs({
    allowPositionals: true,
    options: {
      content: { type: 'string' },
      work: { type: 'string' },
      audio: { type: 'string' },
      manifest: { type: 'string' },
      cache: { type: 'string' },
      voice: { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
} catch (err) {
  console.error(`${err instanceof Error ? err.message : err}\n\n${USAGE}`)
  process.exit(1)
}
const { values: options, positionals } = args

const work = resolve(options.work ?? join(ROOT, 'audio-work'))
const paths = {
  content: resolve(options.content ?? join(ROOT, 'content', 'meditations')),
  work,
  audio: resolve(options.audio ?? join(ROOT, 'public', 'audio', 'meditations')),
  manifest: resolve(options.manifest ?? join(ROOT, 'src', 'content', 'meditations.json')),
  cache: resolve(options.cache ?? join(work, 'cache')),
  voice: resolve(options.voice ?? join(work, 'voice.json')),
  placeholders: join(work, 'placeholders.json'),
  sections: join(work, 'sections'),
  bowl: join(ROOT, 'public', 'audio', 'sounds', 'klangschale.ogg'),
}

// ---------------------------------------------------------------- Dateien

/** @param {string} file @param {unknown} data */
function writeJson(file, data) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

/**
 * @param {string} file
 * @param {string} label
 */
function readJson(file, label) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (err) {
    throw new CliError(`${label} (${file}) ist kein gültiges JSON: ${err instanceof Error ? err.message : err}`)
  }
}

/** Ids, deren Datei noch ein Platzhalter ist. @returns {string[]} */
function readPlaceholders() {
  if (!existsSync(paths.placeholders)) return []
  const list = readJson(paths.placeholders, 'placeholders.json')
  if (!Array.isArray(list) || list.some((id) => typeof id !== 'string')) {
    throw new CliError(`placeholders.json (${paths.placeholders}) muss eine Liste von ids sein.`)
  }
  return list
}

/** @param {Iterable<string>} ids */
function writePlaceholders(ids) {
  writeJson(paths.placeholders, [...new Set(ids)].sort())
}

function readVoice() {
  if (!existsSync(paths.voice)) throw new CliError('Erst die Stimme festlegen (audio-work/voice.json).')
  try {
    return validateVoice(readJson(paths.voice, 'voice.json'))
  } catch (err) {
    throw err instanceof CliError ? err : new CliError(err instanceof Error ? err.message : String(err))
  }
}

// ---------------------------------------------------------------- Texte

/** Position im Katalog (Spec 3.2); unbekannte ids kommen danach, alphabetisch. @param {string} id */
const catalogRank = (id) => {
  const index = CATALOG_ORDER.indexOf(id)
  return index < 0 ? CATALOG_ORDER.length : index
}

/**
 * @param {string} file Dateiname im Textordner
 * @returns {{ file: string } & ReturnType<typeof parseMeditation>}
 */
function loadFile(file) {
  let parsed
  try {
    parsed = parseMeditation(readFileSync(join(paths.content, file), 'utf8'))
  } catch (err) {
    throw new CliError(`${file}: ${err instanceof Error ? err.message : err}`)
  }
  if (file !== `${parsed.meta.id}.md`) {
    throw new CliError(`${file}: Dateiname und id „${parsed.meta.id}“ passen nicht zusammen (erwartet ${parsed.meta.id}.md).`)
  }
  return { file, ...parsed }
}

/** @param {string} [id] eine einzelne Meditation, sonst alle in Katalog-Reihenfolge */
function loadMeditations(id) {
  if (!existsSync(paths.content)) throw new CliError(`Textordner nicht gefunden: ${paths.content}`)
  const files = readdirSync(paths.content)
    .filter((name) => name.endsWith('.md'))
    .sort()
  if (files.length === 0) throw new CliError(`Keine Meditationstexte (*.md) in ${paths.content}.`)
  if (id !== undefined) {
    if (!files.includes(`${id}.md`)) {
      throw new CliError(`Unbekannte Meditation „${id}“. Vorhanden: ${files.map((f) => f.replace(/\.md$/, '')).join(', ')}`)
    }
    return [loadFile(`${id}.md`)]
  }
  return files
    .map(loadFile)
    .sort((a, b) => catalogRank(a.meta.id) - catalogRank(b.meta.id) || a.meta.id.localeCompare(b.meta.id))
}

// ---------------------------------------------------------------- Anzeige

/** m:ss @param {number} seconds */
const clock = (seconds) => {
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
/** @param {number} bytes */
const kilobytes = (bytes) => `${Math.round(bytes / 1024).toLocaleString('de-DE')} kB`
/** @param {number} share */
const percent = (share) => `${Math.round(share * 100)} %`
/** @param {number} value */
const signedPercent = (value) => `${value >= 0 ? '+' : '-'}${Math.abs(Math.round(value * 100))} %`

/** @param {string[][]} rows erste Zeile = Kopf; erste Spalte links, die übrigen rechts */
function table(rows) {
  const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => row[col].length)))
  return rows
    .map((row) => row.map((cell, col) => (col === 0 ? cell.padEnd(widths[col]) : cell.padStart(widths[col]))).join('  '))
    .join('\n')
}

// ---------------------------------------------------------------- Befehle

/** @param {string} [id] */
function cmdEstimate(id) {
  const rows = loadMeditations(id).map((m) => ({ id: m.meta.id, target: m.meta.minutes * 60, e: estimate(m.segments) }))
  const sum = (/** @type {(r: typeof rows[number]) => number} */ pick) => rows.reduce((acc, r) => acc + pick(r), 0)
  const totalEstimate = sum((r) => r.e.totalSeconds)
  const totalTarget = sum((r) => r.target)

  const lines = [['Meditation', 'Zeichen', 'Ziel', 'Geschätzt', 'Abw.', 'Stille']]
  for (const r of rows) {
    lines.push([r.id, String(r.e.chars), clock(r.target), clock(r.e.totalSeconds), signedPercent(r.e.totalSeconds / r.target - 1), percent(r.e.silenceShare)])
  }
  if (rows.length > 1) {
    lines.push(['Gesamt', String(sum((r) => r.e.chars)), clock(totalTarget), clock(totalEstimate), signedPercent(totalEstimate / totalTarget - 1), percent(sum((r) => r.e.pauseSeconds) / totalEstimate)])
  }
  console.log(table(lines))
  console.log(`\nSprechzeichen gesamt: ${sum((r) => r.e.chars).toLocaleString('de-DE')} (Grundlage der Vertonungskosten). 13 Zeichen/s; Schalen am Anfang und Ende zählen als Stille.`)

  const off = rows.filter((r) => Math.abs(r.e.totalSeconds / r.target - 1) > 0.15)
  if (off.length > 0) console.log(`Hinweis: Länge weicht um mehr als 15 % vom Ziel ab: ${off.map((r) => r.id).join(', ')}`)
  const quiet = rows.filter((r) => r.e.silenceShare < MIN_SILENCE_SHARE)
  if (quiet.length > 0) {
    console.error(`Zu wenig Stille (unter ${percent(MIN_SILENCE_SHARE)}): ${quiet.map((r) => r.id).join(', ')}`)
    return 1
  }
  return 0
}

/** @param {string} [id] */
function cmdSplit(id) {
  const voice = readVoice()
  const items = loadMeditations(id)
  /** @type {Map<string, number>} fehlende Hashes (jeweils einmal) mit ihrer Zeichenzahl */
  const missing = new Map()
  let sectionCount = 0
  for (const m of items) {
    const sections = splitSections(m.segments, voice)
    writeJson(join(paths.sections, `${m.meta.id}.json`), sections)
    const cached = sections.filter((s) => existsSync(join(paths.cache, `${s.hash}.mp3`))).length
    for (const s of sections) {
      if (!existsSync(join(paths.cache, `${s.hash}.mp3`))) missing.set(s.hash, [...s.text].length)
    }
    sectionCount += sections.length
    const chars = sections.reduce((acc, s) => acc + [...s.text].length, 0)
    console.log(`${m.meta.id}: ${sections.length} Abschnitte, ${chars} Zeichen, ${cached} von ${sections.length} im Cache`)
  }
  const missingChars = [...missing.values()].reduce((acc, n) => acc + n, 0)
  console.log(`\n${items.length} Meditation(en), ${sectionCount} Abschnitte. Noch zu vertonen (nicht im Cache, ohne Doppelte): ${missing.size} Abschnitte, ${missingChars.toLocaleString('de-DE')} Zeichen.`)
  return 0
}

function cmdPlaceholders() {
  const items = loadMeditations()
  const known = new Set(items.map((m) => m.meta.id))
  const placeholders = new Set(readPlaceholders().filter((id) => known.has(id)))
  mkdirSync(paths.audio, { recursive: true })
  for (const m of items) {
    const { id, minutes } = m.meta
    const file = join(paths.audio, `${id}.mp3`)
    if (existsSync(file) && !placeholders.has(id)) {
      console.log(`${id}: echte Datei, bleibt unverändert`)
      continue
    }
    const part = `${file}.part`
    try {
      runFfmpeg(buildPlaceholderArgs({ seconds: minutes * 60, outFile: part }))
      renameSync(part, file)
    } catch (err) {
      rmSync(part, { force: true })
      writePlaceholders(placeholders)
      throw err
    }
    placeholders.add(id)
    console.log(`${id}: Platzhalter ${clock(minutes * 60)}, ${kilobytes(statSync(file).size)}`)
  }
  writePlaceholders(placeholders)
  return 0
}

/** @param {string | undefined} id */
function cmdAssemble(id) {
  if (!id) throw new CliError('Aufruf: npm run meditations assemble <id> [--out <Datei>] [--cache <Ordner>]')
  const [m] = loadMeditations(id)
  const voice = readVoice()
  if (!existsSync(paths.bowl)) throw new CliError(`Klangschale nicht gefunden: ${paths.bowl}`)

  const sections = splitSections(m.segments, voice)
  const files = sections.map((s) => join(paths.cache, `${s.hash}.mp3`))
  const missing = sections.filter((_, i) => !existsSync(files[i]))
  if (missing.length > 0) {
    const shown = missing.slice(0, 10).map((s) => `  ${s.hash}  „${s.text.length > 50 ? `${s.text.slice(0, 50)}…` : s.text}“`)
    const more = missing.length > shown.length ? [`  … und ${missing.length - shown.length} weitere`] : []
    throw new CliError(
      [`${id}: Im Cache (${paths.cache}) fehlen ${missing.length} von ${sections.length} Abschnitten:`, ...shown, ...more].join('\n'),
    )
  }

  const timeline = planTimeline(m.segments, files.map(probeDuration), probeDuration(paths.bowl))
  const defaultOut = join(paths.audio, `${id}.mp3`)
  const out = options.out ? resolve(options.out) : defaultOut
  // Nur die Datei an ihrem Platz ersetzt den Platzhalter – egal, wie der Pfad angegeben wurde.
  const replacesPlaceholder = out === defaultOut
  const part = `${out}.part`
  mkdirSync(dirname(out), { recursive: true })
  const mix = { bowlFile: paths.bowl, sectionFiles: files, timeline }
  try {
    // zwei Durchgänge: erst die Lautheit messen, dann linear auf −19 LUFS bringen
    const measured = measureLoudness(buildMeasureArgs(mix))
    console.log(`${id}: Lautheit vor der Normalisierung ${measured.input_i} LUFS, True Peak ${measured.input_tp} dB`)
    runFfmpeg(buildAssembleArgs({ ...mix, outFile: part, measured }))
  } catch (err) {
    rmSync(part, { force: true })
    throw err
  }

  // Die Liste kommt vor dem Umbenennen dran: Bricht der Lauf dazwischen ab, bleibt höchstens ein
  // Platzhalter ohne Eintrag stehen (ein neuer `assemble` behebt das) – nie eine vertonte Datei,
  // die als Platzhalter gilt und vom nächsten `placeholders` überschrieben würde.
  const listed = readPlaceholders()
  const unlist = replacesPlaceholder && listed.includes(id)
  try {
    if (unlist) writePlaceholders(listed.filter((other) => other !== id))
    renameSync(part, out)
  } catch (err) {
    rmSync(part, { force: true })
    if (unlist) writePlaceholders(listed)
    throw err
  }
  const actual = probeDuration(out)
  console.log(`${id}: ${clock(actual)} (${actual.toFixed(1)} s, erwartet ${timeline.totalSeconds.toFixed(1)} s), ${kilobytes(statSync(out).size)} → ${out}`)
  if (Math.abs(actual - timeline.totalSeconds) > 1) console.error(`Warnung: Die Länge weicht um mehr als 1 s vom Zeitplan ab.`)
  return 0
}

/**
 * Version einer Audiodatei: die ersten 10 Hex-Zeichen des SHA-256 ihrer Bytes. Die App hängt sie als
 * `?v=` an die Adresse, damit eine neu aufgenommene Meditation eine neue Adresse bekommt und Geräte
 * die alte Kopie im Cache nicht weiter ausliefern.
 * @param {string} file
 */
const contentVersion = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10)

function cmdManifest() {
  const items = loadMeditations()
  const placeholders = new Set(readPlaceholders())
  const meditations = items.map((m) => {
    const { id, title, category, description, minutes } = m.meta
    const file = join(paths.audio, `${id}.mp3`)
    if (!existsSync(file)) {
      throw new CliError(`${id}: ${file} fehlt. Erst „npm run meditations placeholders“ oder „assemble ${id}“ ausführen.`)
    }
    return {
      id,
      title,
      category,
      description,
      minutes,
      file: `audio/meditations/${id}.mp3`,
      duration: Math.round(probeDuration(file) * 10) / 10,
      bytes: statSync(file).size,
      version: contentVersion(file),
      placeholder: placeholders.has(id),
    }
  })
  writeJson(paths.manifest, { meditations })
  console.log(table([
    ['Meditation', 'Dauer', 'Größe', 'Platzhalter'],
    ...meditations.map((x) => [x.id, clock(x.duration), kilobytes(x.bytes), x.placeholder ? 'ja' : 'nein']),
  ]))
  console.log(`\n${meditations.length} Einträge → ${paths.manifest}`)
  return 0
}

// ---------------------------------------------------------------- Start

function run() {
  const [command, id] = positionals
  if (options.help || command === undefined) {
    ;(options.help ? console.log : console.error)(USAGE)
    return options.help ? 0 : 1
  }
  switch (command) {
    case 'estimate':
      return cmdEstimate(id)
    case 'split':
      return cmdSplit(id)
    case 'placeholders':
      return cmdPlaceholders()
    case 'assemble':
      return cmdAssemble(id)
    case 'manifest':
      return cmdManifest()
    default:
      throw new CliError(`Unbekannter Befehl „${command}“.\n\n${USAGE}`)
  }
}

try {
  process.exitCode = run()
} catch (err) {
  const programmingError = err instanceof TypeError || err instanceof ReferenceError || err instanceof RangeError
  console.error(!programmingError && err instanceof Error ? err.message : err)
  process.exitCode = 1
}
