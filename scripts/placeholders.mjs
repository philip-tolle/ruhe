// Erzeugt synthetische Platzhalter für die dateibasierten Klänge (Meilenstein 1):
// vier nahtlos loopbare Loops (20 s) und den Einzelanschlag der Klangschale (8 s).
// Die echten Aufnahmen entstehen später mit ElevenLabs (Prompts in content/sounds.json).
//
// Aufruf: npm run placeholders (braucht ffmpeg mit libopus im PATH).
// Das PCM ist deterministisch (festes Seed je Klang); die Opus-Kodierung kann
// byteweise abweichen, klingt aber gleich. Vorhandene Dateien werden überschrieben.
//
// Nahtlosigkeit der Loops:
//  - Rauschen kommt aus fillNoise (selbst nahtlos),
//  - Filter laufen zirkulär (Puffer zweimal durchlaufen, zweiter Durchlauf zählt),
//  - Töne und LFOs haben nur Frequenzen mit ganzzahligem f · 20 (ganze Perioden pro Loop),
//  - Zwitschern und Tropfen werden modulo Länge geschrieben und laufen am Ende an den Anfang.
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRng } from '../src/lib/random.ts'
import { fillDroplets, fillNoise } from '../src/lib/audio/noise.ts'

const SR = 48000
const LOOP_SECONDS = 20
const LOOP_LEN = SR * LOOP_SECONDS
const TAU = 2 * Math.PI
const OUT_DIR = fileURLToPath(new URL('../public/audio/sounds/', import.meta.url))

// ---------------------------------------------------------------- Bausteine

// Rundet auf ein Vielfaches von 1/20 Hz: dann passen ganze Perioden in 20 s.
const snap = (hz) => Math.round(hz * LOOP_SECONDS) / LOOP_SECONDS

const noise = (color, rng) => fillNoise(new Float32Array(LOOP_LEN), color, rng)

// Einpol-Tiefpass/-Hochpass als Zustandsautomat: makeStep() liefert eine frische Sample-Funktion.
const lowpass = (hz) => () => {
  const a = 1 - Math.exp((-TAU * hz) / SR)
  let y = 0
  return (x) => (y += a * (x - y))
}
const highpass = (hz) => () => {
  const a = Math.exp((-TAU * hz) / SR)
  let y = 0
  let prev = 0
  return (x) => {
    y = a * (y + x - prev)
    prev = x
    return y
  }
}

// Zirkuläre Filterung: Der Filter durchläuft den Puffer zweimal; behalten wird der zweite
// Durchlauf, dessen Anfangszustand aus dem Ende des Puffers stammt. So gibt es keine Naht.
function circular(input, makeStep) {
  const step = makeStep()
  const out = new Float32Array(input.length)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < input.length; i++) out[i] = step(input[i])
  }
  return out
}
const filtered = (input, ...steps) => steps.reduce((buf, makeStep) => circular(buf, makeStep), input)

// Ganzzahlige Zyklenzahl pro Loop: Der LFO ist am Ende wieder beim Anfangswert.
const lfo = (i, cycles, phase) => Math.sin((TAU * cycles * i) / LOOP_LEN + phase)

// Multipliziert den Puffer mit 1 + Σ depth · LFO. Die Tiefen müssen sich unter 1 summieren.
function modulate(buf, rng, lfos) {
  const phases = lfos.map(() => rng() * TAU)
  for (let i = 0; i < buf.length; i++) {
    let gain = 1
    lfos.forEach((l, k) => (gain += l.depth * lfo(i, l.cycles, phases[k])))
    buf[i] *= gain
  }
  return buf
}

// Skaliert Puffer gemeinsam (an Ort und Stelle) auf den Ziel-RMS.
function scaleToRms(targetRms, ...bufs) {
  let sum = 0
  let count = 0
  for (const b of bufs) {
    for (let i = 0; i < b.length; i++) sum += b[i] * b[i]
    count += b.length
  }
  const rms = Math.sqrt(sum / count)
  const gain = rms > 0 ? targetRms / rms : 0
  for (const b of bufs) for (let i = 0; i < b.length; i++) b[i] *= gain
}

// Skaliert beide Kanäle gemeinsam auf den Ziel-RMS und begrenzt danach die Spitze auf 0,95.
function finish(left, right, targetRms) {
  scaleToRms(targetRms, left, right)
  let peak = 0
  for (const b of [left, right]) for (let i = 0; i < b.length; i++) peak = Math.max(peak, Math.abs(b[i]))
  if (peak > 0.95) for (const b of [left, right]) for (let i = 0; i < b.length; i++) b[i] *= 0.95 / peak
  return [left, right]
}

// ------------------------------------------------------------------- Klänge

// Wald: leises, langsam rauschendes Blätterrauschen plus Vogelzwitschern.
// Vögel sind kurze Sinus-Sweeps zwischen 2,5 und 4,5 kHz in Phrasen aus mehreren Rufen.
function wald() {
  const rng = createRng(101)
  const bed = () => {
    const raw = noise('pink', rng)
    const buf = filtered(raw, lowpass(2500), highpass(150))
    scaleToRms(0.03, buf)
    return modulate(buf, rng, [
      { cycles: 3, depth: 0.25 },
      { cycles: 7, depth: 0.12 },
    ])
  }
  const left = bed()
  const right = bed()

  for (let bird = 0; bird < 4; bird++) {
    const center = 2900 + rng() * 1200
    const pan = 0.15 + rng() * 0.7 // 0 = links, 1 = rechts
    const amp = 0.06 + rng() * 0.06
    const phrases = 3 + Math.floor(rng() * 3)
    for (let p = 0; p < phrases; p++) {
      let start = Math.floor(rng() * LOOP_LEN)
      const calls = 2 + Math.floor(rng() * 5)
      for (let c = 0; c < calls; c++) {
        const length = Math.round((0.06 + rng() * 0.08) * SR)
        const f0 = center + (rng() - 0.5) * 800
        const f1 = center + (rng() - 0.5) * 800
        let phase = 0
        for (let k = 0; k < length; k++) {
          const x = k / length
          phase += (TAU * (f0 + (f1 - f0) * x)) / SR
          const s = amp * Math.sin(Math.PI * x) ** 2 * Math.sin(phase)
          const i = (start + k) % LOOP_LEN
          left[i] += s * Math.cos((pan * Math.PI) / 2)
          right[i] += s * Math.sin((pan * Math.PI) / 2)
        }
        start += length + Math.round((0.05 + rng() * 0.1) * SR)
      }
    }
  }
  return finish(left, right, 0.06)
}

// Kaminfeuer: dunkles, flackerndes Brummen plus knisternde Pings (6 pro Sekunde, je Kanal eigene).
function kaminfeuer() {
  const rng = createRng(102)
  const channel = () => {
    const raw = noise('brown', rng)
    const buf = filtered(raw, lowpass(600), highpass(40))
    scaleToRms(0.1, buf)
    modulate(buf, rng, [
      { cycles: 5, depth: 0.2 },
      { cycles: 13, depth: 0.1 },
      { cycles: 31, depth: 0.05 },
    ])
    const crackles = fillDroplets(new Float32Array(LOOP_LEN), rng, SR, 6)
    for (let i = 0; i < LOOP_LEN; i++) buf[i] += 0.5 * crackles[i]
    return buf
  }
  return finish(channel(), channel(), 0.1)
}

// Bach: bandbegrenztes rosa Rauschen (250 Hz bis ca. 4,5 kHz) mit leichtem Plätschern.
function bach() {
  const rng = createRng(103)
  const channel = () => {
    const raw = noise('pink', rng)
    const buf = filtered(raw, highpass(250), lowpass(4500), lowpass(4500))
    scaleToRms(0.1, buf)
    return modulate(buf, rng, [
      { cycles: 7, depth: 0.12 },
      { cycles: 23, depth: 0.08 },
      { cycles: 61, depth: 0.05 },
    ])
  }
  return finish(channel(), channel(), 0.1)
}

// Klangschalen: ruhiger Teppich aus vier Schalen, jede mit Obertönen und langsamer
// Amplitudenmodulation (0,05 oder 0,1 Hz). Der rechte Kanal ist leicht verstimmt,
// das ergibt ein langsames Schweben zwischen links und rechts.
function klangschalen() {
  const rng = createRng(104)
  const bowls = [
    { hz: 146.85, cycles: 1, detune: 0.15 },
    { hz: 220, cycles: 2, detune: 0.25 },
    { hz: 293.65, cycles: 1, detune: 0.2 },
    { hz: 440, cycles: 2, detune: 0.3 },
  ]
  const partials = [
    { ratio: 1, gain: 1 },
    { ratio: 2.76, gain: 0.35 },
    { ratio: 5.4, gain: 0.12 },
  ]
  const left = new Float32Array(LOOP_LEN)
  const right = new Float32Array(LOOP_LEN)
  for (const bowl of bowls) {
    const phase = rng() * TAU
    for (const part of partials) {
      const hzLeft = snap(bowl.hz * part.ratio)
      const hzRight = hzLeft + bowl.detune // Vielfaches von 1/20 Hz, bleibt ganzzahlig · 20
      const phaseLeft = rng() * TAU
      const phaseRight = rng() * TAU
      for (let i = 0; i < LOOP_LEN; i++) {
        const swell = 0.2 + 0.8 * (0.5 + 0.5 * lfo(i, bowl.cycles, phase))
        const t = i / SR
        left[i] += part.gain * swell * Math.sin(TAU * hzLeft * t + phaseLeft)
        right[i] += part.gain * swell * Math.sin(TAU * hzRight * t + phaseRight)
      }
    }
  }
  return finish(left, right, 0.1)
}

// Einzelanschlag der Klangschale (kein Loop, 8 s): Teiltöne 220 / 597 / 1083 Hz mit
// Abklingzeiten 6 / 3 / 1,5 s (Zeitkonstante), 5 ms Anschlag, 0,3 s Ausblenden am Ende.
function klangschaleStrike() {
  const length = 8 * SR
  const attack = Math.round(0.005 * SR)
  const fade = Math.round(0.3 * SR)
  const partials = [
    { hz: 220, decay: 6, gain: 1 },
    { hz: 597, decay: 3, gain: 0.5 },
    { hz: 1083, decay: 1.5, gain: 0.25 },
  ]
  const mono = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const t = i / SR
    let s = 0
    for (const p of partials) s += p.gain * Math.exp(-t / p.decay) * Math.sin(TAU * p.hz * t)
    if (i < attack) s *= i / attack
    if (i >= length - fade) s *= (length - i) / fade
    mono[i] = s
  }
  const peak = mono.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  for (let i = 0; i < length; i++) mono[i] *= 0.8 / peak
  return [mono, Float32Array.from(mono)]
}

// ----------------------------------------------------------------- Ausgabe

// Verschachtelt beide Kanäle (f32le) und kodiert per ffmpeg zu Ogg/Opus, 48 kHz, Stereo, 96 kbit/s.
function encode([left, right], name) {
  const pcm = new Float32Array(left.length * 2)
  for (let i = 0; i < left.length; i++) {
    pcm[2 * i] = left[i]
    pcm[2 * i + 1] = right[i]
  }
  const target = `${OUT_DIR}${name}.ogg`
  const run = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '96k', target, '-y'],
    { input: Buffer.from(pcm.buffer), maxBuffer: 1 << 20 },
  )
  if (run.error) throw new Error(`ffmpeg konnte nicht gestartet werden (installiert?): ${run.error.message}`)
  if (run.status !== 0) throw new Error(`ffmpeg ist bei ${name} fehlgeschlagen:\n${run.stderr}`)
  console.log(`public/audio/sounds/${name}.ogg  (${(left.length / SR).toFixed(1)} s)`)
}

mkdirSync(OUT_DIR, { recursive: true })
encode(wald(), 'wald')
encode(kaminfeuer(), 'kaminfeuer')
encode(bach(), 'bach')
encode(klangschalen(), 'klangschalen')
encode(klangschaleStrike(), 'klangschale')
