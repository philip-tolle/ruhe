// Rausch- und Tropfen-Generatoren für die live synthetisierten Klänge.
// Reine Funktionen, die in Float32Arrays schreiben und nahtlos loopbar sind.
// Diese Datei importiert bewusst nichts und nutzt nur löschbare TypeScript-Syntax:
// Node-Skripte laden sie direkt als .ts.

export type NoiseColor = 'white' | 'pink' | 'brown'

const TARGET_RMS = 0.25
const DROPLET_PEAK = 0.9

// Rohes Rauschen der gewünschten Farbe; jeder Aufruf startet mit leerem Filterzustand.
function fillRaw(raw: Float32Array, color: NoiseColor, rng: () => number): void {
  if (color === 'white') {
    for (let i = 0; i < raw.length; i++) raw[i] = rng() * 2 - 1
    return
  }
  if (color === 'brown') {
    // Leaky-Integrator: integriert weißes Rauschen, ohne wegzudriften.
    let b = 0
    for (let i = 0; i < raw.length; i++) {
      b = (b + 0.02 * (rng() * 2 - 1)) / 1.02
      raw[i] = b
    }
    return
  }
  // Rosa: Paul-Kellet-Filter (7 Koeffizienten) auf weißes Rauschen.
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < raw.length; i++) {
    const w = rng() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362
    b6 = w * 0.115926
  }
}

// Füllt `out` mit nahtlos loopbarem Rauschen, normalisiert auf RMS 0,25 und auf ±1 begrenzt.
// Nahtlos: Es entstehen `crossfade` Rohwerte mehr als nötig. Der Anfang wird mit
// dem Überhang gleichleistungs-überblendet, sodass out[n - 1] und out[0] im Rohsignal
// direkt aufeinanderfolgende Werte sind.
export function fillNoise(out: Float32Array, color: NoiseColor, rng: () => number, crossfade = 4096): Float32Array {
  const n = out.length
  if (n === 0) return out
  const f = Math.max(0, Math.min(Math.floor(crossfade), n))

  const raw = new Float32Array(n + f)
  fillRaw(raw, color, rng)

  for (let i = 0; i < n; i++) {
    if (i < f) {
      const phase = (Math.PI / 2) * (i / f)
      out[i] = raw[i] * Math.sin(phase) + raw[n + i] * Math.cos(phase)
    } else {
      out[i] = raw[i]
    }
  }

  let sum = 0
  for (let i = 0; i < n; i++) sum += out[i] * out[i]
  const rms = Math.sqrt(sum / n)
  const gain = rms > 0 ? TARGET_RMS / rms : 0
  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, out[i] * gain))
  return out
}

// Füllt `out` mit kurzen, abklingenden Sinus-Impulsen an zufälligen Stellen
// (im Mittel `perSecond` pro Sekunde). Der Spitzenwert wird auf 0,9 normalisiert;
// ohne Tropfen bleibt alles 0. Nahtlos: Was über das Ende hinausläuft, landet am Anfang.
export function fillDroplets(out: Float32Array, rng: () => number, sampleRate: number, perSecond: number): Float32Array {
  const n = out.length
  out.fill(0)
  if (n === 0) return out

  const startChance = perSecond / sampleRate
  for (let start = 0; start < n; start++) {
    if (rng() >= startChance) continue

    const freq = 1500 + rng() * 3000 // Hz
    const decaySeconds = 0.004 + rng() * 0.008
    const amplitude = 0.2 + rng() * 0.8

    // Länge, bis die Hüllkurve unter ~0,1 % gefallen ist (e^-7).
    const length = Math.min(n, Math.ceil(decaySeconds * sampleRate * 7))
    const decayPerSample = Math.exp(-1 / (decaySeconds * sampleRate))
    const omega = (2 * Math.PI * freq) / sampleRate
    let envelope = amplitude
    for (let k = 0; k < length; k++) {
      out[(start + k) % n] += envelope * Math.sin(omega * k)
      envelope *= decayPerSample
    }
  }

  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]))
  if (peak > 0) {
    const gain = DROPLET_PEAK / peak
    for (let i = 0; i < n; i++) out[i] *= gain
  }
  return out
}
