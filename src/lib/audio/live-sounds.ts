// Live synthetisierte Klänge (Regen, Meer, Wind, braunes Rauschen) als Web-Audio-Graphen.
// Alle Bewegung kommt aus geloopten Puffern und OscillatorNode-LFOs, nie aus JS-Timern:
// So läuft der Klang auch im Hintergrund weiter, wenn Android die Timer drosselt.
// Die Puffer starten an zufälligen Offsets, die LFOs laufen mit nicht-kommensurablen
// Raten, damit sich auch nach Stunden nichts hörbar wiederholt.
import { fillDroplets, fillNoise } from './noise'
import { createRng } from '../random'
import type { Voice } from './voice'

export type LiveSoundId = 'regen' | 'meer' | 'wind' | 'braun'

export interface NoiseBank {
  white: AudioBuffer
  pink: AudioBuffer
  brown: AudioBuffer
  dropsA: AudioBuffer
  dropsB: AudioBuffer
}

const NOISE_SECONDS = 15
// Teilerfremde Längen: Das Tropfenmuster wiederholt sich erst nach 13 · 17 = 221 s.
const DROPS_A_SECONDS = 13
const DROPS_B_SECONDS = 17
const DROPS_PER_SECOND = 12

// Baut alle Puffer mit der Abtastrate des Kontexts (Mono). Für denselben Seed identisch.
export function createNoiseBank(ctx: BaseAudioContext, seed = 1): NoiseBank {
  const rng = createRng(seed)
  const sr = ctx.sampleRate
  const buffer = (seconds: number) => ctx.createBuffer(1, Math.round(seconds * sr), sr)
  const noise = (color: 'white' | 'pink' | 'brown') => {
    const b = buffer(NOISE_SECONDS)
    fillNoise(b.getChannelData(0), color, rng)
    return b
  }
  const drops = (seconds: number) => {
    const b = buffer(seconds)
    fillDroplets(b.getChannelData(0), rng, sr, DROPS_PER_SECOND)
    return b
  }
  return {
    white: noise('white'),
    pink: noise('pink'),
    brown: noise('brown'),
    dropsA: drops(DROPS_A_SECONDS),
    dropsB: drops(DROPS_B_SECONDS),
  }
}

// Werkzeugkasten für den Aufbau einer Stimme; merkt sich alle Quellen für `stop`.
function createRig(ctx: BaseAudioContext) {
  const sources: AudioScheduledSourceNode[] = []

  // Geloopte Puffer-Quelle, startet sofort an einem zufälligen Offset.
  function loop(buffer: AudioBuffer): AudioBufferSourceNode {
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.start(0, Math.random() * buffer.duration)
    sources.push(src)
    return src
  }

  function filter(type: BiquadFilterType, frequency: number, q?: number): BiquadFilterNode {
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = frequency
    if (q !== undefined) f.Q.value = q
    return f
  }

  function gain(value: number): GainNode {
    const g = ctx.createGain()
    g.gain.value = value
    return g
  }

  // Sinus-LFO (OscillatorNode → GainNode) moduliert `target` um ± `depth`
  // um den Grundwert herum, der im Parameter selbst steht.
  function lfo(rate: number, depth: number, target: AudioParam): void {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = rate
    const amount = gain(depth)
    osc.connect(amount)
    amount.connect(target)
    osc.start(0)
    sources.push(osc)
  }

  function chain(...nodes: AudioNode[]): AudioNode {
    for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i])
    return nodes[nodes.length - 1]
  }

  function voice(output: AudioNode): Voice {
    return {
      output,
      stop(when = ctx.currentTime) {
        for (const s of sources) s.stop(when)
      },
    }
  }

  return { loop, filter, gain, lfo, chain, voice }
}

type Rig = ReturnType<typeof createRig>

// Jedes Rezept liefert den Ausgangsknoten der Stimme.
const recipes: Record<LiveSoundId, (rig: Rig, bank: NoiseBank) => AudioNode> = {
  // Dunkles Rumpeln.
  braun: ({ loop, filter, gain, chain }, bank) =>
    chain(loop(bank.brown), filter('lowpass', 500, 0.7), gain(0.9)),

  // Rauschteppich plus zwei unabhängig loopende Tropfenspuren.
  regen: ({ loop, filter, gain, chain }, bank) => {
    const out = gain(1)
    chain(loop(bank.pink), filter('highpass', 500), filter('lowpass', 7000), gain(0.6), out)
    const dropBand = filter('bandpass', 3000, 0.8)
    loop(bank.dropsA).connect(dropBand)
    loop(bank.dropsB).connect(dropBand)
    chain(dropBand, gain(0.35), out)
    return out
  },

  // Brandung: Grenzfrequenz und Lautstärke schwellen langsam an und ab.
  meer: ({ loop, filter, gain, lfo, chain }, bank) => {
    const tone = filter('lowpass', 600)
    const level = gain(0.55)
    lfo(0.09, 350, tone.frequency)
    lfo(0.083, 0.3, level.gain)
    lfo(0.137, 0.12, level.gain)
    return chain(loop(bank.brown), tone, level)
  },

  // Böen: Mittenfrequenz und Lautstärke wandern langsam.
  wind: ({ loop, filter, gain, lfo, chain }, bank) => {
    const band = filter('bandpass', 500, 1.2)
    const level = gain(0.5)
    lfo(0.05, 250, band.frequency)
    lfo(0.13, 120, band.frequency)
    lfo(0.07, 0.25, level.gain)
    return chain(loop(bank.pink), band, level)
  },
}

export function createLiveSound(ctx: BaseAudioContext, id: LiveSoundId, bank: NoiseBank): Voice {
  const rig = createRig(ctx)
  return rig.voice(recipes[id](rig, bank))
}
