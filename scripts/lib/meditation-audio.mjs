// @ts-check
// Audio-Seite der Meditations-Werkzeuge: Zeitplan der fertigen Datei und die ffmpeg-Argumente für
// Platzhalter und Zusammenbau. Die Argument-Bauer sind reine Funktionen (testbar ohne ffmpeg);
// ffmpeg/ffprobe werden nur mit Argumentliste aufgerufen (execFileSync, für die Lautheitsmessung spawnSync),
// nie über eine Shell.
import { execFileSync, spawnSync } from 'node:child_process'
import { BOWL_LEAD, BOWL_RING, END_PAUSE } from './meditation-text.mjs'

/** Abtastrate der fertigen Meditations-Dateien (die Sprach-Abschnitte werden darauf gebracht). */
export const ASSEMBLE_RATE = 44100
/** Pegel der Klangschale relativ zur Stimme (1 = unverändert); beim Abhören der echten Stimme feinjustieren. */
export const BOWL_GAIN = 1
/** Lautheit −19 LUFS, True Peak −1,5 dB (Global Constraint). */
export const LOUDNORM = 'loudnorm=I=-19:TP=-1.5'
/** Abtastrate der Platzhalter (klein halten). */
export const PLACEHOLDER_RATE = 22050
/** Spitzenpegel des Glockentons: 0,1 ≙ −20 dBFS. */
const PLACEHOLDER_PEAK = 0.1

/**
 * @typedef {{ start: number, duration: number }} Placement Start (s) und Dauer (s) eines Sprechabschnitts
 * @typedef {{ placements: Placement[], endBowlStart: number, totalSeconds: number }} Timeline
 */

/**
 * Zeitplan der fertigen Datei: Die Anfangs-Schale startet bei 0 und klingt unter dem ersten Satz aus,
 * der nach `BOWL_LEAD` beginnt. Danach folgen die Sprechabschnitte mit den Pausen dazwischen; 3 s nach dem
 * letzten Wort setzt die End-Schale ein, und die Datei endet mit ihrem Ausklang.
 *
 * @param {import('./meditation-text.mjs').Segment[]} segments
 * @param {number[]} durations Länge (s) jedes Sprechabschnitts, in Reihenfolge
 * @param {number} [bowlDuration] Länge (s) der Klangschale
 * @returns {Timeline}
 */
export function planTimeline(segments, durations, bowlDuration = BOWL_RING) {
  const speechCount = segments.filter((segment) => segment.kind === 'speech').length
  if (durations.length !== speechCount) {
    throw new Error(`Für ${speechCount} Sprechabschnitte wurden ${durations.length} Längen übergeben.`)
  }
  /** @type {Placement[]} */
  const placements = []
  let cursor = BOWL_LEAD
  let next = 0
  for (const segment of segments) {
    if (segment.kind === 'pause') {
      cursor += segment.seconds
    } else {
      const duration = durations[next++]
      placements.push({ start: cursor, duration })
      cursor += duration
    }
  }
  const endBowlStart = cursor + END_PAUSE
  return { placements, endBowlStart, totalSeconds: endBowlStart + bowlDuration }
}

/** @param {number} seconds */
const millis = (seconds) => Math.round(seconds * 1000)

/**
 * @typedef {{ input_i: string, input_tp: string, input_lra: string, input_thresh: string, target_offset: string }} Loudness
 * Messwerte des ersten Durchgangs (loudnorm, print_format=json); die Werte stehen als Text im Log.
 */

/**
 * Der `loudnorm`-Filter: ohne Messwerte einstufig (nur für die Messung), mit Messwerten linear angewendet.
 * @param {Loudness} [measured]
 * @param {string} [extra]
 */
function loudnormFilter(measured, extra = '') {
  if (!measured) return `${LOUDNORM}${extra}`
  const values = `measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}`
  return `${LOUDNORM}:${values}:linear=true`
}

/**
 * Eingänge und Filtergraph des Zusammenbaus. Eingänge: 0 und 1 sind die Klangschale (Anfang und Ende),
 * ab 2 folgen die Abschnitte in Reihenfolge. Jeder Eingang wird auf mono/44,1 kHz gebracht und per
 * `adelay` auf seinen Startpunkt geschoben; `amix` addiert ohne Pegelskalierung (die Abschnitte
 * überlappen einander nie, nur die Anfangs-Schale klingt unter dem ersten Satz). Danach `loudnorm`.
 *
 * @param {{ bowlFile: string, sectionFiles: string[], timeline: Timeline }} options
 * @param {string} loudnorm
 * @returns {{ inputs: string[], graph: string }}
 */
function assembleGraph({ bowlFile, sectionFiles, timeline }, loudnorm) {
  if (sectionFiles.length !== timeline.placements.length) {
    throw new Error(`Für ${timeline.placements.length} Abschnitte wurden ${sectionFiles.length} Dateien übergeben.`)
  }
  const format = `aformat=sample_rates=${ASSEMBLE_RATE}:channel_layouts=mono`
  const delay = (/** @type {number} */ seconds) => `adelay=${millis(seconds)}:all=1`
  const chains = [
    `[0:a]${format},volume=${BOWL_GAIN}[bowl0]`,
    ...timeline.placements.map((placement, i) => `[${i + 2}:a]${format},${delay(placement.start)}[s${i}]`),
    `[1:a]${format},volume=${BOWL_GAIN},${delay(timeline.endBowlStart)}[bowl1]`,
  ]
  const labels = ['[bowl0]', ...timeline.placements.map((_, i) => `[s${i}]`), '[bowl1]']
  chains.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:normalize=0,${loudnorm},aresample=${ASSEMBLE_RATE}[out]`)
  return {
    inputs: ['-i', bowlFile, '-i', bowlFile, ...sectionFiles.flatMap((file) => ['-i', file])],
    graph: chains.join(';'),
  }
}

/**
 * ffmpeg-Argumente für den ersten Durchgang: derselbe Zusammenbau, aber `loudnorm` misst nur
 * (Log als JSON auf stderr, siehe `parseLoudness`) und es wird keine Datei geschrieben.
 *
 * @param {{ bowlFile: string, sectionFiles: string[], timeline: Timeline }} options
 * @returns {string[]}
 */
export function buildMeasureArgs(options) {
  const { inputs, graph } = assembleGraph(options, loudnormFilter(undefined, ':print_format=json'))
  return [
    '-hide_banner', '-nostdin', '-nostats', '-loglevel', 'info',
    ...inputs,
    '-filter_complex', graph,
    '-map', '[out]',
    '-t', options.timeline.totalSeconds.toFixed(3),
    '-f', 'null', '-',
  ]
}

/**
 * ffmpeg-Argumente für den Zusammenbau der fertigen Datei (MP3 mono 64 kbit/s). Mit `measured`
 * (aus dem ersten Durchgang) wird die Lautheit genau auf −19 LUFS gebracht; ohne bleibt es bei einem
 * einstufigen `loudnorm`, das bei viel Stille und lauter Schale deutlich zu leise endet.
 *
 * @param {{ bowlFile: string, sectionFiles: string[], timeline: Timeline, outFile: string, measured?: Loudness }} options
 * @returns {string[]}
 */
export function buildAssembleArgs({ outFile, measured, ...options }) {
  const { inputs, graph } = assembleGraph(options, loudnormFilter(measured))
  return [
    '-hide_banner', '-nostdin', '-loglevel', 'error', '-y',
    ...inputs,
    '-filter_complex', graph,
    '-map', '[out]',
    '-t', options.timeline.totalSeconds.toFixed(3),
    '-ac', '1', '-ar', String(ASSEMBLE_RATE),
    '-c:a', 'libmp3lame', '-b:a', '64k',
    // gleiche Eingabe ergibt gleiche Bytes (keine Encoder-Kennung, keine Metadaten)
    '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
    '-f', 'mp3',
    outFile,
  ]
}

/**
 * Liest die Messwerte aus dem Log des ersten Durchgangs (`loudnorm=…:print_format=json`).
 * @param {string} log stderr von ffmpeg
 * @returns {Loudness}
 */
export function parseLoudness(log) {
  const end = log.lastIndexOf('}')
  const start = end < 0 ? -1 : log.lastIndexOf('{', end)
  /** @type {Record<string, unknown>} */
  let json = {}
  if (start >= 0) {
    try {
      json = JSON.parse(log.slice(start, end + 1))
    } catch {
      // fällt unten auf die Fehlermeldung
    }
  }
  const keys = /** @type {const} */ (['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'])
  const usable = keys.every((key) => typeof json[key] === 'string' && Number.isFinite(Number(json[key])))
  if (!usable) throw new Error('Die Lautheit konnte nicht gemessen werden (kein Messwert im ffmpeg-Log, oder das Signal ist still).')
  return /** @type {Loudness} */ (Object.fromEntries(keys.map((key) => [key, json[key]])))
}

/**
 * ffmpeg-Argumente für eine Platzhalter-Datei: Stille mit einem leisen Glockenton (Sinus 432 Hz,
 * 2 s exponentielles Abklingen auf −60 dB) bei 0 s, 30 s, 60 s …, MP3 mono 16 kbit/s, 22,05 kHz.
 * Beim Start jedes Tons steht die Sinuskurve im Nulldurchgang (432 Hz × 30 s ist ganzzahlig), es knackt nicht.
 *
 * @param {{ seconds: number, outFile: string }} options
 * @returns {string[]}
 */
export function buildPlaceholderArgs({ seconds, outFile }) {
  const expression = `${PLACEHOLDER_PEAK}*sin(2*PI*432*t)*exp(-3.45*mod(t,30))*lt(mod(t,30),2)`
  return [
    '-hide_banner', '-nostdin', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `aevalsrc=exprs='${expression}':s=${PLACEHOLDER_RATE}:d=${seconds}`,
    '-ac', '1', '-ar', String(PLACEHOLDER_RATE),
    '-c:a', 'libmp3lame', '-b:a', '16k',
    '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
    '-f', 'mp3',
    outFile,
  ]
}

/**
 * Führt ffmpeg mit einer Argumentliste aus (ohne Shell).
 * @param {string[]} args
 */
export function runFfmpeg(args) {
  try {
    execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
  } catch (err) {
    throw new Error(toolMessage('ffmpeg', err))
  }
}

/**
 * Erster Durchgang: misst die Lautheit des Zusammenbaus. spawnSync statt execFileSync (ebenfalls ohne
 * Shell), weil ffmpeg die Messwerte auf stderr schreibt und execFileSync stderr bei Erfolg nicht liefert.
 * @param {string[]} args aus `buildMeasureArgs`
 * @returns {Loudness}
 */
export function measureLoudness(args) {
  const result = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.error || result.status !== 0) throw new Error(toolMessage('ffmpeg', { code: /** @type {NodeJS.ErrnoException | undefined} */ (result.error)?.code, stderr: result.stderr }))
  return parseLoudness(result.stderr)
}

/**
 * Länge einer Audiodatei in Sekunden (ffprobe, ohne Shell).
 * @param {string} file
 * @returns {number}
 */
export function probeDuration(file) {
  let output
  try {
    output = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    throw new Error(toolMessage('ffprobe', err))
  }
  const seconds = Number.parseFloat(output)
  if (!Number.isFinite(seconds)) throw new Error(`ffprobe konnte die Länge von ${file} nicht bestimmen.`)
  return seconds
}

/**
 * @param {string} tool
 * @param {unknown} err
 */
function toolMessage(tool, err) {
  const failure = /** @type {{ code?: string, stderr?: Buffer | string }} */ (err)
  if (failure.code === 'ENOENT') return `${tool} wurde nicht gefunden – bitte installieren.`
  const stderr = failure.stderr ? String(failure.stderr).trim() : ''
  return `${tool} ist fehlgeschlagen${stderr ? `:\n${stderr}` : '.'}`
}
