import { test, expect } from 'vitest'
import { fillNoise, fillDroplets, type NoiseColor } from '../../src/lib/audio/noise'
import { createRng } from '../../src/lib/random'

const N = 48000 * 2
const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length)
const meanStep = (a: Float32Array) => { let s = 0; for (let i = 1; i < a.length; i++) s += Math.abs(a[i] - a[i - 1]); return s / (a.length - 1) }
const gen = (c: NoiseColor, seed = 1) => fillNoise(new Float32Array(N), c, createRng(seed))

test('deterministic per seed', () => {
  expect(gen('pink', 5)).toEqual(gen('pink', 5))
  expect(gen('pink', 5)).not.toEqual(gen('pink', 6))
})

test.each(['white', 'pink', 'brown'] as const)('%s is bounded and normalized', (c) => {
  const a = gen(c)
  expect(a.every(v => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true)
  expect(rms(a)).toBeGreaterThan(0.2); expect(rms(a)).toBeLessThan(0.3)
})

test('spectral tilt: white > pink > brown, brown is smooth', () => {
  const r = (c: NoiseColor) => { const a = gen(c); return meanStep(a) / rms(a) }
  expect(r('white')).toBeGreaterThan(r('pink'))
  expect(r('pink')).toBeGreaterThan(r('brown'))
  expect(r('brown')).toBeLessThan(0.2)
})

test.each(['pink', 'brown'] as const)('%s loops without a jump at the seam', (c) => {
  for (let seed = 1; seed <= 10; seed++) {
    const a = gen(c, seed)
    expect(Math.abs(a[N - 1] - a[0])).toBeLessThan(5 * meanStep(a))
  }
})

test('droplets: silence at 0/s, normalized peak otherwise', () => {
  expect(fillDroplets(new Float32Array(N), createRng(1), 48000, 0).every(v => v === 0)).toBe(true)
  const d = fillDroplets(new Float32Array(N), createRng(1), 48000, 20)
  const peak = d.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  expect(peak).toBeGreaterThan(0.89); expect(peak).toBeLessThanOrEqual(0.9 + 1e-6)
})
