import { test, expect, vi } from 'vitest'
import { loadBuffer, createLoopVoice } from '../../src/lib/audio/loops'
import { SOUNDS, assetUrl } from '../../src/lib/sounds/catalog'

const SR = 22050
test('every recording decodes to 30 s', async () => {
  const ctx = new OfflineAudioContext(2, SR, SR)
  for (const sound of SOUNDS) {
    const buf = await loadBuffer(ctx, assetUrl(sound.file))
    expect(buf.duration, sound.id).toBeGreaterThan(29.95)
    expect(buf.duration, sound.id).toBeLessThan(30.05)
  }
})

// Braunes Rauschen ist durchgehend gleich laut; in anderen Aufnahmen gibt es leise Stellen.
test('a recording is loaded once and keeps looping past its end', async () => {
  const ctx = new OfflineAudioContext(2, SR * 32, SR)
  const buf = await loadBuffer(ctx, assetUrl('audio/sounds/braun.ogg'))
  expect(await loadBuffer(ctx, assetUrl('audio/sounds/braun.ogg'))).toBe(buf)
  createLoopVoice(ctx, buf).output.connect(ctx.destination)
  const d = (await ctx.startRendering()).getChannelData(0).subarray(SR * 30.5, SR * 31.5)
  expect(Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length)).toBeGreaterThan(0.01)
})

test('missing file rejects and is retried on next call', async () => {
  const ctx = new OfflineAudioContext(1, SR, SR)
  const url = assetUrl('audio/sounds/fehlt.ogg')
  await expect(loadBuffer(ctx, url)).rejects.toThrow('Konnte nicht geladen werden')
  await expect(loadBuffer(ctx, url)).rejects.toThrow('Konnte nicht geladen werden')
})

test('a failed load is not cached: the next call fetches again', async () => {
  const ctx = new OfflineAudioContext(1, SR, SR)
  const url = assetUrl('audio/sounds/fehlt.ogg')
  const spy = vi.spyOn(globalThis, 'fetch')
  try {
    await expect(loadBuffer(ctx, url)).rejects.toThrow(url)
    await expect(loadBuffer(ctx, url)).rejects.toThrow(url)
    expect(spy).toHaveBeenCalledTimes(2)
  } finally {
    spy.mockRestore()
  }
})

test('a response that is not audio (HTTP 200, e.g. an HTML fallback page) rejects the same way', async () => {
  const ctx = new OfflineAudioContext(1, SR, SR)
  const url = 'data:text/html,<p>keine Audiodatei</p>'
  await expect(loadBuffer(ctx, url)).rejects.toThrow('Konnte nicht geladen werden: ' + url)
})

test('loop voice wraps around the buffer, has a unity output and stops on time', async () => {
  const ctx = new OfflineAudioContext(1, SR * 3, SR)
  const buf = ctx.createBuffer(1, SR / 2, SR) // 0,5 s Sinuston: muss sich mehrfach wiederholen
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.sin(i * 0.3) * 0.5
  const voice = createLoopVoice(ctx, buf)
  expect((voice.output as GainNode).gain.value).toBe(1)
  voice.output.connect(ctx.destination)
  voice.stop(2)
  const out = (await ctx.startRendering()).getChannelData(0)
  const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length)
  expect(rms(out.subarray(SR * 1.5, SR * 1.9))).toBeGreaterThan(0.1)
  expect(rms(out.subarray(Math.round(SR * 2.05)))).toBeLessThan(1e-6)
})
