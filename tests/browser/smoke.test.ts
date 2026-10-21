import { test, expect } from 'vitest'

test('offline audio context renders an oscillator', async () => {
  const ctx = new OfflineAudioContext(1, 22050, 22050)
  const osc = ctx.createOscillator(); osc.connect(ctx.destination); osc.start()
  const data = (await ctx.startRendering()).getChannelData(0)
  const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length)
  expect(rms).toBeGreaterThan(0.5)
})
