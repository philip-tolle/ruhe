import { test, expect } from 'vitest'
import { createNoiseBank, createLiveSound, type LiveSoundId } from '../../src/lib/audio/live-sounds'

const SR = 22050
async function render(id: LiveSoundId, seconds: number, stopAt?: number) {
  const ctx = new OfflineAudioContext(1, SR * seconds, SR)
  const v = createLiveSound(ctx, id, createNoiseBank(ctx))
  v.output.connect(ctx.destination)
  if (stopAt !== undefined) v.stop(stopAt)
  return (await ctx.startRendering()).getChannelData(0)
}
const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / Math.max(1, a.length))
const zcr = (a: Float32Array) => { let z = 0; for (let i = 1; i < a.length; i++) if ((a[i] >= 0) !== (a[i - 1] >= 0)) z++; return z / a.length }

test.each(['regen', 'meer', 'wind', 'braun'] as const)('%s renders audible, bounded sound', async (id) => {
  const d = await render(id, 3)
  expect(d.every(Number.isFinite)).toBe(true)
  expect(d.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeLessThanOrEqual(1)
  const tail = rms(d.subarray(SR))
  expect(tail).toBeGreaterThan(0.02); expect(tail).toBeLessThan(0.5)
})

test('meer swells in waves', async () => {
  const d = await render('meer', 24)
  const win = Array.from({ length: 24 }, (_, i) => rms(d.subarray(i * SR, (i + 1) * SR)))
  expect(Math.max(...win) / Math.min(...win)).toBeGreaterThan(1.5)
})

test('braun is darker than regen', async () => {
  expect(zcr(await render('braun', 2))).toBeLessThan(zcr(await render('regen', 2)) / 2)
})

test('stop(when) silences everything', async () => {
  const d = await render('regen', 2, 1)
  expect(rms(d.subarray(Math.round(SR * 1.05)))).toBeLessThan(1e-6)
})

test('noise bank: mono buffers of the specified lengths, deterministic per seed', () => {
  const ctx = new OfflineAudioContext(1, SR, SR)
  const bank = createNoiseBank(ctx, 7)
  const lengths = { white: 15, pink: 15, brown: 15, dropsA: 13, dropsB: 17 } as const
  for (const [name, seconds] of Object.entries(lengths)) {
    const b = bank[name as keyof typeof lengths]
    expect(b.numberOfChannels).toBe(1)
    expect(b.sampleRate).toBe(SR)
    expect(b.length).toBe(seconds * SR)
  }
  const again = createNoiseBank(ctx, 7)
  expect(again.pink.getChannelData(0)).toEqual(bank.pink.getChannelData(0))
  expect(again.dropsA.getChannelData(0)).toEqual(bank.dropsA.getChannelData(0))
  expect(createNoiseBank(ctx, 8).pink.getChannelData(0)).not.toEqual(bank.pink.getChannelData(0))
})

// Merkt sich pro erzeugter Quelle (Puffer-Quelle oder Oszillator/LFO) die stop()-Aufrufe.
function trackSources(ctx: BaseAudioContext) {
  const stops = new Map<AudioScheduledSourceNode, (number | undefined)[]>()
  const track = <T extends AudioScheduledSourceNode>(node: T): T => {
    const calls: (number | undefined)[] = []
    stops.set(node, calls)
    const stop = node.stop.bind(node)
    node.stop = (when?: number) => { calls.push(when); stop(when) }
    return node
  }
  const createOscillator = ctx.createOscillator.bind(ctx)
  const createBufferSource = ctx.createBufferSource.bind(ctx)
  ctx.createOscillator = () => track(createOscillator())
  ctx.createBufferSource = () => track(createBufferSource())
  return stops
}

test.each([
  ['braun', 1], // 1 Puffer
  ['regen', 3], // 3 Puffer (Rauschen + 2 Tropfenspuren)
  ['meer', 4], // 1 Puffer + 3 LFOs
  ['wind', 4], // 1 Puffer + 3 LFOs
] as const)('%s: stop(when) stops all %i sources and LFOs at when', (id, count) => {
  const ctx = new OfflineAudioContext(1, SR, SR)
  const stops = trackSources(ctx)
  createLiveSound(ctx, id, createNoiseBank(ctx)).stop(7)
  expect(stops.size).toBe(count)
  for (const calls of stops.values()) expect(calls).toEqual([7])
})
